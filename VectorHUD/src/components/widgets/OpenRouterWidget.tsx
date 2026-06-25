import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import { getDb, executeQuery } from '../../utils/db';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../types';
import { useSettingsStore, CustomSkill, CustomMcpTool, CustomMcp } from '../../store/settingsStore';
import { useToastStore } from '../../store/toastStore';
import { useOpenRouterStore, AttachedFile } from '../../store/openRouterStore';
import { useShallow } from 'zustand/react/shallow';
import { useShellStore } from '../../store/shellStore';
import { Plus, MessageSquare, Trash2, Camera, Edit3, Copy, Check, Mic, MicOff, Settings, X, Paperclip, Search, Info, RefreshCw, Terminal, ChevronDown } from 'lucide-react';
import { UI_CONSTANTS } from '../../config/constants';
import { AI_TOOLS, executeTool, transcribeAudio } from '../../utils/aiActions';

interface Message {
  id?: number;
  session_id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  image_path?: string;
  timestamp?: string;
  tokens?: number;
  tool_calls?: any;
  tool_call_id?: string;
}

const MODEL_DEFAULT_SETTINGS: Record<string, {
  temperature: number;
  maxTokens: number;
  contextSize: number;
  topK: number;
  topP: number;
}> = {
  'google/gemini-2.5-flash': {
    temperature: 1.0,
    maxTokens: 0,
    contextSize: 1048576,
    topK: 40,
    topP: 0.95
  },
  'anthropic/claude-3.5-sonnet': {
    temperature: 1.0,
    maxTokens: 0,
    contextSize: 200000,
    topK: 0,
    topP: 1.0
  },
  'openai/gpt-4o': {
    temperature: 1.0,
    maxTokens: 0,
    contextSize: 128000,
    topK: 0,
    topP: 1.0
  },
  'deepseek/deepseek-chat': {
    temperature: 1.0,
    maxTokens: 0,
    contextSize: 64000,
    topK: 0,
    topP: 1.0
  },
  'deepseek/deepseek-r1': {
    temperature: 0.6,
    maxTokens: 0,
    contextSize: 64000,
    topK: 0,
    topP: 0.95
  },
  'deepseek/deepseek-v4-flash': {
    temperature: 1.0,
    maxTokens: 0,
    contextSize: 64000,
    topK: 0,
    topP: 1.0
  },
  'moonshotai/kimi-k2-thinking': {
    temperature: 1.0,
    maxTokens: 0,
    contextSize: 128000,
    topK: 0,
    topP: 1.0
  },
  'x-ai/grok-4.3': {
    temperature: 1.0,
    maxTokens: 0,
    contextSize: 128000,
    topK: 0,
    topP: 1.0
  }
};

const getModelDefaultSettings = (model: string) => {
  return MODEL_DEFAULT_SETTINGS[model] || {
    temperature: 1.0,
    maxTokens: 0,
    contextSize: 4096,
    topK: 40,
    topP: 0.9
  };
};

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

const parseMcpJson = (jsonStr: string) => {
  const parsed = JSON.parse(jsonStr);
  let name = 'Imported MCP';
  let command = '';
  let args: string[] = [];
  let envObj: Record<string, string> = {};
  let description = '';
  let tools: any[] = [];

  const extractFromConfig = (config: any, serverName?: string) => {
    if (serverName) name = serverName;
    
    if (Array.isArray(config.command)) {
      if (config.command.length > 0) {
        command = config.command[0];
        args = [...config.command.slice(1)];
      }
    } else if (typeof config.command === 'string') {
      command = config.command;
    }

    if (Array.isArray(config.args)) {
      args = [...args, ...config.args];
    } else if (typeof config.args === 'string') {
      args.push(config.args);
    }

    if (config.env && typeof config.env === 'object') {
      envObj = { ...envObj, ...config.env };
    }

    if (typeof config.description === 'string') {
      description = config.description;
    }

    if (Array.isArray(config.tools)) {
      tools = config.tools.map((t: any) => ({
        name: t.name || '',
        description: t.description || '',
        parameters: t.parameters || { type: 'object', properties: {} }
      }));
    }
  };

  if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
    const keys = Object.keys(parsed.mcpServers);
    if (keys.length > 0) {
      extractFromConfig(parsed.mcpServers[keys[0]], keys[0]);
    }
  } else if (parsed.mcp && typeof parsed.mcp === 'object') {
    const keys = Object.keys(parsed.mcp);
    if (keys.length > 0) {
      extractFromConfig(parsed.mcp[keys[0]], keys[0]);
    }
  } else if (parsed.command) {
    extractFromConfig(parsed);
  } else {
    const keys = Object.keys(parsed);
    if (keys.length === 1 && typeof parsed[keys[0]] === 'object') {
      extractFromConfig(parsed[keys[0]], keys[0]);
    } else {
      throw new Error("Could not find MCP server configuration fields (command/args)");
    }
  }

  if (!command) {
    throw new Error("Executable command is required in the JSON configuration");
  }

  return {
    name,
    command,
    args: args.join(' '),
    env: Object.keys(envObj).length > 0 ? JSON.stringify(envObj) : '',
    description,
    tools
  };
};

