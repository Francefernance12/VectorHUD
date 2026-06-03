import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import { getDb, executeQuery } from '../../utils/db';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { useToastStore } from '../../store/toastStore';
import { useOpenRouterStore } from '../../store/openRouterStore';
import { Plus, MessageSquare, Trash2, Camera } from 'lucide-react';

interface Message {
  id?: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  image_path?: string;
  timestamp?: string;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

export function OpenRouterWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  
  const { 
    input, 
    setInput, 
    draftImagePath, 
    setDraftImagePath, 
    sidebarOpen, 
    setSidebarOpen, 
    clearDraft 
  } = useOpenRouterStore();
  
  const [isTyping, setIsTyping] = useState(false);
  
  const openRouterModel = useSettingsStore(state => state.openRouterModel);
  const showToast = useToastStore(state => state.showToast);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      const res = await db.select<{ session_id: string, content: string, timestamp: string }[]>(`
        SELECT session_id, content, MIN(timestamp) as timestamp 
        FROM ai_chat_history 
        WHERE session_id IS NOT NULL 
        GROUP BY session_id 
        ORDER BY timestamp DESC
      `);
      
      const mappedSessions = res.map(row => ({
        id: row.session_id,
        title: row.content.substring(0, 30) + (row.content.length > 30 ? '...' : ''),
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
      const res = await db.select<Message[]>('SELECT * FROM ai_chat_history WHERE session_id = ? ORDER BY id ASC', [sessionId]);
      setMessages(res);
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
        'INSERT INTO ai_chat_history (session_id, role, content, image_path) VALUES (?, ?, ?, ?)',
        [msg.session_id, msg.role, msg.content, msg.image_path || null]
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

  const handleAnalyzeScreen = async () => {
    setIsTyping(true);
    try {
      logger.info("Triggering in-memory screen buffer capture...");
      const base64Image = await invoke<string>('capture_screen_base64');
      setDraftImagePath(base64Image);
      showToast("📸 Vision Buffer Captured");
    } catch (err) {
      logger.error(`Failed to analyze screen buffer: ${getErrorMessage(err)}`);
    } finally {
      setIsTyping(false);
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

  const fetchAIResponse = async (currentMessages: Message[], sessionId: string) => {
    try {
      const db = await getDb();
      const orResult = await db.select<{ encrypted_value: string }[]>(
        "SELECT encrypted_value FROM user_credentials WHERE id = 'openrouter_key'"
      );
      if (orResult.length === 0) {
        throw new Error("OpenRouter API key is not configured. Please add it in Settings.");
      }
      const openRouterKey = await invoke<string>('decrypt_data', { encoded: orResult[0].encrypted_value });

      if (!openRouterKey) {
        throw new Error("OpenRouter API key is invalid.");
      }

      const apiMessages = currentMessages.map(msg => {
        if (msg.image_path) {
          return {
            role: msg.role,
            content: [
              { type: 'text' as const, text: msg.content || "Analyze this image." },
              { type: 'image_url' as const, image_url: { url: msg.image_path } }
            ]
          };
        }
        return {
          role: msg.role,
          content: msg.content
        };
      });

      const apiPayload = [
        {
          role: 'system',
          content: `You are VectorHUD, a helpful overlay assistant for a gamer. Be extremely concise, formatted, and tactical in your answers.`
        },
        ...apiMessages
      ];

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "HTTP-Referer": "http://localhost:1420",
          "X-Title": "VectorHUD",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages: apiPayload
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "OpenRouter API request failed");
      }

      const assistantReply = data.choices[0].message.content;
      const assistantMsg: Message = { session_id: sessionId, role: 'assistant', content: assistantReply };
      
      setMessages(prev => [...prev, assistantMsg]);
      await saveMessage(assistantMsg);

    } catch (err: unknown) {
      logger.error(`OpenRouter Chat Failed: ${getErrorMessage(err)}`);
      const errorMsg: Message = { session_id: sessionId, role: 'assistant', content: `Error: ${getErrorMessage(err)}` };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-full bg-black/60 font-mono overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-1/3 border-r border-border-wire flex flex-col bg-black/40">
          <div className="p-3 border-b border-border-wire flex justify-between items-center bg-black/80">
            <span className="text-[10px] font-bold text-accent-amber tracking-widest uppercase">History</span>
            <button 
              onClick={createNewSession}
              className="text-zinc-400 hover:text-accent-green transition-colors p-1 rounded hover:bg-white/5"
              title="New Chat"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => setCurrentSessionId(session.id)}
                className={`flex items-center justify-between p-2 rounded-sm cursor-pointer transition-colors group ${
                  currentSessionId === session.id 
                    ? 'bg-accent-amber/10 border border-accent-amber/30 text-accent-amber' 
                    : 'hover:bg-white/5 border border-transparent text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare size={12} className="flex-shrink-0 opacity-70" />
                  <span className="text-xs truncate">{session.title}</span>
                </div>
                <button
                  onClick={(e) => deleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all p-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="text-[10px] text-zinc-600 text-center mt-4 italic">No chat history</div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
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
          <span className="text-[10px] text-zinc-600 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 uppercase tracking-widest">{openRouterModel.split('/').pop()}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar scroll-smooth">
          {messages.length === 0 && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-3 opacity-50">
              <MessageSquare size={32} />
              <div className="text-xs tracking-widest uppercase font-bold">Awaiting Input...</div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <span className="text-[9px] text-zinc-600 mb-1.5 uppercase tracking-widest px-1 font-bold">
                {msg.role === 'user' ? 'OPERATOR' : 'VECTOR_AI'}
              </span>
              <div className={`p-3.5 rounded-sm text-sm max-w-[90%] shadow-lg relative ${
                msg.role === 'user' 
                  ? 'bg-zinc-800/80 border-r-2 border-accent-amber text-zinc-100' 
                  : 'bg-black/60 border-l-2 border-accent-green text-zinc-300'
              }`}>
                {msg.image_path && (
                  <div className="mb-3 p-2 bg-black/50 border border-white/5 rounded-sm flex items-center gap-2 text-[10px] text-accent-green/80 italic w-fit">
                    <Camera size={12} />
                    <span>[ VISION_BUFFER_ATTACHED ]</span>
                  </div>
                )}
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
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
