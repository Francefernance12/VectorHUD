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
import { Plus, MessageSquare, Trash2, Camera, Edit3, Copy, Check } from 'lucide-react';
import { UI_CONSTANTS } from '../../config/constants';
import { AI_TOOLS, getAnthropicTools, executeTool } from '../../utils/aiActions';

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

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

export function OpenRouterWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  
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
    useCustomOpenRouterModel
  } = useSettingsStore(
    useShallow((state) => ({
      aiProvider: state.aiProvider,
      openRouterModel: state.openRouterModel,
      openaiModel: state.openaiModel,
      anthropicModel: state.anthropicModel,
      groqModel: state.groqModel,
      customOpenRouterModel: state.customOpenRouterModel,
      useCustomOpenRouterModel: state.useCustomOpenRouterModel,
    }))
  );
  const showToast = useToastStore(state => state.showToast);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

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
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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

  const createNewSession = () => {
    const newId = generateSessionId();
    setCurrentSessionId(newId);
    setMessages([]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !draftImagePath) return;

    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = generateSessionId();
      setCurrentSessionId(activeSessionId);
    }

    const userMsg: Message = { session_id: activeSessionId, role: 'user', content: input, image_path: draftImagePath || undefined };
    const updatedMessages = [...messages, userMsg];
    
    setMessages(updatedMessages);
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
      let selectedModel = openRouterModel;

      switch (aiProvider) {
        case 'openai':
          keyId = 'openai_key';
          friendlyProviderName = 'OpenAI';
          selectedModel = openaiModel;
          break;
        case 'anthropic':
          keyId = 'anthropic_key';
          friendlyProviderName = 'Anthropic';
          selectedModel = anthropicModel;
          break;
        case 'groq':
          keyId = 'groq_key';
          friendlyProviderName = 'Groq';
          selectedModel = groqModel;
          break;
        case 'openrouter':
        default:
          keyId = 'openrouter_key';
          friendlyProviderName = 'OpenRouter';
          selectedModel = (useCustomOpenRouterModel && customOpenRouterModel) ? customOpenRouterModel : openRouterModel;
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
        if (msg.image_path) {
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.content || "Analyze this image." },
              { type: 'image_url', image_url: { url: msg.image_path } }
            ]
          };
        }
        return {
          role: msg.role,
          content: msg.content
        };
      });

      // Determine if we should pass tools
      const supportsTools = 
        aiProvider === 'openai' ||
        aiProvider === 'anthropic' ||
        aiProvider === 'groq' ||
        (aiProvider === 'openrouter' && (!useCustomOpenRouterModel || (customOpenRouterModel && (
          customOpenRouterModel.includes('gpt') ||
          customOpenRouterModel.includes('claude') ||
          customOpenRouterModel.includes('gemini') ||
          customOpenRouterModel.includes('llama-3.3') ||
          customOpenRouterModel.includes('llama3')
        ))));

      const toolsPayload = supportsTools 
        ? (aiProvider === 'anthropic' ? getAnthropicTools() : AI_TOOLS)
        : undefined;

      interface UnifiedLlmResponse {
        content: string;
        total_tokens: number;
        tool_calls?: any;
      }

      const result = await invoke<UnifiedLlmResponse>('call_ai_api', {
        provider: aiProvider || 'openrouter',
        model: selectedModel,
        messages: apiMessages,
        systemPrompt: UI_CONSTANTS.CHAT_SYSTEM_PROMPT,
        apiKey: apiKey,
        tools: toolsPayload
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
          const output = await executeTool(name, args);

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

  return (
    <div className="flex h-full bg-black/60 font-mono overflow-hidden w-full min-w-0">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 border-r border-zinc-800 bg-black flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <h3 className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Chat Sessions</h3>
                <button onClick={createNewSession} className="text-zinc-400 hover:text-accent-amber transition-colors" title="New Session">
                  <Plus size={14} />
                </button>
              </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {sessions.map(s => (
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
                    <span className="text-[9px] text-zinc-600 font-mono mt-1 uppercase">{new Date(s.timestamp).toLocaleDateString()}</span>
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
              <div className="text-[10px] text-zinc-600 text-center mt-4 italic">No chat history</div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative min-w-0">
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
          <span className="text-[10px] text-zinc-600 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-widest">{getActiveModelName()}</span>
        </div>

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
              <span className="text-[9px] text-zinc-600 mb-1.5 uppercase tracking-widest px-1 font-bold">
                {msg.role === 'user' ? 'OPERATOR' : 'VECTOR_AI'}
              </span>
              <div className={`p-3.5 rounded-sm text-sm w-fit max-w-[90%] min-w-0 shadow-lg relative select-text break-words overflow-hidden ${
                msg.role === 'user' 
                  ? 'bg-zinc-800/80 border-r-2 border-accent-amber text-zinc-100' 
                  : 'bg-black/60 border-l-2 border-accent-green text-zinc-300 shadow-[0_0_15px_rgba(74,246,38,0.05)]'
              }`}>
                {msg.image_path && (
                  <div className="mb-3 p-2 bg-black/50 border border-white/5 rounded-sm flex items-center gap-2 text-[10px] text-accent-green/80 italic w-fit">
                    <Camera size={12} />
                    <span>[ VISION_BUFFER_ATTACHED ]</span>
                  </div>
                )}
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
                              <h2 className="text-[11px] font-bold text-zinc-200 tracking-wider uppercase border-b border-zinc-900 pb-1 mb-2.5 mt-4 flex items-center gap-1.5 font-mono">
                                <span className="w-1.5 h-2 bg-accent-amber inline-block"></span>
                                {children}
                              </h2>
                            );
                          },
                          h3({ children }) {
                            return (
                              <h3 className="text-[10px] font-bold text-zinc-400 tracking-wide uppercase mb-2 mt-3 flex items-center gap-1 font-mono">
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
                                <div className="flex items-center justify-between px-4 py-2 bg-zinc-950 border-b border-zinc-900 text-[10px] text-zinc-500 font-mono tracking-widest select-none">
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
                                    className="hover:text-accent-green transition-colors flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px]"
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
                              <th className="px-3 py-2 bg-zinc-950 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800 font-mono">
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
                              <blockquote className="border-l-2 border-accent-amber/70 pl-3.5 py-2 my-4 italic text-zinc-300 bg-accent-amber/5 rounded-r-md text-xs relative overflow-hidden font-mono shadow-[inset_0_0_10px_rgba(255,176,0,0.02)]">
                                <span className="absolute top-1 right-2 text-[8px] font-bold text-accent-amber/30 select-none tracking-widest uppercase font-mono">QUOTE</span>
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
                  <div className="mt-2 text-[9px] text-zinc-500 font-mono italic flex justify-end">
                    [{msg.tokens} TOKENS USED]
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex flex-col items-start animate-in fade-in duration-300">
              <span className="text-[9px] text-zinc-600 mb-1.5 uppercase tracking-widest px-1 font-bold">VECTOR_AI</span>
              <div className="p-3 rounded-sm text-sm bg-black/60 border-l-2 border-accent-green/50 text-accent-green/70 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-accent-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-accent-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-1" />
        </div>

        <form onSubmit={handleSubmit} className="p-3 bg-black/80 border-t border-border-wire">
          {draftImagePath && (
            <div className="mb-2 relative w-24 h-16 rounded overflow-hidden border border-accent-amber/50 flex-shrink-0 group">
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
          <div className="flex gap-2 mb-2 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter command..."
              className="flex-1 bg-zinc-900 border border-zinc-700/50 rounded-sm px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-accent-amber/50 focus:bg-zinc-800 transition-all placeholder:text-zinc-600"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !draftImagePath) || isTyping}
              className="px-6 bg-accent-amber/10 border border-accent-amber/30 text-accent-amber rounded-sm py-2 text-xs font-bold uppercase tracking-widest hover:bg-accent-amber hover:text-black transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          <button
            type="button"
            onClick={handleAnalyzeScreen}
            disabled={isTyping}
            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-sm py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:border-zinc-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-zinc-400 flex items-center justify-center gap-2"
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