export function OpenRouterWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let currentWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      currentWidth = Math.max(160, Math.min(400, startWidth + deltaX));
      if (sidebarRef.current) {
        sidebarRef.current.style.width = `${currentWidth}px`;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setSidebarWidth(currentWidth);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const [drawerWidth, setDrawerWidth] = useState(310);

  const handleDrawerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = drawerWidth;
    let currentWidth = drawerWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      currentWidth = Math.max(240, Math.min(600, startWidth - deltaX));
      if (drawerRef.current) {
        drawerRef.current.style.width = `${currentWidth}px`;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setDrawerWidth(currentWidth);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const { 
    input, 
    setInput, 
    draftImagePath, 
    setDraftImagePath, 
    sidebarOpen, 
    setSidebarOpen, 
    currentSessionId,
    setCurrentSessionId,
    clearDraft,
    attachedFiles,
    setAttachedFiles
  } = useOpenRouterStore();
  
  const [isTyping, setIsTyping] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editSessionTitle, setEditSessionTitle] = useState<string>('');
  
  const {
    aiProvider,
    openRouterModel,
    openaiModel,
    anthropicModel,
    groqModel,
    customOpenRouterModel,
    useCustomOpenRouterModel,
    aiChatTemperature,
    aiChatMaxTokens,
    aiChatContextSize,
    aiChatTopK,
    aiChatTopP,
    aiChatSystemPrompt,
    aiChatPersonality,
    aiSettingsProfiles,
    setAiSettingsProfiles,
    toggleSettings,
    customTones,
    customSystemPrompts,
    aiChatLayoutMode
  } = useSettingsStore(
    useShallow((state) => ({
      aiProvider: state.aiProvider,
      openRouterModel: state.openRouterModel,
      openaiModel: state.openaiModel,
      anthropicModel: state.anthropicModel,
      groqModel: state.groqModel,
      customOpenRouterModel: state.customOpenRouterModel,
      useCustomOpenRouterModel: state.useCustomOpenRouterModel,
      aiChatTemperature: state.aiChatTemperature,
      aiChatMaxTokens: state.aiChatMaxTokens,
      aiChatContextSize: state.aiChatContextSize,
      aiChatTopK: state.aiChatTopK,
      aiChatTopP: state.aiChatTopP,
      aiChatSystemPrompt: state.aiChatSystemPrompt,
      aiChatPersonality: state.aiChatPersonality,
      aiSettingsProfiles: state.aiSettingsProfiles,
      setAiSettingsProfiles: state.setAiSettingsProfiles,
      toggleSettings: state.toggleSettings,
      customTones: state.customTones,
      customSystemPrompts: state.customSystemPrompts,
      aiChatLayoutMode: state.aiChatLayoutMode
    }))
  );
  
  // Local Settings Drawer & Session Search
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  
  
  // Session-specific settings state
  const [sessionSettings, setSessionSettings] = useState({
    temperature: 0.7,
    maxTokens: 0,
    contextSize: 4096,
    topK: 40,
    topP: 0.9,
    systemPrompt: '',
    personality: 'default',
    personalityPrompt: '',
    clipboardAttach: false,
    activeSkills: {
      githubScan: false,
      webSearch: false,
      systemController: true,
      anthropicSearch: false
    },
    customSkills: [] as CustomSkill[],
    customMcps: [] as CustomMcp[]
  });
 
  // MCP connection status tracking
  const [mcpStatuses, setMcpStatuses] = useState<Record<string, 'online' | 'offline' | 'testing' | 'unknown'>>({});

  const checkMcpStatus = async (mcpId: string, command: string, args: string) => {
    setMcpStatuses(prev => ({ ...prev, [mcpId]: 'testing' }));
    try {
      const res = await invoke<string>('test_mcp_connection', { command, args });
      if (res.includes("Connection successful") || res.includes("responded")) {
        setMcpStatuses(prev => ({ ...prev, [mcpId]: 'online' }));
      } else {
        setMcpStatuses(prev => ({ ...prev, [mcpId]: 'offline' }));
      }
    } catch (err) {
      setMcpStatuses(prev => ({ ...prev, [mcpId]: 'offline' }));
    }
  };

  // Automatically check active custom MCP status on load or list updates
  useEffect(() => {
    if (sessionSettings.customMcps && sessionSettings.customMcps.length > 0) {
      sessionSettings.customMcps.forEach(mcp => {
        if (mcp.isActive && !mcpStatuses[mcp.id]) {
          checkMcpStatus(mcp.id, mcp.command, mcp.args);
        } else if (!mcp.isActive && mcpStatuses[mcp.id] !== 'unknown' && mcpStatuses[mcp.id] !== undefined) {
          setMcpStatuses(prev => ({ ...prev, [mcp.id]: 'unknown' }));
        }
      });
    }
  }, [sessionSettings.customMcps]);

  // State for user custom skills and MCP UI forms
  const [showAddSkillForm, setShowAddSkillForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillInst, setNewSkillInst] = useState('');
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  const [showAddMcpForm, setShowAddMcpForm] = useState(false);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpDesc, setNewMcpDesc] = useState('');
  const [newMcpCmd, setNewMcpCmd] = useState('');
  const [newMcpArgs, setNewMcpArgs] = useState('');
  const [newMcpEnv, setNewMcpEnv] = useState('');
  const [newMcpTools, setNewMcpTools] = useState<CustomMcpTool[]>([]);
  const [drawerMcpInputMode, setDrawerMcpInputMode] = useState<'fields' | 'json'>('fields');
  const [drawerMcpJsonInput, setDrawerMcpJsonInput] = useState('');
  const [showAddToolForm, setShowAddToolForm] = useState(false);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDesc, setNewToolDesc] = useState('');
  const [newToolParams, setNewToolParams] = useState('{\n  "type": "object",\n  "properties": {}\n}');
  const [expandedMcpId, setExpandedMcpId] = useState<string | null>(null);
  const [confirmDeleteSkillId, setConfirmDeleteSkillId] = useState<string | null>(null);
  const [confirmDeleteMcpId, setConfirmDeleteMcpId] = useState<string | null>(null);
  const [sessionModel, setSessionModel] = useState<string>('');
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const modelSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modelSelectRef.current && !modelSelectRef.current.contains(e.target as Node)) {
        setIsModelSelectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Pre-baked system prompt templates
  const SYSTEM_PROMPT_TEMPLATES = {
    custom: { name: "Custom Prompt", text: "" },
    creative: { name: "Creative Writing", text: "Avoid flowery AI writing style, be concise, vivid, and highly descriptive. Show, don't tell." },
    roleplay: { name: "Roleplaying", text: "Act as an interactive companion in character. Respond in character with natural dialog." },
    research: { name: "Deep Research", text: "Act as a thorough research analyst. Provide structured answers, cite sources, and address nuances." },
    instructor: { name: "Instructor", text: "Act as a clear and patient educator. Break down complex concepts into simple analogies." },
    technews: { name: "Tech News Aggregator", text: "Summarize recent tech breakthroughs and updates. Focus on impacts, specs, and details." },
    gaming: { name: "Gaming Assistant", text: "Act as a tactical overlay companion for video games. Focus on strategies, mechanics, and quick tips." },
    coding: { name: "Coding Specialist", text: "You are a senior software engineer. Write clean, comments-documented, modern code. Prioritize correctness and edge cases." }
  };

  const getActiveModelDefault = () => {
    if (aiProvider === 'openrouter') {
      return (useCustomOpenRouterModel && customOpenRouterModel) ? customOpenRouterModel : openRouterModel;
    }
    if (aiProvider === 'openai') return openaiModel;
    if (aiProvider === 'anthropic') return anthropicModel;
    if (aiProvider === 'groq') return groqModel;
    return 'google/gemini-2.5-flash';
  };

  const getModelProvider = (model: string) => {
    if (!model) return aiProvider || 'openrouter';
    if (model.includes('/')) {
      return 'openrouter';
    }
    if (model.startsWith('gpt') || model.includes('openai')) {
      return 'openai';
    }
    if (model.startsWith('claude') || model.includes('anthropic')) {
      return 'anthropic';
    }
    if (model.includes('llama') || model.includes('mixtral') || model.includes('gemma')) {
      return 'groq';
    }
    return aiProvider || 'openrouter';
  };

  const getSessionModelName = (model: string) => {
    const currentModel = model || getActiveModelDefault();
    if (currentModel.includes('/')) {
      return `OpenRouter: ${currentModel.split('/').pop()}`;
    }
    if (currentModel.startsWith('gpt') || currentModel.includes('openai')) {
      return `OpenAI: ${currentModel}`;
    }
    if (currentModel.startsWith('claude') || currentModel.includes('anthropic')) {
      const parts = currentModel.split('-');
      return `Anthropic: ${parts.length > 2 ? parts.slice(1).join('-') : currentModel}`;
    }
    if (currentModel.includes('llama') || currentModel.includes('mixtral') || currentModel.includes('gemma')) {
      return `Groq: ${currentModel.split('/').pop()}`;
    }
    const provider = aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1);
    return `${provider}: ${currentModel}`;
  };

  const parseModelOption = (option: { value: string, label: string }) => {
    // 1. Handle System Default option
    if (option.value === "") {
      const defaultModel = getActiveModelDefault();
      let defaultLabel = "Unknown Model";
      
      const found = [
        { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash [Vision] [Actions] [File Attachments] [Web Search]' },
        { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet [Vision] [Actions] [File Attachments] [MCP]' },
        { value: 'openai/gpt-4o', label: 'OpenAI GPT-4o [Vision] [Actions] [File Attachments]' },
        { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3 [Actions]' },
        { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1 [Thinking]' },
        { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek v4-Flash [Vision] [File Attachments] [Web Search]' },
        { value: 'moonshotai/kimi-k2-thinking', label: 'Kimi K2 Thinking [Thinking]' },
        { value: 'x-ai/grok-4.3', label: 'Grok 4 [Vision] [Actions] [File Attachments]' }
      ].find(m => m.value === defaultModel);

      if (found) {
        defaultLabel = found.label;
      } else {
        if (openaiModel && defaultModel === openaiModel) defaultLabel = `OpenAI: ${openaiModel} (Direct)`;
        else if (anthropicModel && defaultModel === anthropicModel) defaultLabel = `Anthropic: ${anthropicModel} (Direct)`;
        else if (groqModel && defaultModel === groqModel) defaultLabel = `Groq: ${groqModel} (Direct)`;
        else if (openRouterModel && defaultModel === openRouterModel) defaultLabel = `OpenRouter: ${openRouterModel.split('/').pop()}`;
        else if (useCustomOpenRouterModel && customOpenRouterModel && defaultModel === customOpenRouterModel) defaultLabel = `Custom OpenRouter: ${customOpenRouterModel}`;
        else defaultLabel = defaultModel;
      }

      const resolved = parseModelOption({ value: defaultModel, label: defaultLabel });
      return {
        value: "",
        name: `Use Global Default (${resolved.name})`,
        provider: "System Default",
        tags: ["Global"]
      };
    }

    let rawLabel = option.label;
    
    // Parse tags e.g. [Vision]
    const tags: string[] = [];
    const tagRegex = /\[([^\]]+)\]/g;
    let match;
    while ((match = tagRegex.exec(rawLabel)) !== null) {
      tags.push(match[1]);
    }
    
    let cleanName = rawLabel.replace(/\[[^\]]+\]/g, '').trim();
    let provider = '';
    
    const val = option.value;
    if (val.includes('/')) {
      provider = 'OpenRouter';
      if (cleanName.includes(':')) {
        cleanName = cleanName.split(':').slice(1).join(':').trim();
      }
    } else {
      if (val.startsWith('gpt') || val.includes('openai')) {
        provider = 'OpenAI (Direct)';
      } else if (val.startsWith('claude') || val.includes('anthropic')) {
        provider = 'Anthropic (Direct)';
      } else if (val.includes('llama') || val.includes('mixtral') || val.includes('gemma')) {
        provider = 'Groq (Direct)';
      } else {
        provider = 'API';
      }
      
      if (cleanName.includes(':')) {
        cleanName = cleanName.split(':').slice(1).join(':').trim();
      }
    }

    cleanName = cleanName.replace(/\(Direct\)$/i, '').trim();
    
    return {
      value: val,
      name: cleanName,
      provider,
      tags
    };
  };

  const getAvailableModels = () => {
    const list = [
      { value: '', label: 'Use Global Default [Global]' },
      { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash [Vision] [Actions] [File Attachments] [Web Search]' },
      { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet [Vision] [Actions] [File Attachments] [MCP]' },
      { value: 'openai/gpt-4o', label: 'OpenAI GPT-4o [Vision] [Actions] [File Attachments]' },
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3 [Actions]' },
      { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1 [Thinking]' },
      { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek v4-Flash [Vision] [File Attachments] [Web Search]' },
      { value: 'moonshotai/kimi-k2-thinking', label: 'Kimi K2 Thinking [Thinking]' },
      { value: 'x-ai/grok-4.3', label: 'Grok 4 [Vision] [Actions] [File Attachments]' }
    ];

    const getModelLabel = (val: string, providerHint?: string) => {
      const name = val.split('/').pop() || val;
      const provider = providerHint || getModelProvider(val);
      const capProvider = provider.charAt(0).toUpperCase() + provider.slice(1);
      return `${capProvider}: ${name}`;
    };

    const addIfMissing = (value: string, label: string) => {
      if (value && !list.some(item => item.value === value)) {
        list.push({ value, label });
      }
    };

    if (openaiModel) addIfMissing(openaiModel, `OpenAI: ${openaiModel} (Direct)`);
    if (anthropicModel) addIfMissing(anthropicModel, `Anthropic: ${anthropicModel} (Direct)`);
    if (groqModel) addIfMissing(groqModel, `Groq: ${groqModel} (Direct)`);
    if (openRouterModel) addIfMissing(openRouterModel, `OpenRouter: ${openRouterModel.split('/').pop()}`);
    if (useCustomOpenRouterModel && customOpenRouterModel) {
      addIfMissing(customOpenRouterModel, `Custom OpenRouter: ${customOpenRouterModel}`);
    }

    if (sessionModel) {
      addIfMissing(sessionModel, getModelLabel(sessionModel));
    }

    return list;
  };

  const masterDefaults = {
    temperature: aiChatTemperature,
    maxTokens: aiChatMaxTokens,
    contextSize: aiChatContextSize,
    topK: aiChatTopK,
    topP: aiChatTopP,
    systemPrompt: aiChatSystemPrompt,
    personality: aiChatPersonality,
    model: getActiveModelDefault()
  };

  const showToast = useToastStore(state => state.showToast);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micSeconds, setMicSeconds] = useState(30);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast("📡 Connection Restored: Online");
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast("📡 Connection Lost: Offline");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  const stopAndTranscribe = async () => {
    setIsRecordingMic(false);
    showToast("🎙️ Transcribing voice...");
    try {
      const base64Wav = await invoke<string>('stop_voice_recording');
      const text = await transcribeAudio(base64Wav);
      if (text.trim()) {
        setInput(text.trim());
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`🎙️ Transcription failed: ${errMsg}`);
    }
  };

  const handleMicClick = async () => {
    if (!isRecordingMic) {
      try {
        const selectedAudioInput = useSettingsStore.getState().selectedAudioInput;
        await invoke('start_voice_recording', { deviceName: selectedAudioInput });
        setIsRecordingMic(true);
        setMicSeconds(30);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        showToast(`🎙️ Failed to start mic: ${errMsg}`);
      }
    } else {
      await stopAndTranscribe();
    }
  };

  useEffect(() => {
    if (!isRecordingMic) return;
    
    const interval = setInterval(() => {
      setMicSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          stopAndTranscribe();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecordingMic]);

  useEffect(() => {
    return () => {
      if (isRecordingMic) {
        invoke('stop_voice_recording').catch(() => {});
      }
    };
  }, [isRecordingMic]);

  const getCodeText = (node: any): string => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return node.map(getCodeText).join('');
    if (node.props && node.props.children) return getCodeText(node.props.children);
    return '';
  };



  const handleCopy = (text: string, id: number | string | undefined) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id || text.substring(0, 10));
    setTimeout(() => setCopiedId(null), 2000);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
      loadSessionSettings(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    const handleRefresh = () => {
      if (currentSessionId) {
        loadSessionMessages(currentSessionId);
      }
    };
    window.addEventListener('refresh-chat-messages', handleRefresh);
    return () => window.removeEventListener('refresh-chat-messages', handleRefresh);
  }, [currentSessionId]);

  useEffect(() => {
    const handleSettingsApplied = () => {
      if (currentSessionId) {
        loadSessionSettings(currentSessionId);
      }
    };
    window.addEventListener('settings-applied', handleSettingsApplied);
    return () => window.removeEventListener('settings-applied', handleSettingsApplied);
  }, [
    currentSessionId,
    aiChatTemperature,
    aiChatMaxTokens,
    aiChatContextSize,
    aiChatTopK,
    aiChatTopP,
    aiChatSystemPrompt,
    aiChatPersonality,
    aiProvider,
    openRouterModel,
    openaiModel,
    anthropicModel,
    groqModel,
    useCustomOpenRouterModel,
    customOpenRouterModel
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadSessionSettings = async (sessionId: string) => {
    try {
      const db = await getDb();
      const res = await db.select<{ session_settings: string | null, selected_model: string | null }[]>(
        "SELECT session_settings, selected_model FROM session_titles WHERE session_id = ?",
        [sessionId]
      );
      const selectedModel = (res.length > 0 && res[0].selected_model !== null) ? res[0].selected_model : "";
      const resolvedModel = selectedModel || masterDefaults.model;
      const modelDefaults = getModelDefaultSettings(resolvedModel);

      if (res.length > 0 && res[0].session_settings) {
        const parsed = JSON.parse(res[0].session_settings);
        
        let loadedPersonalityPrompt = parsed.personalityPrompt;
        if (loadedPersonalityPrompt === undefined || loadedPersonalityPrompt === null) {
          loadedPersonalityPrompt = PERSONALITY_PROMPTS[parsed.personality as keyof typeof PERSONALITY_PROMPTS] || "";
          if (!loadedPersonalityPrompt && parsed.personality !== "default") {
            const matchedCustom = useSettingsStore.getState().customTones.find(t => t.id === parsed.personality);
            if (matchedCustom) {
              loadedPersonalityPrompt = matchedCustom.text;
            }
          }
        }

        setSessionSettings({
          temperature: parsed.temperature ?? modelDefaults.temperature,
          maxTokens: parsed.maxTokens ?? modelDefaults.maxTokens,
          contextSize: parsed.contextSize ?? modelDefaults.contextSize,
          topK: parsed.topK ?? modelDefaults.topK,
          topP: parsed.topP ?? modelDefaults.topP,
          systemPrompt: parsed.systemPrompt ?? "",
          personality: parsed.personality ?? "default",
          personalityPrompt: loadedPersonalityPrompt ?? "",
          clipboardAttach: parsed.clipboardAttach ?? false,
          activeSkills: parsed.activeSkills ?? {
            githubScan: false,
            webSearch: false,
            systemController: true,
            anthropicSearch: false
          },
          customSkills: (() => {
            const globalSkills = useSettingsStore.getState().globalCustomSkills || [];
            return globalSkills.map(gs => {
              const existing = (parsed.customSkills || []).find((s: any) => s.id === gs.id);
              return {
                ...gs,
                isActive: existing ? existing.isActive : gs.isActive
              };
            });
          })(),
          customMcps: (() => {
            const globalMcps = useSettingsStore.getState().globalCustomMcps || [];
            return globalMcps.map(gm => {
              const existing = (parsed.customMcps || []).find((m: any) => m.id === gm.id);
              return {
                ...gm,
                isActive: existing ? existing.isActive : gm.isActive
              };
            });
          })()
        });
        setSessionModel(selectedModel);
      } else {
        const globalSkills = useSettingsStore.getState().globalCustomSkills || [];
        const globalMcps = useSettingsStore.getState().globalCustomMcps || [];

        setSessionSettings({
          temperature: modelDefaults.temperature,
          maxTokens: modelDefaults.maxTokens,
          contextSize: modelDefaults.contextSize,
          topK: modelDefaults.topK,
          topP: modelDefaults.topP,
          systemPrompt: "",
          personality: "default",
          personalityPrompt: "",
          clipboardAttach: false,
          activeSkills: {
            githubScan: false,
            webSearch: false,
            systemController: true,
            anthropicSearch: false
          },
          customSkills: globalSkills.map(s => ({ ...s, isActive: s.isActive })),
          customMcps: globalMcps.map(m => ({ ...m, isActive: m.isActive }))
        });
        setSessionModel(selectedModel);
      }
    } catch (err) {
      logger.error(`Failed to load session settings: ${getErrorMessage(err)}`);
    }
  };

  const saveSessionSettings = async (id: string, settings: any, model: string) => {
    try {
      const db = await getDb();
      const currentTitleResult = await db.select<{ title: string }[]>(
        "SELECT title FROM session_titles WHERE session_id = ?",
        [id]
      );
      const title = currentTitleResult.length > 0 ? currentTitleResult[0].title : "Untitled Chat";
      await db.execute(
        "INSERT INTO session_titles (session_id, title, session_settings, selected_model) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET session_settings=excluded.session_settings, selected_model=excluded.selected_model",
        [id, title, JSON.stringify(settings), model]
      );
    } catch (err) {
      logger.error(`Failed to save session settings: ${getErrorMessage(err)}`);
    }
  };

  const generateSessionId = () => {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  };

  const loadSessions = async () => {
    try {
      const db = await getDb();
      // Group by session_id to get unique sessions. We use the first message's content as title.
      // SQLite doesn't have an easy FIRST() aggregator, so we do MIN(id) logic.
      const res = await db.select<{ session_id: string, content: string, timestamp: string, custom_title: string | null }[]>(`
        SELECT h.session_id, h.content, MIN(h.timestamp) as timestamp, t.title as custom_title
        FROM ai_chat_history h
        LEFT JOIN session_titles t ON h.session_id = t.session_id
        WHERE h.session_id IS NOT NULL 
        GROUP BY h.session_id 
        ORDER BY timestamp DESC
      `);
      
      const mappedSessions = res.map(row => ({
        id: row.session_id,
        title: row.custom_title || (row.content.substring(0, 30) + (row.content.length > 30 ? '...' : '')),
        timestamp: row.timestamp
      }));
      
      setSessions(mappedSessions);
      
      if (mappedSessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(mappedSessions[0].id);
      } else if (mappedSessions.length === 0) {
        createNewSession();
      }
    } catch (err) {
      logger.error(`Failed to load sessions: ${getErrorMessage(err)}`);
      // Fallback: create a new session
      if (!currentSessionId) createNewSession();
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>('SELECT * FROM ai_chat_history WHERE session_id = ? ORDER BY id ASC', [sessionId]);
      const mapped = res.map(row => ({
        ...row,
        tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined
      }));
      setMessages(mapped);
    } catch (err) {
      logger.error(`Failed to load messages: ${getErrorMessage(err)}`);
    }
  };

  const createNewSession = async () => {
    const newId = generateSessionId();
    setCurrentSessionId(newId);
    setMessages([]);
    
    const selectedModel = "";
    const resolvedModel = masterDefaults.model;
    const modelDefaults = getModelDefaultSettings(resolvedModel);
    
    const globalSkills = useSettingsStore.getState().globalCustomSkills || [];
    const globalMcps = useSettingsStore.getState().globalCustomMcps || [];

    const initialSettings = {
      temperature: modelDefaults.temperature,
      maxTokens: modelDefaults.maxTokens,
      contextSize: modelDefaults.contextSize,
      topK: modelDefaults.topK,
      topP: modelDefaults.topP,
      systemPrompt: "",
      personality: "default",
      personalityPrompt: "",
      clipboardAttach: false,
      activeSkills: {
        githubScan: false,
        webSearch: false,
        systemController: true,
        anthropicSearch: false
      },
      customSkills: globalSkills.map(s => ({ ...s, isActive: s.isActive })),
      customMcps: globalMcps.map(m => ({ ...m, isActive: m.isActive }))
    };
    setSessionSettings(initialSettings);
    setSessionModel(selectedModel);
    await saveSessionSettings(newId, initialSettings, selectedModel);
    
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const saveMessage = async (msg: Message) => {
    try {
      await executeQuery(
        'INSERT INTO ai_chat_history (session_id, role, content, image_path, tokens, tool_calls, tool_call_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          msg.session_id,
          msg.role,
          msg.content,
          msg.image_path || null,
          msg.tokens || null,
          msg.tool_calls ? JSON.stringify(msg.tool_calls) : null,
          msg.tool_call_id || null
        ]
      );
      // Refresh sessions if it's the first message
      if (messages.length === 0) {
        loadSessions();
      }
    } catch (err) {
      logger.error(`Failed to save AI message to DB: ${getErrorMessage(err)}`);
    }
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await executeQuery('DELETE FROM ai_chat_history WHERE session_id = ?', [sessionId]);
      await executeQuery('DELETE FROM session_titles WHERE session_id = ?', [sessionId]);
      logger.info(`Deleted session ${sessionId}`);
      
      const newSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(newSessions);
      
      if (currentSessionId === sessionId) {
        if (newSessions.length > 0) {
          setCurrentSessionId(newSessions[0].id);
        } else {
          createNewSession();
        }
      }
    } catch (err) {
      logger.error(`Failed to delete session: ${getErrorMessage(err)}`);
    }
  };

  const renameSession = async (sessionId: string, newTitle: string) => {
    try {
      await executeQuery(
        'INSERT INTO session_titles (session_id, title) VALUES (?, ?) ON CONFLICT(session_id) DO UPDATE SET title=excluded.title',
        [sessionId, newTitle]
      );
      setEditingSessionId(null);
      loadSessions();
    } catch (err) {
      logger.error(`Failed to rename session: ${getErrorMessage(err)}`);
    }
  };

  const handleAnalyzeScreen = async () => {
    setIsTyping(true);
    try {
      logger.info("Triggering in-memory screen buffer capture...");
      useShellStore.getState().setIgnoreFocusLoss(true);
      const base64Image = await invoke<string>('capture_screen_base64');
      setDraftImagePath(base64Image);
      showToast("📸 Vision Buffer Captured");
    } catch (err) {
      logger.error(`Failed to analyze screen buffer: ${getErrorMessage(err)}`);
    } finally {
      setIsTyping(false);
      setTimeout(() => {
        useShellStore.getState().setIgnoreFocusLoss(false);
      }, 300);
    }
  };

  // AI Response Personality instructions mapping
  const PERSONALITY_PROMPTS = {
    default: "",
    tactical: "Respond in character as a Tactical HUD AI Officer. Your tone is direct, formal, status-driven, mission-oriented, and structured. Use uppercase terms where appropriate like [STATUS_OK] or [WARNING]. ",
    copilot: "Respond in character as a Gritty Copilot. Your tone is informal, direct, slightly rough, realistic, and highly supportive. You don't beat around the bush. ",
    operator: "Respond in character as a Sarcastic Operator. Your tone is witty, slightly cynical, lighthearted but competent. You make occasional dry jokes about systems and instructions. ",
    scientific: "Respond in character as a Dry Scientific Advisor. Your tone is academic, highly detailed, precise, formal, and objective. Avoid emotional phrases and focus strictly on data."
  };

  // Mockup tools for GitHub and Web Search
  const MOCK_GITHUB_TOOLS = [
    {
      type: "function",
      function: {
        name: "list_github_issues",
        description: "List the open issues and tasks in the active repository.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "integer",
              description: "Number of issues to return (default: 5)."
            }
          }
        }
      }
    }
  ];

  const MOCK_WEB_SEARCH_TOOLS = [
    {
      type: "function",
      function: {
        name: "web_search",
        description: "Query search engines for live, real-time web results on a given topic.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to perform."
            }
          },
          required: ["query"]
        }
      }
    }
  ];

  const parseImagePath = (imagePathString?: string) => {
    if (!imagePathString) return null;
    if (imagePathString.startsWith('{')) {
      try {
        return JSON.parse(imagePathString);
      } catch (e) {
        return { image: imagePathString };
      }
    }
    return { image: imagePathString };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!navigator.onLine) {
      showToast("📡 Connection offline: cannot submit AI chat");
      return;
    }
    if (!input.trim() && !draftImagePath && attachedFiles.length === 0) return;

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = generateSessionId();
      setCurrentSessionId(activeSessionId);
    }

    // Handle clipboard auto-attach
    let clipboardText = '';
    if (sessionSettings.clipboardAttach) {
      try {
        clipboardText = await navigator.clipboard.readText();
        if (clipboardText) {
          showToast("📋 Auto-attached clipboard content");
        }
      } catch (err) {
        logger.warn(`Failed to read clipboard text: ${getErrorMessage(err)}`);
      }
    }

    // Build serialized attachments JSON payload
    let imagePathPayload: string | undefined = undefined;
    if (draftImagePath || attachedFiles.length > 0 || clipboardText) {
      imagePathPayload = JSON.stringify({
        image: draftImagePath || undefined,
        files: attachedFiles.length > 0 ? attachedFiles : undefined,
        clipboard: clipboardText || undefined
      });
    }

    const userMsg: Message = { 
      session_id: activeSessionId, 
      role: 'user', 
      content: input, 
      image_path: imagePathPayload 
    };
    
    const updatedMessages = [...messages, userMsg];
    
    setMessages(updatedMessages);
    setInput('');
    setAttachedFiles([]);
    clearDraft();
    setIsTyping(true);
    await saveMessage(userMsg);
    
    await fetchAIResponse(updatedMessages, activeSessionId);
  };

  const showToolToast = (name: string, args: any) => {
    switch (name) {
      case 'set_master_volume': {
        const volInput = args.volume_percent !== undefined ? args.volume_percent : args.volume;
        let vol = Number(volInput);
        if (!isNaN(vol)) {
          if (vol > 0 && vol <= 1.0 && !Number.isInteger(vol)) {
            vol = Math.round(vol * 100);
          } else {
            vol = Math.round(vol);
          }
        } else {
          vol = 0;
        }
        showToast(`🔊 System Volume set to ${vol}%`);
        break;
      }
      case 'toggle_master_mute':
        showToast(`🔇 Toggled System Mute`);
        break;
      case 'media_control': {
        const cmd = args.command;
        if (cmd === 'play_pause') showToast(`⏯️ Media Play/Pause`);
        else if (cmd === 'next') showToast(`⏭️ Next Track`);
        else if (cmd === 'prev') showToast(`⏮️ Previous Track`);
        break;
      }
      case 'start_timer':
        showToast(`⏱️ Timer Started: ${args.duration_seconds}s`);
        break;
      case 'reset_timer':
        showToast(`⏱️ Timer Reset`);
        break;
      case 'control_stopwatch': {
        const cmd = args.command;
        if (cmd === 'start') showToast(`⏱️ Stopwatch Started`);
        else if (cmd === 'pause') showToast(`⏱️ Stopwatch Paused`);
        else if (cmd === 'reset') showToast(`⏱️ Stopwatch Reset`);
        break;
      }
      case 'get_hardware_metrics':
        showToast(`📊 Telemetry Metrics Sent to AI`);
        break;
      case 'capture_screenshot':
        showToast(`📸 Silent Screenshot saved to gallery`);
        break;
      case 'start_video_recording':
        showToast(`🎥 Video Recording Started`);
        break;
      case 'stop_video_recording':
        showToast(`🎥 Video Recording Stopped`);
        break;
      case 'save_replay_clip':
        showToast(`⚡ Replay Clip Saved`);
        break;
      case 'search_notion_tasks':
        showToast(`📋 Synced Notion Tasks Queried`);
        break;
      case 'fill_notion_draft':
        showToast(`📋 Notion Draft Filled by AI`);
        break;
      case 'list_notion_tasks': {
        const limit = args.limit || 10;
        showToast(`📋 Listed ${limit} Notion tasks`);
        break;
      }
      case 'query_notion_db':
        showToast(`📋 Synced Notion Tasks Queried`);
        break;
      case 'get_active_media_and_app':
        showToast(`🎵 Querying active application and media`);
        break;
      case 'web_search':
      case 'list_github_issues':
        // Skipped generic toast to prevent duplicates since specific toasts are shown during tool execution
        break;
      default:
        if (!name.startsWith('mcp_')) {
          showToast(`🔧 Tool Executed: ${name}`);
        }
        break;
    }
  };

  const fetchAIResponse = async (currentMessages: Message[], sessionId: string, depth = 0) => {
    if (depth > 5) {
      logger.error("Max tool calling depth reached. Preventing infinite loop.");
      const errorMsg: Message = { session_id: sessionId, role: 'assistant', content: "Error: Max tool execution loop depth reached." };
      setMessages(prev => [...prev, errorMsg]);
      setIsTyping(false);
      return;
    }

    try {
      const db = await getDb();
      let keyId = 'openrouter_key';
      let friendlyProviderName = 'OpenRouter';
      let selectedModel = sessionModel || getActiveModelDefault();
      let provider = getModelProvider(selectedModel);

      switch (provider) {
        case 'openai':
          keyId = 'openai_key';
          friendlyProviderName = 'OpenAI';
          break;
        case 'anthropic':
          keyId = 'anthropic_key';
          friendlyProviderName = 'Anthropic';
          break;
        case 'groq':
          keyId = 'groq_key';
          friendlyProviderName = 'Groq';
          break;
        case 'openrouter':
        default:
          keyId = 'openrouter_key';
          friendlyProviderName = 'OpenRouter';
          break;
      }

      const keyResult = await db.select<{ encrypted_value: string }[]>(
        "SELECT encrypted_value FROM user_credentials WHERE id = ?",
        [keyId]
      );
      if (keyResult.length === 0) {
        throw new Error(`${friendlyProviderName} API key is not configured. Please add it in Settings.`);
      }

      const apiKey = await invoke<string>('decrypt_data', { encoded: keyResult[0].encrypted_value });
      if (!apiKey) {
        throw new Error(`${friendlyProviderName} API key is invalid or empty.`);
      }

      const apiMessages = currentMessages.map((msg, index) => {
        if (msg.role === 'tool') {
          return {
            role: 'tool',
            tool_call_id: msg.tool_call_id,
            content: msg.content
          };
        }
        if (msg.role === 'assistant' && msg.tool_calls) {
          return {
            role: 'assistant',
            content: msg.content || "",
            tool_calls: msg.tool_calls
          };
        }
        
        let messageContent = msg.content || "";
        const attachments = parseImagePath(msg.image_path);
        
        if (attachments) {
          const shouldTruncate = (currentMessages.length - index) > 2;
          if (attachments.files && attachments.files.length > 0) {
            messageContent += "\n\n=== ATTACHED_FILES ===";
            attachments.files.forEach((file: any) => {
              if (shouldTruncate && file.content && file.content.length > 300) {
                messageContent += `\n\n<attached_file name="${file.name}">\n[File content truncated to save tokens...]\n</attached_file>`;
              } else {
                messageContent += `\n\n<attached_file name="${file.name}">\n${file.content}\n</attached_file>`;
              }
            });
          }
          if (attachments.clipboard) {
            if (shouldTruncate && attachments.clipboard.length > 300) {
              messageContent += `\n\n=== CLIPBOARD_ATTACHMENT ===\n${attachments.clipboard.substring(0, 300)}\n[Clipboard content truncated to save tokens...]`;
            } else {
              messageContent += `\n\n=== CLIPBOARD_ATTACHMENT ===\n${attachments.clipboard}`;
            }
          }
          
          if (attachments.image) {
            return {
              role: msg.role,
              content: [
                { type: 'text', text: messageContent },
                { type: 'image_url', image_url: { url: attachments.image } }
              ]
            };
          }
        }
        
        return {
          role: msg.role,
          content: messageContent
        };
      });

      // Determine if we should pass tools
      const supportsTools = 
        provider === 'openai' ||
        provider === 'anthropic' ||
        provider === 'groq' ||
        (provider === 'openrouter' && (!useCustomOpenRouterModel || (customOpenRouterModel && (
          customOpenRouterModel.includes('gpt') ||
          customOpenRouterModel.includes('claude') ||
          customOpenRouterModel.includes('gemini') ||
          customOpenRouterModel.includes('llama-3.3') ||
          customOpenRouterModel.includes('llama3') ||
          customOpenRouterModel.includes('grok-4')
        ))));

      let activeTools: any[] = [];
      if (sessionSettings.activeSkills.systemController) {
        activeTools = [...AI_TOOLS];
      }
      if (sessionSettings.activeSkills.githubScan) {
        activeTools = [...activeTools, ...MOCK_GITHUB_TOOLS];
      }
      if (sessionSettings.activeSkills.webSearch || sessionSettings.activeSkills.anthropicSearch) {
        activeTools = [...activeTools, ...MOCK_WEB_SEARCH_TOOLS];
      }

      // Inject custom user MCP tools
      if (sessionSettings.customMcps) {
        const activeCustomMcps = sessionSettings.customMcps.filter(m => m.isActive);
        activeCustomMcps.forEach(mcp => {
          if (mcp.tools && mcp.tools.length > 0) {
            mcp.tools.forEach(t => {
              let toolName = t.name;
              if (!toolName.startsWith('mcp_')) {
                toolName = `mcp_${mcp.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_${toolName}`;
              }
              activeTools.push({
                type: "function",
                function: {
                  name: toolName,
                  description: t.description,
                  parameters: t.parameters || { type: "object", properties: {} }
                }
              });
            });
          }
        });
      }

      const toolsPayload = supportsTools && activeTools.length > 0
        ? (provider === 'anthropic' 
            ? activeTools.map(t => ({
                name: t.function.name,
                description: t.function.description,
                input_schema: t.function.parameters
              }))
            : activeTools)
        : undefined;

      interface UnifiedLlmResponse {
        content: string;
        total_tokens: number;
        tool_calls?: any;
      }

      let personalityPrefix = sessionSettings.personalityPrompt;
      if (personalityPrefix === undefined || personalityPrefix === null || personalityPrefix === "") {
        personalityPrefix = PERSONALITY_PROMPTS[sessionSettings.personality as keyof typeof PERSONALITY_PROMPTS] || "";
        if (!personalityPrefix && sessionSettings.personality !== "default") {
          const matchedCustom = customTones.find(t => t.id === sessionSettings.personality);
          if (matchedCustom) {
            personalityPrefix = `Respond in character as ${matchedCustom.name}. ${matchedCustom.text}`;
          }
        }
      }
      const baseSystemPrompt = sessionSettings.systemPrompt || UI_CONSTANTS.CHAT_SYSTEM_PROMPT;
      let finalSystemPrompt = (personalityPrefix ? (personalityPrefix + " ") : "") + baseSystemPrompt;

      if (sessionSettings.customMcps) {
        const activeCustomMcps = sessionSettings.customMcps.filter(m => m.isActive);
        if (activeCustomMcps.length > 0) {
          finalSystemPrompt += "\n\n=== USER ACTIVE MCP SERVERS ===";
          activeCustomMcps.forEach(mcp => {
            finalSystemPrompt += `\n\n[MCP SERVER: ${mcp.name}]\nDescription: ${mcp.description || 'No description'}\nCommand: ${mcp.command} ${mcp.args}\nStatus: Active`;
            if (mcp.tools && mcp.tools.length > 0) {
              finalSystemPrompt += "\nAvailable Tools:";
              mcp.tools.forEach(t => {
                finalSystemPrompt += `\n  - ${t.name}: ${t.description}`;
              });
            }
          });
        }
      }

      if (sessionSettings.customSkills) {
        const activeCustomSkills = sessionSettings.customSkills.filter(s => s.isActive);
        if (activeCustomSkills.length > 0) {
          finalSystemPrompt += "\n\n=== USER CUSTOM SKILLS ===";
          activeCustomSkills.forEach(s => {
            finalSystemPrompt += `\n\n[SKILL: ${s.name}]\nDescription: ${s.description}\nInstructions:\n${s.instructions}`;
          });
        }
      }

      const result = await invoke<UnifiedLlmResponse>('call_ai_api', {
        provider: provider,
        model: selectedModel,
        messages: apiMessages,
        systemPrompt: finalSystemPrompt,
        apiKey: apiKey,
        tools: toolsPayload,
        temperature: sessionSettings.temperature,
        maxTokens: sessionSettings.maxTokens,
        topP: sessionSettings.topP,
        topK: sessionSettings.topK,
      });

      if (result.tool_calls && result.tool_calls.length > 0) {
        // Append assistant tool-call message
        const assistantMsg: Message = {
          session_id: sessionId,
          role: 'assistant',
          content: result.content || "",
          tokens: result.total_tokens,
          tool_calls: result.tool_calls
        };
        
        await saveMessage(assistantMsg);
        
        const nextMessages = [...currentMessages, assistantMsg];
        setMessages(nextMessages);

        // Execute tool calls
        const toolResults: Message[] = [];
        for (const tc of result.tool_calls) {
          const name = tc.function.name;
          let args = {};
          try {
            args = typeof tc.function.arguments === 'string' 
              ? JSON.parse(tc.function.arguments) 
              : tc.function.arguments;
          } catch (e) {
            logger.error(`Failed to parse arguments for tool ${name}: ${tc.function.arguments}`);
          }

          showToolToast(name, args);
          
          let output = "";
          const getMcpCommandInfo = (toolName: string) => {
            if (sessionSettings.customMcps) {
              for (const mcp of sessionSettings.customMcps) {
                if (mcp.tools) {
                  const found = mcp.tools.some((t: any) => {
                    let tName = t.name;
                    if (!tName.startsWith('mcp_')) {
                      tName = `mcp_${mcp.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')}_${tName}`;
                    }
                    return tName === toolName;
                  });
                  if (found) {
                    return { command: mcp.command, args: mcp.args, env: mcp.env, serverName: mcp.name };
                  }
                }
              }
            }
            return null;
          };

          const mcpInfo = getMcpCommandInfo(name);

          if (mcpInfo) {
            showToast(`🔌 MCP Tool: Executed ${name} on ${mcpInfo.serverName}`);
            output = `[MCP Server: ${mcpInfo.serverName}]\n[Command: ${mcpInfo.command} ${mcpInfo.args}]\n[Env Variables: ${mcpInfo.env || 'none'}]\n[Args passed to tool: ${JSON.stringify(args)}]\n[Stdout]: Connection to MCP server established. Executed tool '${name}' successfully. Simulated response output.`;
          } else if (name.startsWith('mcp_')) {
            showToast(`🔌 MCP Tool: Executed ${name}`);
            output = `[MCP Tool: ${name}]\n[Args: ${JSON.stringify(args)}]\n[Stdout]: Simulated tool execution completed.`;
          } else if (name === "list_github_issues") {
            output = JSON.stringify([
              { id: 104, title: "Failsafe hotkey watcher drop on borderless window", state: "open", assignee: "Arias" },
              { id: 105, title: "Integrate vector HUD analytics telemetry database", state: "open", assignee: "Arias" },
              { id: 108, title: "Token depletion warning segment gauge flashing in drawer", state: "open", assignee: "Arias" }
            ]);
            showToast("🔧 GitHub Scan: Listed open issues");
          } else if (name === "web_search") {
            const query = (args as any).query || "";
            if (query.toLowerCase().includes("weather")) {
              output = "Live Search Results: Clear sky, 72°F (22°C), humidity 45%, wind NW at 8 mph. No precipitation alerts.";
            } else if (query.toLowerCase().includes("stock") || query.toLowerCase().includes("market")) {
              output = "Live Financial Index: NASDAQ +1.2%, DOW +0.8%, S&P 500 +1.0%. Tech sector leading gains.";
            } else {
              // Return a rich set of 5 chronologically ordered tech news items by default for general queries
              output = JSON.stringify([
                { date: "2026-06-24", title: "Micron Reports Record $41.46B Revenue Driven by HBM AI Memory Demand", source: "MarketWatch", summary: "Micron Technology reported fiscal Q3 2026 revenue of $41.46 billion, a massive jump from $9.30 billion last year, driven by unprecedented demand for High-Bandwidth Memory (HBM3E) chips used in AI accelerators." },
                { date: "2026-06-22", title: "White House Directs Agencies to Accelerate Quantum Computing & Security", source: "Reuters", summary: "The Biden administration issued a presidential directive aiming to speed up the commercialization of Quantum Information Science and Technology (QIST) while establishing quantum-resistant cryptography frameworks." },
                { date: "2026-06-20", title: "World Economic Forum Unveils Top 10 Emerging Technologies of 2026", source: "WEF News", summary: "At the Summer Davos in China, the WEF listed the Top 10 Emerging Technologies of 2026, emphasizing exosome-targeted drug delivery, direct lithium extraction, and passive radiative cooling energy grids." },
                { date: "2026-06-18", title: "NVIDIA Details Blackwell B200 Architecture Performance Metrics", source: "EE Times", summary: "NVIDIA shared updated technical performance metrics for its next-gen Blackwell AI platform, highlighting extreme memory bandwidth and 30x energy efficiency gains for large language model inference." },
                { date: "2026-06-15", title: "Tauri v2.0 Stable Released with Rust-based Android & iOS Targets", source: "GitHub Blog", summary: "The Tauri team officially announced the stable release of Tauri v2, enabling web developers to compile lightweight, Rust-backed desktop applications into native mobile iOS and Android binaries." }
              ]);
            }
            showToast(`🔍 Web Search: Queried "${query.substring(0, 15)}..."`);
          } else if (name.startsWith("mcp_")) {
            // Simulated MCP tool execution
            output = JSON.stringify({
              status: "success",
              message: `Simulated response from custom MCP tool '${name.replace(/^mcp_/, '')}'`,
              arguments_received: args,
              data: {
                timestamp: new Date().toISOString(),
                result: `Successfully processed request for tool '${name}' with parameters ${JSON.stringify(args)}`
              }
            });
            showToast(`🔌 MCP Tool: Executed ${name.substring(0, 20)}...`);
          } else {
            output = await executeTool(name, args);
          }

          const toolMsg: Message = {
            session_id: sessionId,
            role: 'tool',
            content: output,
            tool_call_id: tc.id
          };
          
          await saveMessage(toolMsg);
          toolResults.push(toolMsg);
        }

        const nextMessagesWithTools = [...nextMessages, ...toolResults];
        setMessages(nextMessagesWithTools);
        
        // Recurse to let the AI output its final response
        await fetchAIResponse(nextMessagesWithTools, sessionId, depth + 1);

      } else {
        const assistantMsg: Message = {
          session_id: sessionId,
          role: 'assistant',
          content: result.content,
          tokens: result.total_tokens
        };
        
        setMessages(prev => [...prev, assistantMsg]);
        await saveMessage(assistantMsg);
        setIsTyping(false);
      }

    } catch (err: unknown) {
      logger.error(`AI Chat Failed (${aiProvider}): ${getErrorMessage(err)}`);
      const errorMsg: Message = { session_id: sessionId, role: 'assistant', content: `Error: ${getErrorMessage(err)}` };
      setMessages(prev => [...prev, errorMsg]);
      setIsTyping(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    let currentFiles = [...attachedFiles];
    
    for (const file of filesArray) {
      const filePath = (file as any).path || '';
      if (!filePath) {
        // Fallback: Read file directly using JS FileReader / text()
        try {
          showToast(`📄 Reading ${file.name}...`);
          const content = await file.text();
          const lineCount = content.split('\n').length;
          
          const attached: AttachedFile = {
            name: file.name,
            path: file.name, // fallback path is just the name
            content: content,
            size: file.size,
            lines: lineCount
          };
          
          currentFiles = [...currentFiles, attached];
          setAttachedFiles(currentFiles);
          showToast(`✓ Attached: ${file.name}`);
        } catch (err) {
          showToast(`❌ Failed to read file content: ${getErrorMessage(err)}`);
        }
        continue;
      }
      
      try {
        showToast(`📄 Reading ${file.name}...`);
        const content = await invoke<string>('read_attached_file', { path: filePath });
        const lineCount = content.split('\n').length;
        
        const attached: AttachedFile = {
          name: file.name,
          path: filePath,
          content: content,
          size: file.size,
          lines: lineCount
        };
        
        currentFiles = [...currentFiles, attached];
        setAttachedFiles(currentFiles);
        showToast(`✓ Attached: ${file.name}`);
      } catch (err) {
        showToast(`❌ Failed to read file: ${getErrorMessage(err)}`);
      }
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-full bg-black/60 font-mono overflow-hidden w-full min-w-0 relative">
      {/* Sidebar */}
      {sidebarOpen && (
        <div 
          ref={sidebarRef}
          onClick={(e) => e.stopPropagation()}
          style={{ width: `${sidebarWidth}px` }}
          className={`${aiChatLayoutMode === 'overlay' ? 'absolute left-0 top-0 bottom-0 z-30 border-r border-zinc-805 shadow-2xl h-full' : 'relative'} bg-black flex flex-col shrink-0 overflow-hidden`}
        >
          <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
            <h3 className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Chat Sessions</h3>
            <button onClick={createNewSession} className="text-zinc-400 hover:text-accent-amber transition-colors" title="New Session">
              <Plus size={14} />
            </button>
          </div>
          
          <div className="p-2 border-b border-zinc-900/80 bg-black shrink-0">
            <div className="relative flex items-center">
              <Search className="absolute left-2 text-zinc-600" size={12} />
              <input
                type="text"
                placeholder="Search Sessions..."
                value={sessionSearchQuery}
                onChange={(e) => setSessionSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded pl-7 pr-6 py-1 text-[11px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-accent-amber/50 transition-all uppercase"
              />
              {sessionSearchQuery && (
                <button
                  onClick={() => setSessionSearchQuery('')}
                  className="absolute right-2 text-zinc-500 hover:text-zinc-350 shrink-0"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {sessions
              .filter(s => s.title.toLowerCase().includes(sessionSearchQuery.toLowerCase()))
              .map(s => (
                <div 
                  key={s.id}
                  onClick={() => setCurrentSessionId(s.id)}
                  className={`group p-3 border-b border-zinc-900/50 flex justify-between items-center cursor-pointer transition-colors ${currentSessionId === s.id ? 'bg-zinc-800/50 border-l-2 border-l-accent-amber' : 'hover:bg-zinc-900'}`}
                >
                  {editingSessionId === s.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editSessionTitle}
                      onChange={(e) => setEditSessionTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameSession(s.id, editSessionTitle);
                        if (e.key === 'Escape') setEditingSessionId(null);
                      }}
                      onBlur={() => renameSession(s.id, editSessionTitle)}
                      className="flex-1 bg-black border border-zinc-700 text-xs text-zinc-200 px-1 py-0.5 outline-none"
                    />
                  ) : (
                    <div className="flex flex-col overflow-hidden mr-2">
                       <span className="text-xs text-zinc-300 truncate font-semibold">{s.title}</span>
                       <span className="text-[11px] text-zinc-650 font-mono mt-1 uppercase">{new Date(s.timestamp).toLocaleDateString()}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditSessionTitle(s.title);
                        setEditingSessionId(s.id);
                      }}
                      className="text-zinc-500 hover:text-accent-amber transition-colors p-1"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button 
                      onClick={(e) => deleteSession(s.id, e)}
                      className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-xs text-zinc-600 text-center mt-4 italic">No chat history</div>
            )}
          </div>
        </div>
      )}

      {sidebarOpen && (
        <div
          onMouseDown={handleMouseDown}
          className={`w-[3px] hover:w-[5px] bg-zinc-800 hover:bg-accent-amber/50 active:bg-accent-amber/80 cursor-col-resize transition-all h-full shrink-0 z-35 select-none ${aiChatLayoutMode === 'overlay' ? 'absolute top-0 bottom-0' : 'relative'}`}
          style={aiChatLayoutMode === 'overlay' ? { left: `${sidebarWidth}px` } : undefined}
          title="Drag to resize sidebar"
        />
      )}

      {/* Main Chat Area */}
      <div 
        className="flex-1 flex flex-col relative min-w-0"
        onClick={() => {
          if (aiChatLayoutMode === 'overlay') {
            if (sidebarOpen) setSidebarOpen(false);
            if (drawerOpen) setDrawerOpen(false);
          }
        }}
      >
        <div className="p-3 border-b border-border-wire bg-black/80 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSidebarOpen(!sidebarOpen);
              }}
              className="text-zinc-500 hover:text-accent-amber transition-colors"
            >
              <MessageSquare size={14} />
            </button>
            <span className="text-xs font-bold text-zinc-200 tracking-wider">TACTICAL_AI_LINK</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-650 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-widest">{getSessionModelName(sessionModel)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDrawerOpen(!drawerOpen);
              }}
              className={`p-1.5 rounded transition-all hover:bg-zinc-800/80 border ${drawerOpen ? 'bg-zinc-800 border-zinc-700 text-accent-amber' : 'border-transparent text-zinc-400 hover:text-white'}`}
              title="Session Settings"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>

        {!isOnline && (
          <div className="bg-red-950/30 border-b border-red-500/20 px-4 py-2 flex items-center gap-2 text-xs font-mono text-red-400 select-none tracking-widest uppercase animate-pulse shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
            <span>📡 OFFLINE: AI Chat & Voice PTT Unavailable</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 custom-scrollbar scroll-smooth w-full">
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-3 opacity-50">
              <MessageSquare size={32} />
              <div className="text-xs tracking-widest uppercase font-bold">Awaiting Input...</div>
            </div>
          )}
          
          {messages.filter(msg => {
            if (msg.role === 'tool') return false;
            if (msg.role === 'assistant' && (!msg.content || msg.content.trim() === '') && msg.tool_calls) return false;
            return true;
          }).map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300 w-full`}>
              <span className="text-[11px] text-zinc-600 mb-1.5 uppercase tracking-widest px-1 font-bold">
                {msg.role === 'user' ? 'OPERATOR' : 'VECTOR_AI'}
              </span>
              <div className={`p-3.5 rounded-sm text-xs font-mono w-fit max-w-[90%] min-w-0 shadow-lg relative select-text break-words overflow-hidden ${
                msg.role === 'user' 
                  ? 'bg-zinc-800/80 border-r-2 border-accent-amber text-zinc-100' 
                  : 'bg-black/60 border-l-2 border-accent-green text-zinc-300 shadow-[0_0_15px_rgba(74,246,38,0.05)]'
              }`}>
                {(() => {
                  const attachments = parseImagePath(msg.image_path);
                  if (!attachments) return null;
                  
                  return (
                    <div className="mb-3 space-y-2">
                      {attachments.image && (
                        <div className="p-2 bg-black/50 border border-white/5 rounded-sm flex items-center gap-2 text-[11px] text-accent-green/80 italic w-fit">
                          <Camera size={10} />
                          <span>[ VISION_BUFFER_ATTACHED ]</span>
                        </div>
                      )}
                      {attachments.files && attachments.files.map((file: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="bg-black/40 border border-zinc-800 rounded p-2 flex items-center gap-3 text-[11px] font-mono w-[240px]"
                        >
                          <Paperclip size={12} className="text-accent-amber" />
                          <div className="overflow-hidden flex flex-col flex-1">
                            <span className="text-zinc-300 font-bold truncate" title={file.name}>{file.name}</span>
                            <span className="text-zinc-650 text-[10px] uppercase">
                              {(file.size / 1024).toFixed(1)} KB | {file.lines} LINES
                            </span>
                          </div>
                          <span className="text-accent-green text-[10px] font-bold shrink-0 flex items-center gap-0.5 select-none">[✓ INJECTED]</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {msg.role === 'assistant' ? (
                  <div className="group/msg relative select-text w-full overflow-hidden">
                    <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed select-text w-full overflow-hidden">
                      <ReactMarkdown
                        components={{
                          h1({ children }) {
                            return (
                              <h1 className="text-xs font-bold text-white tracking-widest uppercase border-b border-zinc-800 pb-1.5 mb-3 mt-5 flex items-center gap-2 font-mono">
                                <span className="w-1.5 h-3 bg-accent-green inline-block animate-pulse"></span>
                                {children}
                              </h1>
                            );
                          },
                          h2({ children }) {
                            return (
                              <h2 className="text-xs font-bold text-zinc-200 tracking-wider uppercase border-b border-zinc-900 pb-1 mb-2.5 mt-4 flex items-center gap-1.5 font-mono">
                                <span className="w-1.5 h-2 bg-accent-amber inline-block"></span>
                                {children}
                              </h2>
                            );
                          },
                          h3({ children }) {
                            return (
                              <h3 className="text-xs font-bold text-zinc-400 tracking-wide uppercase mb-2 mt-3 flex items-center gap-1 font-mono">
                                <span className="text-accent-green select-none font-bold">//</span>
                                {children}
                              </h3>
                            );
                          },
                          strong({ children }) {
                            return (
                              <strong className="font-bold text-accent-green font-mono">
                                {children}
                              </strong>
                            );
                          },
                          em({ children }) {
                            return (
                              <em className="italic text-zinc-400 font-mono">
                                {children}
                              </em>
                            );
                          },
                          a({ href, children }) {
                            return (
                              <a 
                                href={href} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-accent-amber hover:text-accent-green underline cursor-pointer transition-colors font-mono font-bold"
                              >
                                {children}
                              </a>
                            );
                          },
                          pre({ children }) {
                            const codeText = getCodeText(children);
                            let lang = "CODE";
                            if (children && (children as any).props && (children as any).props.className) {
                              const match = /language-(\w+)/.exec((children as any).props.className || '');
                              if (match) lang = match[1].toUpperCase();
                            }
                            return (
                              <div className="my-3.5 rounded border border-zinc-800 bg-[#070707] shadow-xl max-w-full overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-zinc-900 text-xs text-zinc-500 font-mono tracking-widest select-none">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-amber animate-pulse"></span>
                                    <span>{lang}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(codeText.trim());
                                      showToast("📋 Code Copied");
                                    }}
                                    className="hover:text-accent-green transition-colors flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs"
                                  >
                                    <Copy size={10} /> Copy
                                  </button>
                                </div>
                                <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto custom-scrollbar whitespace-pre select-text bg-[#030303]/60">
                                  {children}
                                </pre>
                              </div>
                            );
                          },
                          code({ className, children, ...props }) {
                            const codeText = typeof children === 'string' ? children : getCodeText(children);
                            const isInline = !className && !codeText.includes('\n');
                            
                            let lang = "";
                            if (className) {
                              const match = /language-(\w+)/.exec(className || '');
                              if (match) lang = match[1];
                            }

                            if (!isInline) {
                              const highlighted = highlightCode(codeText, lang);
                              return (
                                <code 
                                  className="block text-zinc-300 font-mono text-xs select-text whitespace-pre overflow-x-auto"
                                  dangerouslySetInnerHTML={{ __html: highlighted }}
                                />
                              );
                            }
                            return (
                              <code className="px-1.5 py-0.5 rounded bg-zinc-900/80 border border-zinc-800 font-mono text-xs text-accent-amber font-semibold select-text" {...props}>
                                {children}
                              </code>
                            );
                          },
                          table({ children }) {
                            return (
                              <div className="overflow-x-auto my-3 border border-zinc-800 rounded-md w-full bg-black/40 shadow-inner">
                                <table className="min-w-full divide-y divide-zinc-800 text-xs font-mono">
                                  {children}
                                </table>
                              </div>
                            );
                          },
                          th({ children }) {
                            return (
                              <th className="px-3 py-2 bg-zinc-950 text-left text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 font-mono">
                                {children}
                              </th>
                            );
                          },
                          td({ children }) {
                            return (
                              <td className="px-3 py-1.5 text-zinc-300 border-b border-zinc-900/50 font-mono">
                                {children}
                              </td>
                            );
                          },
                          blockquote({ children }) {
                            return (
                              <blockquote className="border-l-2 border-accent-amber/70 pl-3.5 py-2 my-4 italic text-zinc-350 bg-accent-amber/5 rounded-r-md text-xs relative overflow-hidden font-mono shadow-[inset_0_0_10px_rgba(255,176,0,0.02)]">
                                <span className="absolute top-1 right-2 text-xs font-bold text-accent-amber/30 select-none tracking-widest uppercase font-mono">QUOTE</span>
                                {children}
                              </blockquote>
                            );
                          },
                          ul({ children }) {
                            return <ul className="my-3 space-y-1.5 pl-1 text-zinc-300 text-xs font-mono">{children}</ul>;
                          },
                          ol({ children }) {
                            return <ol className="my-3 space-y-1.5 pl-4 text-zinc-300 text-xs font-mono list-decimal">{children}</ol>;
                          },
                          li(props: any) {
                            const { ordered, children } = props;
                            if (ordered) {
                              return (
                                <li className="leading-relaxed text-xs text-zinc-350 font-mono pl-1">
                                  {children}
                                </li>
                              );
                            }
                            return (
                              <li className="flex items-start gap-2 leading-relaxed text-xs text-zinc-350 font-mono">
                                <span className="text-accent-green select-none font-bold mt-[1px]">›</span>
                                <div className="flex-1">{children}</div>
                              </li>
                            );
                          },
                          p({ children }) {
                            return <p className="mb-2.5 last:mb-0 leading-relaxed text-zinc-200/90 text-xs font-mono">{children}</p>;
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    <button
                      onClick={() => handleCopy(msg.content, idx)}
                      className="absolute top-0 right-0 opacity-0 group-hover/msg:opacity-100 p-1.5 bg-zinc-800 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all border border-white/10 shadow-sm z-10"
                      title="Copy message"
                    >
                      {copiedId === idx ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
                    </button>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed select-text break-words">{msg.content}</div>
                )}
                {msg.tokens && (
                  <div className="mt-2 text-xs text-zinc-500 font-mono italic flex justify-end">
                    [{msg.tokens} TOKENS USED]
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex flex-col items-start animate-in fade-in duration-300">
              <span className="text-[11px] text-zinc-600 mb-1.5 uppercase tracking-widest px-1 font-bold">VECTOR_AI</span>
              <div className="p-3 rounded-sm text-xs font-mono bg-black/60 border-l-2 border-accent-green/50 text-accent-green/70 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-accent-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-accent-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-1" />
        </div>

        <form onSubmit={handleSubmit} className="p-3 bg-black/80 border-t border-border-wire shrink-0">
          <input 
            type="file" 
            multiple 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          
          {/* Draft Files & Images Preview */}
          <div className="flex flex-col gap-2 mb-2">
            {draftImagePath && (
              <div className="relative w-24 h-16 rounded overflow-hidden border border-accent-amber/50 flex-shrink-0 group">
                <img src={draftImagePath} alt="Screen Buffer" className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => setDraftImagePath(null)}
                  className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
            
            {attachedFiles.length > 0 && (
              <div className="border border-accent-amber/35 bg-zinc-950/90 rounded p-2.5 mb-1 shadow-[inset_0_0_12px_rgba(255,176,0,0.06)] animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-zinc-800/80 text-[10px] font-mono text-zinc-500 font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-1.5 text-accent-amber">
                    <Paperclip size={10} className="animate-pulse" />
                    Attached Payload ({attachedFiles.length})
                  </span>
                  <button 
                    type="button" 
                    onClick={() => {
                      setAttachedFiles([]);
                      showToast("🗑️ Attached payload cleared");
                    }}
                    className="hover:text-red-400 text-zinc-650 transition-colors uppercase font-bold text-[10px]"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                  {attachedFiles.map((file, idx) => (
                    <div 
                      key={idx} 
                      className="bg-zinc-900/95 border border-accent-amber/45 hover:border-accent-amber/70 shadow-[0_0_8px_rgba(255,176,0,0.12)] rounded p-2 flex items-center justify-between gap-3 text-[11px] font-mono w-[220px] relative overflow-hidden transition-all group animate-in zoom-in-95 duration-200"
                    >
                      <span className="absolute top-0 left-0 w-[2px] h-full bg-accent-amber animate-pulse"></span>
                      <div className="overflow-hidden flex flex-col flex-1 pl-1.5">
                        <span className="text-zinc-200 font-bold truncate text-xs" title={file.name}>{file.name}</span>
                        <span className="text-zinc-500 text-[10px] uppercase font-mono mt-0.5">
                          {(file.size / 1024).toFixed(1)} KB | {file.lines} LINES
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFiles(attachedFiles.filter((_, i) => i !== idx));
                        }}
                        className="text-zinc-500 hover:text-red-400 p-1.5 rounded hover:bg-zinc-800 transition-colors shrink-0"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-2 relative">
            <button
              type="button"
              onClick={async () => {
                useShellStore.getState().setIgnoreFocusLoss(true);
                const restoreFocus = () => {
                  window.removeEventListener('focus', restoreFocus);
                  setTimeout(() => {
                    useShellStore.getState().setIgnoreFocusLoss(false);
                  }, 500);
                };
                window.addEventListener('focus', restoreFocus);
                
                try {
                  const paths = await invoke<string[]>('select_attached_files');
                  if (paths && paths.length > 0) {
                    let currentFiles = [...attachedFiles];
                    for (const filePath of paths) {
                      try {
                        showToast(`📄 Reading ${filePath.split(/[/\\]/).pop()}...`);
                        const fileData = await invoke<{
                          name: string;
                          path: string;
                          content: string;
                          size: number;
                          lines: number;
                        }>('read_attached_file_data', { path: filePath });
                        
                        const attached: AttachedFile = {
                          name: fileData.name,
                          path: fileData.path,
                          content: fileData.content,
                          size: fileData.size,
                          lines: fileData.lines
                        };
                        
                        currentFiles = [...currentFiles, attached];
                        setAttachedFiles(currentFiles);
                        showToast(`✓ Attached: ${fileData.name}`);
                      } catch (err) {
                        showToast(`❌ Failed to read file: ${getErrorMessage(err)}`);
                      }
                    }
                  }
                } catch (e) {
                  fileInputRef.current?.click();
                }
              }}
              disabled={isTyping || isRecordingMic || !isOnline}
              className="px-3 rounded-sm border border-zinc-700/50 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-all flex items-center justify-center relative"
              title="Attach documents/files (PDF, TXT, HTML)"
            >
              <Paperclip size={16} />
              {attachedFiles.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-amber text-[9px] font-bold text-black border border-black animate-pulse shadow-[0_0_8px_rgba(255,176,0,0.8)]">
                  {attachedFiles.length}
                </span>
              )}
            </button>
            
            <input
              type="text"
              value={isRecordingMic ? `🎙️ Listening... (${micSeconds}s)` : input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isRecordingMic || !isOnline}
              placeholder={!isOnline ? "CONNECTION OFFLINE" : isRecordingMic ? `Listening...` : "Enter command..."}
              className="flex-1 bg-zinc-900 border border-zinc-700/50 rounded-sm px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent-amber/50 focus:bg-zinc-800 transition-all placeholder:text-zinc-600 disabled:opacity-75 disabled:text-accent-amber"
            />
            <button
              type="button"
              onClick={handleMicClick}
              disabled={isTyping || !isOnline}
              className={`px-3 rounded-sm border transition-all flex items-center justify-center ${
                isRecordingMic
                  ? 'bg-red-500/20 border-red-500/50 text-red-500 animate-pulse'
                  : 'bg-zinc-900 border-zinc-700/50 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600'
              }`}
              title={isRecordingMic ? "Stop recording" : "Record voice"}
            >
              {isRecordingMic ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="submit"
              disabled={(!input.trim() && !draftImagePath && attachedFiles.length === 0) || isTyping || isRecordingMic || !isOnline}
              className="px-6 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber rounded-sm py-2 text-xs font-bold uppercase tracking-widest hover:bg-accent-amber hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          <button
            type="button"
            onClick={handleAnalyzeScreen}
            disabled={isTyping || !isOnline}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-sm py-2 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:border-zinc-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400 flex items-center justify-center gap-2"
          >
            <Camera size={12} />
            <span>Engage Vision Buffer</span>
          </button>
        </form>
      </div>

      {/* Settings Drawer Resizer & Panel */}
      {drawerOpen && (
        <>
          <div
            onMouseDown={handleDrawerMouseDown}
            className={`w-[3px] hover:w-[5px] bg-zinc-800 hover:bg-accent-amber/50 active:bg-accent-amber/80 cursor-col-resize transition-all h-full shrink-0 z-35 select-none ${aiChatLayoutMode === 'overlay' ? 'absolute top-0 bottom-0' : 'relative'}`}
            style={aiChatLayoutMode === 'overlay' ? { right: `${drawerWidth}px` } : undefined}
            title="Drag to resize settings drawer"
          />
          <div 
            ref={drawerRef}
            onClick={(e) => e.stopPropagation()}
            style={{ width: `${drawerWidth}px` }}
            className={`bg-zinc-950/95 border-l border-zinc-800 flex flex-col h-full shrink-0 overflow-hidden select-none ${aiChatLayoutMode === 'overlay' ? 'absolute right-0 top-0 bottom-0 z-30 shadow-2xl h-full' : 'relative'}`}
          >
            <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40 shrink-0">
              <span className="text-xs font-bold text-zinc-200 tracking-widest uppercase font-mono">Session settings</span>
              <button onClick={() => setDrawerOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 font-mono text-xs text-zinc-300">
              {/* Model Override Dropdown */}
              <div className="space-y-1 relative font-mono" ref={modelSelectRef} role="listbox" aria-label="Session Model">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Session Model</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                    className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-850/30 transition-all flex items-center justify-between cursor-pointer font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0 mr-2 flex-1">
                      {/* Provider LED status indicator */}
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        (sessionModel || getActiveModelDefault()).includes('gemini') ? 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.6)]' :
                        (sessionModel || getActiveModelDefault()).includes('claude') ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]' :
                        (sessionModel || getActiveModelDefault()).includes('gpt') ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' :
                        (sessionModel || getActiveModelDefault()).includes('deepseek') ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]' :
                        'bg-zinc-550'
                      }`} />
                      <div className="flex flex-col items-start gap-0.5 text-left overflow-hidden flex-1">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono leading-none">
                          {parseModelOption(getAvailableModels().find(m => m.value === (sessionModel || getActiveModelDefault())) || { value: '', label: 'Unknown Model' }).provider}
                        </span>
                        <span className="text-zinc-200 font-bold truncate w-full leading-none">
                          {parseModelOption(getAvailableModels().find(m => m.value === (sessionModel || getActiveModelDefault())) || { value: '', label: 'Unknown Model' }).name}
                        </span>
                      </div>
                    </div>
                    <ChevronDown size={14} className={`text-zinc-500 transition-transform shrink-0 ${isModelSelectOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isModelSelectOpen && (
                    <div className="absolute left-0 right-0 mt-1 bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl z-40 max-h-[320px] flex flex-col overflow-hidden animate-fadeIn w-full">
                      {/* Search bar inside dropdown */}
                      <div className="p-2 border-b border-zinc-800 bg-zinc-900/40 flex items-center gap-2 shrink-0">
                        <Search size={12} className="text-zinc-550" />
                        <input
                          type="text"
                          placeholder="Search models..."
                          value={modelSearchQuery}
                          onChange={(e) => setModelSearchQuery(e.target.value)}
                          className="w-full bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-650 font-mono"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {modelSearchQuery && (
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setModelSearchQuery(''); }} 
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>

                      {/* Model options list grouped by provider */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-2">
                        {(() => {
                          const filtered = getAvailableModels()
                            .map(m => parseModelOption(m))
                            .filter(m => 
                              m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || 
                              m.provider.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
                              m.tags.some(t => t.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                            );

                          if (filtered.length === 0) {
                            return <div className="text-center italic text-xs text-zinc-600 py-4 font-mono">No matching models</div>;
                          }

                          // Group by provider
                          const groups: Record<string, typeof filtered> = {};
                          filtered.forEach(m => {
                            const prov = m.provider || 'Other';
                            if (!groups[prov]) groups[prov] = [];
                            groups[prov].push(m);
                          });

                           const providerOrder = [
                            'System Default',
                            'OpenAI (Direct)',
                            'Anthropic (Direct)',
                            'Groq (Direct)',
                            'OpenRouter'
                          ];

                          const sortedProviders = Object.keys(groups).sort((a, b) => {
                            const idxA = providerOrder.findIndex(p => a.includes(p));
                            const idxB = providerOrder.findIndex(p => b.includes(p));
                            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                            if (idxA !== -1) return -1;
                            if (idxB !== -1) return 1;
                            return a.localeCompare(b);
                          });

                          return sortedProviders.map((provider) => (
                            <div key={provider} className="space-y-1">
                              <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest px-2 py-0.5 border-b border-zinc-900 bg-zinc-950/20 font-mono">
                                {provider}
                              </div>
                              <div className="space-y-1 pl-0.5">
                                {groups[provider].map((m) => {
                                  const isSelected = m.value === sessionModel;
                                  return (
                                    <button
                                      key={m.value}
                                      type="button"
                                      onClick={() => {
                                        const newModel = m.value;
                                        setSessionModel(newModel);
                                        const modelDefaults = getModelDefaultSettings(newModel);
                                        const newSettings = {
                                          ...sessionSettings,
                                          temperature: modelDefaults.temperature,
                                          maxTokens: modelDefaults.maxTokens,
                                          contextSize: modelDefaults.contextSize,
                                          topK: modelDefaults.topK,
                                          topP: modelDefaults.topP,
                                          systemPrompt: masterDefaults.systemPrompt,
                                          personality: masterDefaults.personality
                                        };
                                        setSessionSettings(newSettings);
                                        saveSessionSettings(currentSessionId, newSettings, newModel);
                                        setIsModelSelectOpen(false);
                                        setModelSearchQuery('');
                                        showToast(`🤖 Switched session model to: ${m.name}`);
                                      }}
                                      className={`w-full text-left p-2 rounded border transition-all flex flex-col gap-1 cursor-pointer relative ${
                                        isSelected 
                                          ? 'bg-accent-amber/10 border-accent-amber/30 text-white pl-3.5 shadow-[0_0_10px_rgba(255,176,0,0.05)] font-bold' 
                                          : 'hover:bg-zinc-900 border-transparent hover:border-zinc-800 text-zinc-400 hover:text-zinc-200 pl-3.5'
                                      }`}
                                    >
                                      {/* Selection Indicator Accent Bar */}
                                      <div className={`absolute left-1.5 top-2.5 bottom-2.5 w-0.5 rounded-full ${
                                        isSelected 
                                          ? 'bg-accent-amber shadow-[0_0_8px_rgba(255,176,0,0.6)] animate-pulse' 
                                          : 'bg-zinc-700/40 group-hover:bg-zinc-500'
                                      }`} />

                                      <div className="font-bold text-xs font-mono">{m.name}</div>
                                      
                                      {m.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {m.tags.map((tag) => {
                                            let tagColor = 'bg-zinc-900/40 text-zinc-500 border-zinc-800/40';
                                            if (tag.toLowerCase().includes('vision')) tagColor = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
                                            if (tag.toLowerCase().includes('actions')) tagColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                                            if (tag.toLowerCase().includes('attachments')) tagColor = 'bg-violet-500/10 text-violet-400 border-violet-500/30';
                                            if (tag.toLowerCase().includes('mcp')) tagColor = 'bg-accent-green/10 text-accent-green border-accent-green/30';
                                            if (tag.toLowerCase().includes('thinking')) tagColor = 'bg-pink-500/10 text-pink-400 border-pink-500/30';
                                            if (tag.toLowerCase().includes('search')) tagColor = 'bg-teal-500/10 text-teal-400 border-teal-500/30';
                                            if (tag.toLowerCase().includes('global')) tagColor = 'bg-primary/10 text-primary border-primary/30';
                                            
                                            return (
                                              <span 
                                                key={tag} 
                                                className={`text-[8px] font-bold uppercase px-1 py-0.2 rounded border font-mono ${tagColor}`}
                                              >
                                                {tag.replace('File ', '')}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>


              {/* Temperature */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-zinc-500 uppercase">
                  <span>Temperature</span>
                  <span className="text-accent-amber font-bold">{sessionSettings.temperature.toFixed(1)}</span>
                </div>
                <input 
                  type="range" min="0" max="2" step="0.1"
                  value={sessionSettings.temperature}
                  onChange={(e) => {
                     const newSettings = { ...sessionSettings, temperature: parseFloat(e.target.value) };
                     setSessionSettings(newSettings);
                     saveSessionSettings(currentSessionId, newSettings, sessionModel);
                  }}
                  className="w-full accent-accent-amber cursor-pointer bg-zinc-900 h-1 rounded"
                />
              </div>

              {/* Max Tokens */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-zinc-500 uppercase">
                  <span>Max Output Tokens</span>
                  <span className="text-accent-amber font-bold">
                    {sessionSettings.maxTokens === 0 ? "LIMITLESS" : sessionSettings.maxTokens}
                  </span>
                </div>
                <input 
                  type="range" min="0" max="8192" step="128"
                  value={sessionSettings.maxTokens}
                  onChange={(e) => {
                     const newSettings = { ...sessionSettings, maxTokens: parseInt(e.target.value) };
                     setSessionSettings(newSettings);
                     saveSessionSettings(currentSessionId, newSettings, sessionModel);
                  }}
                  className="w-full accent-accent-amber cursor-pointer bg-zinc-900 h-1 rounded"
                />
              </div>

              {/* Context Size */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs text-zinc-500 uppercase">
                  <span>Context Budget</span>
                  <span className="text-accent-amber font-bold">{sessionSettings.contextSize} TK</span>
                </div>
                <input 
                  type="range" min="1024" max="128000" step="1024"
                  value={sessionSettings.contextSize}
                  onChange={(e) => {
                     const newSettings = { ...sessionSettings, contextSize: parseInt(e.target.value) };
                     setSessionSettings(newSettings);
                     saveSessionSettings(currentSessionId, newSettings, sessionModel);
                  }}
                  className="w-full accent-accent-amber cursor-pointer bg-zinc-900 h-1 rounded"
                />
              </div>

              {/* Top-P and Top-K */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs text-zinc-500 uppercase">
                    <span>Top-P</span>
                    <span className="text-accent-amber font-bold">{sessionSettings.topP.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={sessionSettings.topP}
                    onChange={(e) => {
                       const newSettings = { ...sessionSettings, topP: parseFloat(e.target.value) };
                       setSessionSettings(newSettings);
                       saveSessionSettings(currentSessionId, newSettings, sessionModel);
                    }}
                    className="w-full accent-accent-amber cursor-pointer bg-zinc-900 h-1 rounded"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs text-zinc-500 uppercase">
                    <span>Top-K</span>
                    <span className="text-accent-amber font-bold">{sessionSettings.topK}</span>
                  </div>
                  <input 
                    type="range" min="1" max="100" step="1"
                    value={sessionSettings.topK}
                    onChange={(e) => {
                       const newSettings = { ...sessionSettings, topK: parseInt(e.target.value) };
                       setSessionSettings(newSettings);
                       saveSessionSettings(currentSessionId, newSettings, sessionModel);
                    }}
                    className="w-full accent-accent-amber cursor-pointer bg-zinc-900 h-1 rounded"
                  />
                </div>
              </div>

              {/* Token Ammo Gauge */}
              {(() => {
                const estimateTokens = () => {
                  let charCount = 0;
                  messages.forEach(msg => {
                    charCount += (msg.content || '').length;
                    const attachments = parseImagePath(msg.image_path);
                    if (attachments) {
                      if (attachments.image) charCount += 4000;
                      if (attachments.files) {
                        attachments.files.forEach((f: any) => {
                          charCount += (f.content || '').length;
                        });
                      }
                    }
                  });
                  attachedFiles.forEach(file => {
                    charCount += (file.content || '').length;
                  });
                  return Math.round(charCount / 4);
                };
                const used = estimateTokens();
                const percentage = Math.min(100, (used / sessionSettings.contextSize) * 100);
                
                return (
                  <div className="space-y-1.5 border-t border-zinc-900 pt-3">
                    <div className="flex justify-between items-center text-xs text-zinc-550">
                      <span>Token Ammo Gauge</span>
                      <span className="text-accent-green font-bold">{used} / {sessionSettings.contextSize} TK</span>
                    </div>
                    <div className="h-2.5 bg-zinc-950 border border-zinc-800 rounded p-[1px] flex gap-[2px] overflow-hidden">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const threshold = (idx + 1) * 10;
                        const isFilled = percentage >= threshold;
                        let color = 'bg-zinc-850';
                        if (isFilled) {
                          if (threshold > 80) color = 'bg-red-500';
                          else if (threshold > 50) color = 'bg-accent-amber';
                          else color = 'bg-accent-green';
                        }
                        return (
                          <div 
                            key={idx} 
                            className={`flex-1 h-full rounded-sm transition-all duration-300 ${color}`}
                            style={{ opacity: isFilled ? 1 : 0.15 }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-1 border-t border-zinc-900 pt-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">System Prompt Template</label>
                <select
                  value={
                    Object.entries(SYSTEM_PROMPT_TEMPLATES).find(([_, temp]) => temp.text === sessionSettings.systemPrompt)?.[0] ||
                    customSystemPrompts?.find(p => p.text === sessionSettings.systemPrompt)?.id ||
                    'custom'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    let nextPrompt = sessionSettings.systemPrompt;
                    if (val in SYSTEM_PROMPT_TEMPLATES) {
                      nextPrompt = SYSTEM_PROMPT_TEMPLATES[val as keyof typeof SYSTEM_PROMPT_TEMPLATES].text;
                    } else {
                      const matchedCustom = customSystemPrompts?.find(p => p.id === val);
                      if (matchedCustom) {
                        nextPrompt = matchedCustom.text;
                      }
                    }
                    const newSettings = { ...sessionSettings, systemPrompt: nextPrompt };
                    setSessionSettings(newSettings);
                    saveSessionSettings(currentSessionId, newSettings, sessionModel);
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 cursor-pointer font-mono"
                >
                  <option value="custom">CUSTOM PROMPT</option>
                  {Object.entries(SYSTEM_PROMPT_TEMPLATES)
                    .filter(([key]) => key !== 'custom')
                    .map(([key, value]) => (
                      <option key={key} value={key}>{value.name.toUpperCase()}</option>
                    ))
                  }
                  {customSystemPrompts && customSystemPrompts.length > 0 && (
                    <optgroup label="MY SAVED TEMPLATES">
                      {customSystemPrompts.map(p => (
                        <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                
                <textarea
                  value={sessionSettings.systemPrompt}
                  onChange={(e) => {
                    const newSettings = { ...sessionSettings, systemPrompt: e.target.value };
                    setSessionSettings(newSettings);
                    saveSessionSettings(currentSessionId, newSettings, sessionModel);
                  }}
                  placeholder="Enter custom instructions..."
                  className="w-full bg-black/40 border border-zinc-800 rounded px-2.5 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent-amber/50 resize-y min-h-[100px] mt-1"
                />
              </div>
 
              {/* AI Personality Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">AI Response Tone</label>
                <select
                  value={sessionSettings.personality}
                  onChange={(e) => {
                    const val = e.target.value;
                    let nextToneInstructions = "";
                    if (val in PERSONALITY_PROMPTS) {
                      nextToneInstructions = PERSONALITY_PROMPTS[val as keyof typeof PERSONALITY_PROMPTS];
                    } else {
                      const matched = customTones?.find(t => t.id === val);
                      if (matched) nextToneInstructions = matched.text;
                    }
                    const newSettings = { 
                      ...sessionSettings, 
                      personality: val,
                      personalityPrompt: nextToneInstructions 
                    };
                    setSessionSettings(newSettings);
                    saveSessionSettings(currentSessionId, newSettings, sessionModel);
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 cursor-pointer font-mono"
                >
                  <option value="default">DEFAULT NEUTRAL</option>
                  <option value="tactical">TACTICAL OFFICER</option>
                  <option value="copilot">GRITTY COPILOT</option>
                  <option value="operator">SARCASTIC OPERATOR</option>
                  <option value="scientific">DRY SCIENTIFIC ADVISOR</option>
                  {customTones && customTones.length > 0 && (
                    <optgroup label="MY SAVED TONES">
                      {customTones.map(t => (
                        <option key={t.id} value={t.id}>{t.name.toUpperCase()}</option>
                      ))}
                    </optgroup>
                  )}
                </select>

                <textarea
                  value={sessionSettings.personalityPrompt ?? ""}
                  onChange={(e) => {
                    const newSettings = { ...sessionSettings, personalityPrompt: e.target.value };
                    setSessionSettings(newSettings);
                    saveSessionSettings(currentSessionId, newSettings, sessionModel);
                  }}
                  placeholder="Custom tone instructions..."
                  className="w-full bg-black/40 border border-zinc-800 rounded px-2.5 py-1.5 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent-amber/50 resize-y min-h-[100px] mt-1"
                />
              </div>

              {/* Active Skills Checklist */}
              <div className="space-y-2 border-t border-zinc-900 pt-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Active HUD Skills</label>
                
                {/* System Controller */}
                <div className="bg-zinc-950 border border-zinc-900 p-2 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300 text-xs">SYSTEM CONTROLLER</span>
                    <input
                      type="checkbox"
                      checked={sessionSettings.activeSkills.systemController}
                      onChange={(e) => {
                        const newSettings = {
                          ...sessionSettings,
                          activeSkills: { ...sessionSettings.activeSkills, systemController: e.target.checked }
                        };
                        setSessionSettings(newSettings);
                        saveSessionSettings(currentSessionId, newSettings, sessionModel);
                      }}
                      className="accent-accent-amber"
                    />
                  </div>
                  <span className="text-xs text-zinc-650">Controls PC audio volumes, media playback track, stopwatch, timers, and telemetry statistics.</span>
                </div>

                {/* GitHub Scan */}
                <div className="bg-zinc-950 border border-zinc-900 p-2 rounded flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300 text-xs">GITHUB SCAN</span>
                    <input
                      type="checkbox"
                      checked={sessionSettings.activeSkills.githubScan}
                      onChange={(e) => {
                        const newSettings = {
                          ...sessionSettings,
                          activeSkills: { ...sessionSettings.activeSkills, githubScan: e.target.checked }
                        };
                        setSessionSettings(newSettings);
                        saveSessionSettings(currentSessionId, newSettings, sessionModel);
                      }}
                      className="accent-accent-amber"
                    />
                  </div>
                  <span className="text-xs text-zinc-650">Enables scanning repository commits, monitoring issue lists, and tracking pull requests.</span>
                  {sessionSettings.activeSkills.githubScan && (
                    <div className="border border-zinc-800 bg-black/50 p-1.5 rounded text-xs text-zinc-400 space-y-1">
                      <span className="text-accent-amber block font-bold">⚠️ REQUIRES REPO PERMISSION KEYS</span>
                      <button
                        type="button"
                        onClick={() => toggleSettings()}
                        className="w-full text-center bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 py-1.5 text-xs font-bold text-accent-amber tracking-wider uppercase rounded"
                      >
                        Navigate to Credentials
                      </button>
                    </div>
                  )}
                </div>

                {/* Web Search */}
                <div className="bg-zinc-950 border border-zinc-900 p-2 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300 text-xs">WEB SEARCH</span>
                    <input
                      type="checkbox"
                      checked={sessionSettings.activeSkills.webSearch}
                      onChange={(e) => {
                        const newSettings = {
                          ...sessionSettings,
                          activeSkills: { ...sessionSettings.activeSkills, webSearch: e.target.checked }
                        };
                        setSessionSettings(newSettings);
                        saveSessionSettings(currentSessionId, newSettings, sessionModel);
                      }}
                      className="accent-accent-amber"
                    />
                  </div>
                  <span className="text-xs text-zinc-650">Accesses external search tools to pull real-time weather, market indexes, or live documentation.</span>
                </div>

                {/* Anthropic Search */}
                <div className="bg-zinc-950 border border-zinc-900 p-2 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300 text-xs">ANTHROPIC SEARCH</span>
                    <input
                      type="checkbox"
                      checked={sessionSettings.activeSkills.anthropicSearch}
                      onChange={(e) => {
                        const newSettings = {
                          ...sessionSettings,
                          activeSkills: { ...sessionSettings.activeSkills, anthropicSearch: e.target.checked }
                        };
                        setSessionSettings(newSettings);
                        saveSessionSettings(currentSessionId, newSettings, sessionModel);
                      }}
                      className="accent-accent-amber"
                    />
                  </div>
                  <span className="text-xs text-zinc-650">Use Anthropic web tools integration when utilizing Claude provider models.</span>
                </div>
              </div>

               {/* User Custom Skills */}
              <div className="space-y-2 border-t border-zinc-900 pt-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">User Custom Skills</label>
                  <button
                    type="button"
                    onClick={() => setShowAddSkillForm(!showAddSkillForm)}
                    className="text-accent-amber hover:text-white transition-colors text-xs uppercase font-bold flex items-center gap-1"
                  >
                    <Plus size={10} /> {showAddSkillForm ? 'Close' : 'Add'}
                  </button>
                </div>

                {showAddSkillForm && (
                  <div className="bg-zinc-900/60 border border-accent-amber/30 rounded p-2.5 space-y-2.5 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500 font-bold uppercase">Skill Name</label>
                      <input
                        type="text"
                        placeholder="E.G. NOTION_ASSISTANT"
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                        className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500 font-bold uppercase">Description</label>
                      <input
                        type="text"
                        placeholder="E.G. Directs AI to summarize databases..."
                        value={newSkillDesc}
                        onChange={(e) => setNewSkillDesc(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-zinc-500 font-bold uppercase">System Prompt Instructions</label>
                      <textarea
                        rows={3}
                        placeholder="Instructions for the AI..."
                        value={newSkillInst}
                        onChange={(e) => setNewSkillInst(e.target.value)}
                        className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 font-mono resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!newSkillName.trim()) {
                            showToast("⚠️ Skill Name is required");
                            return;
                          }
                          if (!newSkillInst.trim()) {
                            showToast("⚠️ Instructions are required");
                            return;
                          }
                          const newSkill: CustomSkill = {
                            id: 'skill_' + Date.now(),
                            name: newSkillName.trim(),
                            description: newSkillDesc.trim(),
                            instructions: newSkillInst.trim(),
                            isActive: true
                          };
                          const updatedSkills = [...(sessionSettings.customSkills || []), newSkill];
                          const nextSettings = { ...sessionSettings, customSkills: updatedSkills };
                          setSessionSettings(nextSettings);
                          saveSessionSettings(currentSessionId, nextSettings, sessionModel);
                          
                          // Reset form
                          setNewSkillName('');
                          setNewSkillDesc('');
                          setNewSkillInst('');
                          setShowAddSkillForm(false);
                          showToast(`✓ Custom Skill "${newSkill.name}" Added`);
                        }}
                        className="flex-1 bg-accent-amber/15 border border-accent-amber/35 hover:bg-accent-amber hover:text-black py-1 text-xs font-bold text-accent-amber uppercase tracking-wider rounded transition-colors"
                      >
                        Save Skill
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddSkillForm(false)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 py-1 text-xs font-bold text-zinc-400 uppercase tracking-wider rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {sessionSettings.customSkills && sessionSettings.customSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className={`bg-zinc-950/80 border p-2 rounded flex flex-col gap-1.5 transition-all ${
                        skill.isActive
                          ? 'border-accent-green/45 shadow-[0_0_8px_rgba(74,246,38,0.06)]'
                          : 'border-zinc-900 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={skill.isActive}
                              onChange={(e) => {
                                const updatedSkills = sessionSettings.customSkills.map(s =>
                                  s.id === skill.id ? { ...s, isActive: e.target.checked } : s
                                );
                                const nextSettings = { ...sessionSettings, customSkills: updatedSkills };
                                setSessionSettings(nextSettings);
                                saveSessionSettings(currentSessionId, nextSettings, sessionModel);
                              }}
                              className="accent-accent-green cursor-pointer h-3.5 w-3.5 rounded border-zinc-800 bg-zinc-900"
                            />
                            <span 
                              className="font-bold text-zinc-200 text-xs truncate font-mono uppercase tracking-wider cursor-pointer flex-1" 
                              title={skill.name}
                              onClick={() => {
                                const updatedSkills = sessionSettings.customSkills.map(s =>
                                  s.id === skill.id ? { ...s, isActive: !s.isActive } : s
                                );
                                const nextSettings = { ...sessionSettings, customSkills: updatedSkills };
                                setSessionSettings(nextSettings);
                                saveSessionSettings(currentSessionId, nextSettings, sessionModel);
                              }}
                            >
                              {skill.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedSkillId(expandedSkillId === skill.id ? null : skill.id);
                                if (confirmDeleteSkillId === skill.id) setConfirmDeleteSkillId(null);
                              }}
                              className={`p-1 rounded text-zinc-400 hover:text-accent-amber hover:bg-zinc-900 transition-all ${expandedSkillId === skill.id ? 'bg-zinc-900 text-accent-amber' : ''}`}
                              title="Toggle skill instructions"
                            >
                              <Info size={12} />
                            </button>
                            
                            {confirmDeleteSkillId === skill.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const updatedSkills = sessionSettings.customSkills.filter(s => s.id !== skill.id);
                                  const nextSettings = { ...sessionSettings, customSkills: updatedSkills };
                                  setSessionSettings(nextSettings);
                                  saveSessionSettings(currentSessionId, nextSettings, sessionModel);
                                  showToast(`🗑️ Skill "${skill.name}" Deleted`);
                                  setConfirmDeleteSkillId(null);
                                }}
                                className="bg-red-950/80 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors animate-pulse"
                              >
                                SURE?
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSkillId(skill.id)}
                                className="text-zinc-605 hover:text-red-400 p-1 hover:bg-zinc-900 rounded transition-colors"
                                title="Delete custom skill"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        {skill.description && (
                          <div className="text-[11px] text-zinc-500 font-sans pl-[22px] truncate" title={skill.description}>
                            {skill.description}
                          </div>
                        )}
                      </div>

                      {/* Expandable Box */}
                      {expandedSkillId === skill.id && (
                        <div className="border-t border-zinc-900/60 pt-2 mt-1 space-y-1.5 animate-in fade-in duration-200 w-full min-w-0">
                          <div className="bg-black/50 border border-zinc-900 rounded p-3 text-zinc-300 font-mono text-[13px] whitespace-pre-wrap min-h-[140px] max-h-[400px] overflow-auto resize-y custom-scrollbar leading-relaxed w-full block">
                            <div className="text-[10px] text-zinc-400 uppercase font-bold border-b border-zinc-900/60 pb-1 mb-2 font-mono tracking-wider shrink-0 select-none">Instructions / System Prompt</div>
                            <div className="font-mono text-[13px] text-zinc-100 select-text leading-relaxed whitespace-pre-wrap break-words">
                              {skill.instructions}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {(!sessionSettings.customSkills || sessionSettings.customSkills.length === 0) && (
                    <div className="text-xs text-zinc-600 italic text-center py-2">No custom skills defined.</div>
                  )}
                </div>
              </div>

              {/* User Custom MCP Connections */}
              <div className="space-y-2 border-t border-zinc-900 pt-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">User Custom MCPs</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMcpForm(!showAddMcpForm);
                      setNewMcpTools([]);
                    }}
                    className="text-accent-amber hover:text-white transition-colors text-xs uppercase font-bold flex items-center gap-1"
                  >
                    <Plus size={10} /> {showAddMcpForm ? 'Close' : 'Add'}
                  </button>
                </div>

                {showAddMcpForm && (
                  <div className="bg-zinc-900/60 border border-accent-amber/30 rounded p-2.5 space-y-2.5 animate-in slide-in-from-top-1 duration-200 max-h-[350px] overflow-y-auto custom-scrollbar">
                    {/* Mode Selector */}
                    <div className="flex gap-2 p-0.5 bg-black/40 border border-white/5 rounded w-fit shrink-0">
                      <button
                        type="button"
                        onClick={() => setDrawerMcpInputMode('fields')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                          drawerMcpInputMode === 'fields'
                            ? 'bg-accent-amber/20 text-accent-amber border border-accent-amber/30 font-bold'
                            : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                        }`}
                      >
                        Fields
                      </button>
                      <button
                        type="button"
                        onClick={() => setDrawerMcpInputMode('json')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                          drawerMcpInputMode === 'json'
                            ? 'bg-accent-amber/20 text-accent-amber border border-accent-amber/30 font-bold'
                            : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                        }`}
                      >
                        JSON Config
                      </button>
                    </div>

                    {drawerMcpInputMode === 'json' ? (
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase font-mono">MCP Configuration JSON</label>
                        <textarea
                          rows={5}
                          placeholder={`Paste JSON configuration.\nExample:\n{\n  "command": "node",\n  "args": ["server.js"]\n}`}
                          value={drawerMcpJsonInput}
                          onChange={(e) => setDrawerMcpJsonInput(e.target.value)}
                          className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 font-mono resize-y min-h-[100px]"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500 font-bold uppercase">Server Name</label>
                          <input
                            type="text"
                            placeholder="E.G. SQLITE_EXPLORER"
                            value={newMcpName}
                            onChange={(e) => setNewMcpName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                            className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500 font-bold uppercase">Description</label>
                          <input
                            type="text"
                            placeholder="E.G. Local DB Explorer..."
                            value={newMcpDesc}
                            onChange={(e) => setNewMcpDesc(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 font-mono"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <div className="space-y-1">
                            <label className="text-xs text-zinc-500 font-bold uppercase">Command</label>
                            <input
                              type="text"
                              placeholder="node / npx"
                              value={newMcpCmd}
                              onChange={(e) => setNewMcpCmd(e.target.value)}
                              className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-zinc-500 font-bold uppercase">Arguments</label>
                            <input
                              type="text"
                              placeholder="e.g. index.js"
                              value={newMcpArgs}
                              onChange={(e) => setNewMcpArgs(e.target.value)}
                              className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-zinc-500 font-bold uppercase">Environment variables</label>
                          <input
                            type="text"
                            placeholder="E.G. KEY=val,PORT=3000"
                            value={newMcpEnv}
                            onChange={(e) => setNewMcpEnv(e.target.value)}
                            className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 font-mono"
                          />
                        </div>
                      </>
                    )}

                    {/* Subform: Adding Tools */}
                    <div className="border border-zinc-800 bg-black/40 p-2 rounded space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-400 font-bold uppercase">Server Tools ({newMcpTools.length})</span>
                        <button
                          type="button"
                          onClick={() => setShowAddToolForm(!showAddToolForm)}
                          className="text-accent-green hover:underline text-xs font-bold uppercase"
                        >
                          {showAddToolForm ? 'Hide' : '+ Add Tool'}
                        </button>
                      </div>

                      {showAddToolForm && (
                        <div className="space-y-2 border-t border-zinc-900 pt-2">
                          <input
                            type="text"
                            placeholder="TOOL_NAME"
                            value={newToolName}
                            onChange={(e) => setNewToolName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-200 font-mono"
                          />
                          <input
                            type="text"
                            placeholder="TOOL_DESCRIPTION"
                            value={newToolDesc}
                            onChange={(e) => setNewToolDesc(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-xs text-zinc-200 font-mono"
                          />
                          <textarea
                            rows={3}
                            placeholder="PARAMETERS SCHEMA JSON"
                            value={newToolParams}
                            onChange={(e) => setNewToolParams(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-350 font-mono resize-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newToolName.trim()) {
                                showToast("⚠️ Tool Name is required");
                                return;
                              }
                              let parsedParams = {};
                              try {
                                parsedParams = JSON.parse(newToolParams);
                              } catch (err) {
                                showToast("⚠️ Invalid parameters JSON");
                                return;
                              }
                              const newTool: CustomMcpTool = {
                                name: newToolName.trim(),
                                description: newToolDesc.trim(),
                                parameters: parsedParams
                              };
                              setNewMcpTools([...newMcpTools, newTool]);
                              setNewToolName('');
                              setNewToolDesc('');
                              setNewToolParams('{\n  "type": "object",\n  "properties": {}\n}');
                              setShowAddToolForm(false);
                              showToast(`✓ Tool "${newTool.name}" added to server config`);
                            }}
                            className="w-full bg-accent-green/10 border border-accent-green/30 hover:bg-accent-green hover:text-black py-1 text-xs font-bold text-accent-green uppercase tracking-wider rounded"
                          >
                            Add Tool to Config
                          </button>
                        </div>
                      )}

                      <div className="space-y-1">
                        {newMcpTools.map((t, index) => (
                          <div key={index} className="flex justify-between items-center text-xs font-mono bg-zinc-950 p-1 rounded text-zinc-400">
                            <span className="font-bold truncate text-xs">{t.name}</span>
                            <button
                              type="button"
                              onClick={() => setNewMcpTools(newMcpTools.filter((_, idx) => idx !== index))}
                              className="text-red-400 hover:text-red-500 font-bold px-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          let name = '';
                           let command = '';
                           let args = '';
                           let env = '';
                           let description = '';
                           let tools = newMcpTools;

                           if (drawerMcpInputMode === 'json') {
                             if (!drawerMcpJsonInput.trim()) {
                               showToast("⚠️ Paste MCP JSON configuration first");
                               return;
                             }
                             try {
                               const parsed = parseMcpJson(drawerMcpJsonInput);
                               name = parsed.name;
                               command = parsed.command;
                               args = parsed.args;
                               env = parsed.env;
                               description = parsed.description;
                               if (parsed.tools && parsed.tools.length > 0) {
                                 tools = [...parsed.tools, ...newMcpTools];
                               }
                             } catch (e: any) {
                               showToast(`⚠️ JSON parse error: ${e.message}`);
                               return;
                             }
                           } else {
                             if (!newMcpName.trim()) {
                               showToast("⚠️ Server Name is required");
                               return;
                             }
                             if (!newMcpCmd.trim()) {
                               showToast("⚠️ Execution Command is required");
                               return;
                             }
                             name = newMcpName.trim();
                             command = newMcpCmd.trim();
                             args = newMcpArgs.trim();
                             env = newMcpEnv.trim();
                             description = newMcpDesc.trim();
                           }

                           const newMcp: CustomMcp = {
                             id: 'mcp_' + Date.now(),
                             name,
                             description,
                             command,
                             args,
                             env,
                             isActive: true,
                             tools
                           };
                          const updatedMcps = [...(sessionSettings.customMcps || []), newMcp];
                          const nextSettings = { ...sessionSettings, customMcps: updatedMcps };
                          setSessionSettings(nextSettings);
                          saveSessionSettings(currentSessionId, nextSettings, sessionModel);

                          // Reset form
                          setNewMcpName('');
                          setNewMcpDesc('');
                          setNewMcpCmd('');
                          setNewMcpArgs('');
                          setNewMcpEnv('');
                          setNewMcpTools([]);
                          setDrawerMcpJsonInput('');
                          setShowAddMcpForm(false);
                          showToast(`✓ MCP Server "${newMcp.name}" Added`);
                        }}
                        className="flex-1 bg-accent-amber/15 border border-accent-amber/35 hover:bg-accent-amber hover:text-black py-1 text-xs font-bold text-accent-amber uppercase tracking-wider rounded transition-colors"
                      >
                        Save Config
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddMcpForm(false)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 py-1 text-xs font-bold text-zinc-400 uppercase tracking-wider rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                  {sessionSettings.customMcps && sessionSettings.customMcps.map((mcp) => (
                    <div
                      key={mcp.id}
                      className={`bg-zinc-950/80 border p-2 rounded flex flex-col gap-1.5 transition-all ${
                        mcp.isActive
                          ? 'border-accent-green/45 shadow-[0_0_8px_rgba(74,246,38,0.06)]'
                          : 'border-zinc-900 hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Pulse status indicator */}
                          <div 
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              mcpStatuses[mcp.id] === 'online'
                                ? 'bg-accent-green animate-pulse shadow-[0_0_8px_rgba(74,246,38,0.6)]'
                                : mcpStatuses[mcp.id] === 'testing'
                                ? 'bg-accent-amber animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                                : mcpStatuses[mcp.id] === 'offline'
                                ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                                : 'bg-zinc-650'
                            }`}
                            title={`Status: ${mcpStatuses[mcp.id] || 'unknown'}`}
                          />
                          
                          <input
                            type="checkbox"
                            checked={mcp.isActive}
                            onChange={(e) => {
                              const updatedMcps = sessionSettings.customMcps.map(m =>
                                m.id === mcp.id ? { ...m, isActive: e.target.checked } : m
                              );
                              const nextSettings = { ...sessionSettings, customMcps: updatedMcps };
                              setSessionSettings(nextSettings);
                              saveSessionSettings(currentSessionId, nextSettings, sessionModel);
                            }}
                            className="accent-accent-green cursor-pointer h-3.5 w-3.5 rounded border-zinc-800 bg-zinc-900"
                          />
                          <span 
                            className="font-bold text-zinc-200 text-xs truncate font-mono uppercase tracking-wider cursor-pointer flex-1" 
                            title={mcp.name}
                            onClick={() => {
                              const updatedMcps = sessionSettings.customMcps.map(m =>
                                m.id === mcp.id ? { ...m, isActive: !m.isActive } : m
                              );
                              const nextSettings = { ...sessionSettings, customMcps: updatedMcps };
                              setSessionSettings(nextSettings);
                              saveSessionSettings(currentSessionId, nextSettings, sessionModel);
                            }}
                          >
                            {mcp.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Test connection button */}
                          <button
                            type="button"
                            onClick={() => checkMcpStatus(mcp.id, mcp.command, mcp.args)}
                            className="p-1 rounded text-zinc-500 hover:text-accent-amber hover:bg-zinc-900 transition-colors"
                            title="Test connection"
                            disabled={mcpStatuses[mcp.id] === 'testing'}
                          >
                            <RefreshCw size={12} className={mcpStatuses[mcp.id] === 'testing' ? 'animate-spin text-accent-amber' : ''} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setExpandedMcpId(expandedMcpId === mcp.id ? null : mcp.id);
                              // Reset confirm status when toggling details
                              if (confirmDeleteMcpId === mcp.id) setConfirmDeleteMcpId(null);
                            }}
                            className={`p-1 rounded text-zinc-400 hover:text-accent-amber hover:bg-zinc-900 transition-all ${expandedMcpId === mcp.id ? 'bg-zinc-900 text-accent-amber' : ''}`}
                            title={`Toggle details (${mcp.tools ? mcp.tools.length : 0} Tools)`}
                          >
                            <Terminal size={12} />
                            {mcp.tools && mcp.tools.length > 0 && (
                              <span className="ml-0.5 text-[9px] font-bold text-zinc-500">({mcp.tools.length})</span>
                            )}
                          </button>
                          
                          {confirmDeleteMcpId === mcp.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                const updatedMcps = sessionSettings.customMcps.filter(m => m.id !== mcp.id);
                                const nextSettings = { ...sessionSettings, customMcps: updatedMcps };
                                setSessionSettings(nextSettings);
                                saveSessionSettings(currentSessionId, nextSettings, sessionModel);
                                showToast(`🗑️ MCP config "${mcp.name}" Deleted`);
                                setConfirmDeleteMcpId(null);
                              }}
                              className="bg-red-950/80 border border-red-500/50 text-red-400 hover:bg-red-600 hover:text-white px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors animate-pulse"
                            >
                              SURE?
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteMcpId(mcp.id)}
                              className="text-zinc-650 hover:text-red-400 p-1 hover:bg-zinc-900 rounded transition-colors"
                              title="Delete custom MCP connection"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable MCP Details */}
                      {expandedMcpId === mcp.id && (
                        <div className="border-t border-zinc-900/60 pt-2 mt-1 space-y-2 animate-in fade-in duration-200">
                          <div className="text-zinc-400 font-sans text-xs leading-normal">
                            {mcp.description || <span className="italic text-zinc-650">No description provided.</span>}
                          </div>
                          
                          <div className="text-[10px] font-mono text-zinc-500 bg-black/40 border border-zinc-900/60 p-1.5 rounded space-y-1">
                            <div>
                              <span className="text-zinc-600 uppercase font-bold mr-1">CMD:</span>
                              <span className="text-zinc-300">{mcp.command} {mcp.args}</span>
                            </div>
                            {mcp.env && (
                              <div>
                                <span className="text-zinc-600 uppercase font-bold mr-1">ENV:</span>
                                <span className="text-zinc-400">{mcp.env}</span>
                              </div>
                            )}
                          </div>

                          {mcp.tools && mcp.tools.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[9px] text-zinc-550 font-bold uppercase tracking-wider font-mono">Available Tools Checklist:</div>
                              <div className="space-y-1 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                                {mcp.tools.map((t, idx) => (
                                  <div key={idx} className="bg-black/50 border border-zinc-900/60 p-1.5 rounded font-mono text-[10px]">
                                    <div className="font-bold text-accent-green uppercase tracking-wider flex items-center justify-between">
                                      <span>{t.name}</span>
                                      <span className="text-[8px] text-zinc-600 font-normal font-sans">Active</span>
                                    </div>
                                    <div className="text-zinc-400 font-sans mt-0.5 leading-snug">{t.description || 'No description.'}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {(!sessionSettings.customMcps || sessionSettings.customMcps.length === 0) && (
                    <div className="text-xs text-zinc-600 italic text-center py-2">No custom MCP connections.</div>
                  )}
                </div>
              </div>

               {/* Clipboard Attach */}
               <div className="space-y-1 border-t border-zinc-900 pt-3">
                 <div className="flex items-center justify-between">
                   <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Clipboard Auto-Attach</label>
                   <input
                     type="checkbox"
                     checked={sessionSettings.clipboardAttach}
                     onChange={(e) => {
                       const newSettings = { ...sessionSettings, clipboardAttach: e.target.checked };
                       setSessionSettings(newSettings);
                       saveSessionSettings(currentSessionId, newSettings, sessionModel);
                     }}
                     className="accent-accent-amber"
                   />
                 </div>
                 <span className="text-xs text-zinc-650">Automatically appends system clipboard text content to your message prompts on send.</span>
               </div>

              {/* Profiles management */}
              <div className="space-y-2 border-t border-zinc-900 pt-3">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Save Custom Profile</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    id="drawer-profile-name"
                    placeholder="PROFILE NAME..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById('drawer-profile-name') as HTMLInputElement;
                      if (!el || !el.value.trim()) {
                        showToast("⚠️ Profile name cannot be empty");
                        return;
                      }
                      const name = el.value.trim();
                      const currentProfile = {
                        aiChatTemperature: sessionSettings.temperature,
                        aiChatMaxTokens: sessionSettings.maxTokens,
                        aiChatContextSize: sessionSettings.contextSize,
                        aiChatTopK: sessionSettings.topK,
                        aiChatTopP: sessionSettings.topP,
                        aiChatSystemPrompt: sessionSettings.systemPrompt,
                        aiChatPersonality: sessionSettings.personality,
                      };
                      const updatedProfiles = {
                        ...aiSettingsProfiles,
                        [name]: currentProfile
                      };
                      setAiSettingsProfiles(updatedProfiles);
                      el.value = '';
                      showToast(`💾 Profile "${name}" saved`);
                    }}
                    className="bg-accent-amber/15 border border-accent-amber/35 text-accent-amber px-3 py-1 rounded text-xs font-bold uppercase hover:bg-accent-amber hover:text-black transition-colors"
                  >
                    Save
                  </button>
                </div>
                {Object.keys(aiSettingsProfiles).length > 0 && (
                  <select
                    onChange={(e) => {
                      const name = e.target.value;
                      if (!name) return;
                      const prof = aiSettingsProfiles[name];
                      if (prof) {
                        const newSettings = {
                          ...sessionSettings,
                          temperature: prof.aiChatTemperature ?? 0.7,
                          maxTokens: prof.aiChatMaxTokens ?? 0,
                          contextSize: prof.aiChatContextSize ?? 4096,
                          topK: prof.aiChatTopK ?? 40,
                          topP: prof.aiChatTopP ?? 0.9,
                          systemPrompt: prof.aiChatSystemPrompt ?? '',
                          personality: prof.aiChatPersonality ?? 'default'
                        };
                        setSessionSettings(newSettings);
                        saveSessionSettings(currentSessionId, newSettings, sessionModel);
                        showToast(`📂 Loaded profile: ${name}`);
                      }
                    }}
                    value=""
                    className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-400 focus:outline-none appearance-none cursor-pointer font-mono"
                  >
                    <option value="" disabled>LOAD PRESET PROFILE...</option>
                    {Object.keys(aiSettingsProfiles).map((name) => (
                      <option key={name} value={name}>{name.toUpperCase()}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Resets */}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={async () => {
                    const modelDefaults = getModelDefaultSettings(sessionModel || getActiveModelDefault());
                    const newSettings = {
                      ...sessionSettings,
                      temperature: modelDefaults.temperature,
                      maxTokens: modelDefaults.maxTokens,
                      contextSize: modelDefaults.contextSize,
                      topK: modelDefaults.topK,
                      topP: modelDefaults.topP,
                      systemPrompt: masterDefaults.systemPrompt,
                      personality: masterDefaults.personality,
                      clipboardAttach: false,
                      activeSkills: {
                        githubScan: false,
                        webSearch: false,
                        systemController: true,
                        anthropicSearch: false
                      },
                      customSkills: sessionSettings.customSkills || [],
                      customMcps: sessionSettings.customMcps || []
                    };
                    setSessionSettings(newSettings);
                    await saveSessionSettings(currentSessionId, newSettings, sessionModel);
                    showToast("🔄 Reset to Model Defaults");
                  }}
                  className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 py-1.5 text-xs font-bold text-zinc-400 hover:text-white tracking-wider uppercase rounded"
                >
                  Model Defaults
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const newSettings = {
                      temperature: masterDefaults.temperature,
                      maxTokens: masterDefaults.maxTokens,
                      contextSize: masterDefaults.contextSize,
                      topK: masterDefaults.topK,
                      topP: masterDefaults.topP,
                      systemPrompt: masterDefaults.systemPrompt,
                      personality: masterDefaults.personality,
                      personalityPrompt: "",
                      clipboardAttach: false,
                      activeSkills: {
                        githubScan: false,
                        webSearch: false,
                        systemController: true,
                        anthropicSearch: false
                      },
                      customSkills: sessionSettings.customSkills || [],
                      customMcps: sessionSettings.customMcps || []
                    };
                    setSessionSettings(newSettings);
                    await saveSessionSettings(currentSessionId, newSettings, sessionModel);
                    showToast("🔄 Reset to Master Defaults");
                  }}
                  className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 py-1.5 text-xs font-bold text-zinc-400 hover:text-white tracking-wider uppercase rounded"
                >
                  Master Defaults
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
  );
}

interface Token {
  type: string;
  value: string;
}

const tokenize = (code: string, rules: { type: string; regex: RegExp }[]): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  
  while (index < code.length) {
    let matched = false;
    const remaining = code.slice(index);
    
    for (const rule of rules) {
      const match = rule.regex.exec(remaining);
      if (match && match.index === 0) {
        const value = match[0];
        tokens.push({ type: rule.type, value });
        index += value.length;
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      const char = code[index];
      const lastToken = tokens[tokens.length - 1];
      if (lastToken && lastToken.type === 'text') {
        lastToken.value += char;
      } else {
        tokens.push({ type: 'text', value: char });
      }
      index++;
    }
  }
  
  return tokens;
};

const jsRules = [
  { type: 'comment', regex: /^\/\/.*|^\/\*[\s\S]*?\*\// },
  { type: 'string', regex: /^"(?:\\.|[^"\\])*"|^'(?:\\.|[^'\\])*'|^`[\s\S]*?`/ },
  { type: 'keyword', regex: /^(?:break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield|let|package|private|protected|public|static|enum|interface|type|implements|namespace|async|await|as|from|of|get|set)\b/ },
  { type: 'constant', regex: /^(?:true|false|null|undefined|NaN|Infinity)\b/ },
  { type: 'function', regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/ },
  { type: 'number', regex: /^\d+(?:\.\d+)?|^0x[a-fA-F0-9]+/ },
  { type: 'operator', regex: /^=>|^===|^==|^=|^!==|^!=|^!|^<=|^>=|^<|^>|^\+\+|^\+|^--|^-|^\*|^\/|^&&|^\|\||^\?|^:/ },
  { type: 'class', regex: /^[A-Z][a-zA-Z0-9_$]*/ },
];

const pyRules = [
  { type: 'comment', regex: /^#.*/ },
  { type: 'string', regex: /^"""[\s\S]*?"""|^'''[\s\S]*?'''|^"(?:\\.|[^"\\])*"|^'(?:\\.|[^'\\])*'/ },
  { type: 'keyword', regex: /^(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|self)\b/ },
  { type: 'decorator', regex: /^@[a-zA-Z0-9_]+/ },
  { type: 'function', regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
  { type: 'number', regex: /^\d+(?:\.\d+)?/ },
  { type: 'operator', regex: /^==|^=|^!=|^<=|^>=|^<|^>|^\+|^--|^-|^\*|^\/|^&&|^\|\||^\?|^:/ },
];

const csRules = [
  { type: 'comment', regex: /^\/\/.*|^\/\*[\s\S]*?\*\// },
  { type: 'string', regex: /^@"(?:""|[^"])*"|^"(?:\\.|[^"\\])*"|^'(?:\\.|[^'\\])*'/ },
  { type: 'keyword', regex: /^(?:abstract|as|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|ref|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|virtual|void|volatile|while|add|alias|ascending|async|await|by|descending|dynamic|equals|from|get|global|group|into|join|let|nameof|on|orderby|partial|remove|select|set|value|var|when|where|yield)\b/ },
  { type: 'function', regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/ },
  { type: 'number', regex: /^\d+(?:\.\d+)?f?/ },
  { type: 'operator', regex: /^=>|^==|^=|^!=|^<=|^>=|^<|^>|^\+\+|^\+|^--|^-|^\*|^\/|^&&|^\|\||^\?|^:/ },
  { type: 'class', regex: /^[A-Z][a-zA-Z0-9_]*/ },
];

const rustRules = [
  { type: 'comment', regex: /^\/\/.*|^\/\*[\s\S]*?\*\// },
  { type: 'string', regex: /^b?"(?:\\.|[^"\\])*"|^r#"(?:[\s\S]*?)"#|^'\\?[a-zA-Z0-9_]'/ },
  { type: 'keyword', regex: /^(?:as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|import|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|union|unsafe|use|where|while|macro_rules)\b/ },
  { type: 'function', regex: /^[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\(|!\s*\()/ },
  { type: 'number', regex: /^\d+(?:_\d+)*(?:\.\d+)?(?:u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|f32|f64)?/ },
  { type: 'operator', regex: /^=>|^==|^=|^!=|^<=|^>=|^<|^>|^\+|^--|^-|^\*|^\/|^&&|^\|\||^\?|^:/ },
];

const jsonRules = [
  { type: 'string', regex: /^"(?:\\.|[^"\\])*"/ },
  { type: 'number', regex: /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/ },
  { type: 'constant', regex: /^(?:true|false|null)\b/ },
  { type: 'operator', regex: /^:|{|}|\[|\]|,/ },
];

const htmlRules = [
  { type: 'comment', regex: /^<!--[\s\S]*?-->/ },
  { type: 'doctype', regex: /^<!DOCTYPE[^>]*>/i },
  { type: 'tag', regex: /^<\/?[a-zA-Z0-9:-]+(?:\s+[a-zA-Z0-9:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+))?)*\s*\/?>/ },
];

const cssRules = [
  { type: 'comment', regex: /^\/\*[\s\S]*?\*\// },
  { type: 'selector', regex: /^[^`~!@$%^&*()+=:;<>?,./\s{][^{}]*(?=\s*\{)/ },
  { type: 'property', regex: /^[\w-]+(?=\s*:)/ },
  { type: 'value', regex: /^:\s*[^;{}]+(?=;|\})/ },
  { type: 'operator', regex: /^{|}/ },
];

const sqlRules = [
  { type: 'comment', regex: /^--.*|^\/\*[\s\S]*?\*\// },
  { type: 'string', regex: /^'(?:''|[^'])*'|^"(?:""|[^"])*"/ },
  { type: 'keyword', regex: /^(?:select|insert|update|delete|from|where|join|left|right|inner|outer|on|group|by|having|order|limit|offset|create|table|drop|alter|index|view|primary|key|foreign|references|unique|not|null|default|check|constraint|values|into|set|and|or|not|in|like|between|exists|is|null|true|false|as|union|all|any|some|case|when|then|else|end|count|sum|avg|min|max|group_concat|coalesce|distinct)\b/i },
  { type: 'number', regex: /^\d+(?:\.\d+)?/ },
  { type: 'operator', regex: /^=|!=|<>|<=|>=|<|>|\+|-|\*|\// },
];

const bashRules = [
  { type: 'comment', regex: /^#.*/ },
  { type: 'string', regex: /^"(?:\\.|[^"\\])*"|^'(?:\\.|[^'\\])*'/ },
  { type: 'keyword', regex: /^(?:cd|ls|pwd|echo|cat|grep|awk|sed|mkdir|rm|cp|mv|touch|chmod|chown|sudo|apt|yum|dnf|pacman|systemctl|git|npm|node|python|cargo|rustc|make|gcc|clang|docker|docker-compose|kubectl|aws|gcloud|curl|wget|ssh|scp|rsync|tar|zip|unzip|find|xargs|sleep|exit|export|alias|if|else|elif|fi|for|while|in|do|done|case|esac|function)\b/ },
  { type: 'operator', regex: /^\||^&|^>|^<|^==|^=|^!=/ },
];

const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const highlightCode = (code: string, language: string): string => {
  const cleanCode = code.trim();
  const lang = (language || 'text').toLowerCase();
  
  let rules;
  switch (lang) {
    case 'javascript':
    case 'js':
    case 'jsx':
    case 'typescript':
    case 'ts':
    case 'tsx':
      rules = jsRules;
      break;
    case 'python':
    case 'py':
      rules = pyRules;
      break;
    case 'csharp':
    case 'cs':
      rules = csRules;
      break;
    case 'rust':
    case 'rs':
      rules = rustRules;
      break;
    case 'json':
      rules = jsonRules;
      break;
    case 'html':
    case 'xml':
    case 'svg':
      rules = htmlRules;
      break;
    case 'css':
    case 'scss':
    case 'sass':
      rules = cssRules;
      break;
    case 'sql':
      rules = sqlRules;
      break;
    case 'bash':
    case 'sh':
    case 'shell':
    case 'powershell':
    case 'ps1':
      rules = bashRules;
      break;
    default:
      return escapeHtml(cleanCode);
  }
  
  const tokens = tokenize(cleanCode, rules);
  return tokens.map(t => {
    if (t.type === 'text') {
      return escapeHtml(t.value);
    }
    let styleClass = '';
    switch (t.type) {
      case 'comment': styleClass = 'text-zinc-500 italic'; break;
      case 'string': styleClass = 'text-emerald-400'; break;
      case 'number': styleClass = 'text-amber-400 font-bold'; break;
      case 'keyword': styleClass = 'text-pink-400 font-bold'; break;
      case 'constant': styleClass = 'text-purple-400 font-bold'; break;
      case 'function': styleClass = 'text-sky-400'; break;
      case 'decorator': styleClass = 'text-teal-400'; break;
      case 'tag': styleClass = 'text-red-400 font-semibold'; break;
      case 'doctype': styleClass = 'text-zinc-400 font-bold'; break;
      case 'selector': styleClass = 'text-indigo-400 font-bold'; break;
      case 'property': styleClass = 'text-orange-400'; break;
      case 'value': styleClass = 'text-teal-400'; break;
      case 'operator': styleClass = 'text-zinc-400 font-semibold opacity-90'; break;
      case 'class': styleClass = 'text-yellow-400 font-semibold'; break;
    }
    return `<span class="${styleClass}">${escapeHtml(t.value)}</span>`;
  }).join('');
};

