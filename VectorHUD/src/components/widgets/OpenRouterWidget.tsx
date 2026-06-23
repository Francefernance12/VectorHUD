import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import { getDb, executeQuery } from '../../utils/db';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { useToastStore } from '../../store/toastStore';
import { useOpenRouterStore } from '../../store/openRouterStore';
import { useShallow } from 'zustand/react/shallow';
import { useShellStore } from '../../store/shellStore';
import { Plus, MessageSquare, Trash2, Camera, Edit3, Copy, Check, Mic, MicOff, Settings, X, Paperclip, Search } from 'lucide-react';
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

export function OpenRouterWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(240);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(160, Math.min(400, startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
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
    clearDraft 
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
    toggleSettings
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
      toggleSettings: state.toggleSettings
    }))
  );
  
  // Local Settings Drawer & Session Search
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  
  // Attached files state
  interface AttachedFile {
    name: string;
    path: string;
    content: string;
    size: number;
    lines: number;
  }
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  
  // Session-specific settings state
  const [sessionSettings, setSessionSettings] = useState({
    temperature: 0.7,
    maxTokens: 0,
    contextSize: 4096,
    topK: 40,
    topP: 0.9,
    systemPrompt: '',
    personality: 'default',
    clipboardAttach: false,
    activeSkills: {
      githubScan: false,
      webSearch: false,
      systemController: true,
      anthropicSearch: false
    }
  });
  const [sessionModel, setSessionModel] = useState<string>('');

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

  const getActiveModelName = () => {
    switch (aiProvider) {
      case 'openai':
        return `OpenAI: ${openaiModel}`;
      case 'anthropic': {
        const parts = anthropicModel.split('-');
        return `Anthropic: ${parts.length > 2 ? parts.slice(1).join('-') : anthropicModel}`;
      }
      case 'groq':
        return `Groq: ${groqModel}`;
      case 'openrouter':
      default:
        return `OpenRouter: ${(useCustomOpenRouterModel && customOpenRouterModel) ? customOpenRouterModel : openRouterModel.split('/').pop()}`;
    }
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
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadSessionSettings = async (sessionId: string) => {
    try {
      const db = await getDb();
      const res = await db.select<{ session_settings: string | null, selected_model: string | null }[]>(
        "SELECT session_settings, selected_model FROM session_titles WHERE session_id = ?",
        [sessionId]
      );
      const selectedModel = (res.length > 0 && res[0].selected_model) || masterDefaults.model;
      const modelDefaults = getModelDefaultSettings(selectedModel);

      if (res.length > 0 && res[0].session_settings) {
        const parsed = JSON.parse(res[0].session_settings);
        setSessionSettings({
          temperature: parsed.temperature ?? modelDefaults.temperature,
          maxTokens: parsed.maxTokens ?? modelDefaults.maxTokens,
          contextSize: parsed.contextSize ?? modelDefaults.contextSize,
          topK: parsed.topK ?? modelDefaults.topK,
          topP: parsed.topP ?? modelDefaults.topP,
          systemPrompt: parsed.systemPrompt ?? masterDefaults.systemPrompt,
          personality: parsed.personality ?? masterDefaults.personality,
          clipboardAttach: parsed.clipboardAttach ?? false,
          activeSkills: parsed.activeSkills ?? {
            githubScan: false,
            webSearch: false,
            systemController: true,
            anthropicSearch: false
          }
        });
        setSessionModel(selectedModel);
      } else {
        setSessionSettings({
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
          }
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
    
    const selectedModel = masterDefaults.model;
    const modelDefaults = getModelDefaultSettings(selectedModel);
    
    const initialSettings = {
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
      }
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
      default:
        showToast(`🔧 Tool Executed: ${name}`);
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
      let provider = aiProvider || 'openrouter';

      if (selectedModel.includes('/')) {
        provider = 'openrouter';
      }

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

      const apiMessages = currentMessages.map(msg => {
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
          if (attachments.files && attachments.files.length > 0) {
            messageContent += "\n\n=== ATTACHED_FILES ===";
            attachments.files.forEach((file: any) => {
              messageContent += `\n\n<attached_file name="${file.name}">\n${file.content}\n</attached_file>`;
            });
          }
          if (attachments.clipboard) {
            messageContent += `\n\n=== CLIPBOARD_ATTACHMENT ===\n${attachments.clipboard}`;
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

      const personalityPrefix = PERSONALITY_PROMPTS[sessionSettings.personality as keyof typeof PERSONALITY_PROMPTS] || "";
      const baseSystemPrompt = sessionSettings.systemPrompt || UI_CONSTANTS.CHAT_SYSTEM_PROMPT;
      const finalSystemPrompt = personalityPrefix + baseSystemPrompt;

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
          if (name === "list_github_issues") {
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
            } else if (query.toLowerCase().includes("news")) {
              output = "Live News Bulletin: Global Summit reaches agreement on clean energy transitions. Tech consortium releases new standards for interoperable overlays.";
            } else {
              output = `Live Search Results for '${query}': Standard database entry found. VectorHUD v1.3.2 is fully verified. Settings saving successfully completed. Local workspace is clean.`;
            }
            showToast(`🔍 Web Search: Queried "${query.substring(0, 15)}..."`);
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
    
    for (const file of filesArray) {
      const filePath = (file as any).path || '';
      if (!filePath) {
        showToast("⚠️ Could not retrieve absolute path for file");
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
        
        setAttachedFiles(prev => [...prev, attached]);
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
    <div className="flex h-full bg-black/60 font-mono overflow-hidden w-full min-w-0">
      {/* Sidebar */}
      {sidebarOpen && (
        <div 
          style={{ width: `${sidebarWidth}px` }}
          className="bg-black flex flex-col shrink-0 overflow-hidden"
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
          className="w-[3px] hover:w-[5px] bg-zinc-800 hover:bg-accent-amber/50 active:bg-accent-amber/80 cursor-col-resize transition-all h-full shrink-0 z-20 relative select-none"
          title="Drag to resize sidebar"
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Settings Drawer Overlay */}
        {drawerOpen && (
          <div className="absolute right-0 top-0 h-full w-[310px] bg-zinc-950/95 border-l border-zinc-800 z-30 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 select-none backdrop-blur-md">
            <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/40 shrink-0">
              <span className="text-xs font-bold text-zinc-200 tracking-widest uppercase font-mono">Session settings</span>
              <button onClick={() => setDrawerOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 font-mono text-[11px] text-zinc-300">
              {/* Model Override Dropdown */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Session Model</label>
                <select
                  value={sessionModel}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    setSessionModel(newModel);
                    
                    // Reset to model defaults
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
                    showToast(`🤖 Switched session model to: ${newModel.split('/').pop()}`);
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 cursor-pointer font-mono"
                >
                  <option value="google/gemini-2.5-flash">Gemini 2.5 Flash [Vision] [Actions] [File Attachments] [Web Search]</option>
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet [Vision] [Actions] [File Attachments] [MCP]</option>
                  <option value="openai/gpt-4o">OpenAI GPT-4o [Vision] [Actions] [File Attachments]</option>
                  <option value="deepseek/deepseek-chat">DeepSeek V3 [Actions]</option>
                  <option value="deepseek/deepseek-r1">DeepSeek R1 [Thinking]</option>
                  <option value="deepseek/deepseek-v4-flash">DeepSeek v4-Flash [Vision] [File Attachments]</option>
                  <option value="moonshotai/kimi-k2-thinking">Kimi K2 Thinking [Thinking]</option>
                  <option value="x-ai/grok-4.3">Grok 4 [Vision] [Actions] [File Attachments]</option>
                </select>
              </div>

              {/* Temperature */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase">
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
                <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase">
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
                <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase">
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
                  <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase">
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
                  <div className="flex justify-between items-center text-[9px] text-zinc-500 uppercase">
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
                    <div className="flex justify-between items-center text-[9px] text-zinc-550">
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

              {/* System Prompt Custom templates */}
              <div className="space-y-1 border-t border-zinc-900 pt-3">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">System Prompt Template</label>
                <select
                  value={
                    Object.entries(SYSTEM_PROMPT_TEMPLATES).find(([_, temp]) => temp.text === sessionSettings.systemPrompt)?.[0] || 'custom'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    let nextPrompt = sessionSettings.systemPrompt;
                    if (val !== 'custom') {
                      nextPrompt = SYSTEM_PROMPT_TEMPLATES[val as keyof typeof SYSTEM_PROMPT_TEMPLATES].text;
                    }
                    const newSettings = { ...sessionSettings, systemPrompt: nextPrompt };
                    setSessionSettings(newSettings);
                    saveSessionSettings(currentSessionId, newSettings, sessionModel);
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent-amber/50 cursor-pointer font-mono"
                >
                  {Object.entries(SYSTEM_PROMPT_TEMPLATES).map(([key, value]) => (
                    <option key={key} value={key}>{value.name.toUpperCase()}</option>
                  ))}
                </select>
                
                <textarea
                  value={sessionSettings.systemPrompt}
                  onChange={(e) => {
                    const newSettings = { ...sessionSettings, systemPrompt: e.target.value };
                    setSessionSettings(newSettings);
                    saveSessionSettings(currentSessionId, newSettings, sessionModel);
                  }}
                  placeholder="Enter custom instructions..."
                  rows={2}
                  className="w-full bg-black/40 border border-zinc-800 rounded px-2.5 py-1.5 text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-accent-amber/50 resize-none mt-1"
                />
              </div>

              {/* AI Personality Selector */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">AI Response Tone</label>
                <select
                  value={sessionSettings.personality}
                  onChange={(e) => {
                    const newSettings = { ...sessionSettings, personality: e.target.value };
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
                </select>
              </div>

              {/* Active Skills Checklist */}
              <div className="space-y-2 border-t border-zinc-900 pt-3">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Active HUD Skills</label>
                
                {/* System Controller */}
                <div className="bg-zinc-950 border border-zinc-900 p-2 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300 text-[10px]">SYSTEM CONTROLLER</span>
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
                  <span className="text-[9px] text-zinc-600">Controls PC audio volumes, media playback track, stopwatch, timers, and telemetry statistics.</span>
                </div>

                {/* GitHub Scan */}
                <div className="bg-zinc-950 border border-zinc-900 p-2 rounded flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300 text-[10px]">GITHUB SCAN</span>
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
                  <span className="text-[9px] text-zinc-600">Enables scanning repository commits, monitoring issue lists, and tracking pull requests.</span>
                  {sessionSettings.activeSkills.githubScan && (
                    <div className="border border-zinc-800 bg-black/50 p-1.5 rounded text-[9px] text-zinc-400 space-y-1">
                      <span className="text-accent-amber block font-bold">⚠️ REQUIRES REPO PERMISSION KEYS</span>
                      <button
                        type="button"
                        onClick={() => toggleSettings()}
                        className="w-full text-center bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 py-1 text-[8px] font-bold text-accent-amber tracking-wider uppercase rounded"
                      >
                        Navigate to Credentials
                      </button>
                    </div>
                  )}
                </div>

                {/* Web Search */}
                <div className="bg-zinc-950 border border-zinc-900 p-2 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300 text-[10px]">WEB SEARCH</span>
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
                  <span className="text-[9px] text-zinc-600">Accesses external search tools to pull real-time weather, market indexes, or live documentation.</span>
                </div>

                {/* Anthropic Search */}
                <div className="bg-zinc-950 border border-zinc-900 p-2 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-zinc-300 text-[10px]">ANTHROPIC SEARCH</span>
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
                  <span className="text-[9px] text-zinc-600">Use Anthropic web tools integration when utilizing Claude provider models.</span>
                </div>
              </div>

               {/* Clipboard Attach */}
               <div className="space-y-1 border-t border-zinc-900 pt-3">
                 <div className="flex items-center justify-between">
                   <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Clipboard Auto-Attach</label>
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
                 <span className="text-[9px] text-zinc-600">Automatically appends system clipboard text content to your message prompts on send.</span>
               </div>

              {/* Profiles management */}
              <div className="space-y-2 border-t border-zinc-900 pt-3">
                <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Save Custom Profile</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    id="drawer-profile-name"
                    placeholder="PROFILE NAME..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] font-mono text-zinc-300 placeholder:text-zinc-700 focus:outline-none uppercase"
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
                    className="bg-accent-amber/15 border border-accent-amber/35 text-accent-amber px-3 py-1 rounded text-[10px] font-bold uppercase hover:bg-accent-amber hover:text-black transition-colors"
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
                    const modelDefaults = getModelDefaultSettings(sessionModel);
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
                      }
                    };
                    setSessionSettings(newSettings);
                    await saveSessionSettings(currentSessionId, newSettings, sessionModel);
                    showToast("🔄 Reset to Model Defaults");
                  }}
                  className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 py-1.5 text-[9px] font-bold text-zinc-400 hover:text-white tracking-wider uppercase rounded"
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
                      clipboardAttach: false,
                      activeSkills: {
                        githubScan: false,
                        webSearch: false,
                        systemController: true,
                        anthropicSearch: false
                      }
                    };
                    setSessionSettings(newSettings);
                    await saveSessionSettings(currentSessionId, newSettings, sessionModel);
                    showToast("🔄 Reset to Master Defaults");
                  }}
                  className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 py-1.5 text-[9px] font-bold text-zinc-400 hover:text-white tracking-wider uppercase rounded"
                >
                  Master Defaults
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 border-b border-border-wire bg-black/80 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-zinc-500 hover:text-accent-amber transition-colors"
            >
              <MessageSquare size={14} />
            </button>
            <span className="text-xs font-bold text-zinc-200 tracking-wider">TACTICAL_AI_LINK</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-650 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-widest">{getActiveModelName()}</span>
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
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
                        <div className="p-2 bg-black/50 border border-white/5 rounded-sm flex items-center gap-2 text-[10px] text-accent-green/80 italic w-fit">
                          <Camera size={10} />
                          <span>[ VISION_BUFFER_ATTACHED ]</span>
                        </div>
                      )}
                      {attachments.files && attachments.files.map((file: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="bg-black/40 border border-zinc-800 rounded p-2 flex items-center gap-3 text-[10px] font-mono w-[220px]"
                        >
                          <Paperclip size={12} className="text-accent-amber" />
                          <div className="overflow-hidden flex flex-col flex-1">
                            <span className="text-zinc-300 font-bold truncate" title={file.name}>{file.name}</span>
                            <span className="text-zinc-650 text-[9px] uppercase">
                              {(file.size / 1024).toFixed(1)} KB | {file.lines} LINES
                            </span>
                          </div>
                          <span className="text-accent-green text-[9px] font-bold shrink-0 flex items-center gap-0.5 select-none">[✓ INJECTED]</span>
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
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, idx) => (
                  <div 
                    key={idx} 
                    className="bg-zinc-950 border border-zinc-800 rounded p-2 flex items-center justify-between gap-3 text-[10px] font-mono w-[180px] relative overflow-hidden"
                  >
                    <div className="overflow-hidden flex flex-col flex-1">
                      <span className="text-zinc-300 font-bold truncate" title={file.name}>{file.name}</span>
                      <span className="text-zinc-650 text-[9px] uppercase font-mono">
                        {(file.size / 1024).toFixed(1)} KB | {file.lines} LINES
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition-colors shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-2 relative">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isTyping || isRecordingMic || !isOnline}
              className="px-3 rounded-sm border border-zinc-700/50 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-all flex items-center justify-center"
              title="Attach documents/files (PDF, TXT, HTML)"
            >
              <Paperclip size={16} />
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

