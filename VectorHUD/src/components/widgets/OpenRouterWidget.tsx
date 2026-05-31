import { useState, useRef, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getDb } from '../../utils/db';
import { logger } from '../../utils/logger';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string; // base64 data url
}

interface ApiKeys {
  openrouter?: string;
  notion_token?: string;
  notion_db_id?: string;
}

const MODELS = [
  { id: 'google/gemini-flash-1.5-8b', name: 'Gemini Flash 1.5' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
];

export function OpenRouterWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [attachedImagePath, setAttachedImagePath] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleAttachScreenshot = async () => {
    try {
      const db = await getDb();
      const res = await db.select<any[]>('SELECT file_path FROM capture_history WHERE media_type = ? ORDER BY timestamp DESC LIMIT 1', ['screenshot']);
      if (res.length > 0) {
        setAttachedImagePath(res[0].file_path);
        logger.info(`Attached screenshot: ${res[0].file_path}`);
      } else {
        logger.warn("No recent screenshots found to attach.");
      }
    } catch (err) {
      logger.error(`Failed to attach screenshot: ${err}`);
    }
  };

  const getBase64FromAsset = async (path: string): Promise<string> => {
    const url = convertFileSrc(path);
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !attachedImagePath) return;

    let base64Image: string | undefined = undefined;
    if (attachedImagePath) {
      try {
        base64Image = await getBase64FromAsset(attachedImagePath);
      } catch (err) {
        logger.error(`Failed to convert image to base64: ${err}`);
      }
    }

    const newMessage: Message = { role: 'user', content: input, image: base64Image };
    const updatedMessages = [...messages, newMessage];
    
    setMessages(updatedMessages);
    setInput('');
    setAttachedImagePath(null);
    setIsTyping(true);

    try {
      const keys = await invoke<ApiKeys>('get_api_keys');
      if (!keys.openrouter) {
        throw new Error("OpenRouter API key missing from .env");
      }

      // Convert messages for API payload
      const apiMessages = updatedMessages.map(msg => {
        if (msg.image) {
          return {
            role: msg.role,
            content: [
              { type: 'text', text: msg.content },
              { type: 'image_url', image_url: { url: msg.image } }
            ]
          };
        }
        return {
          role: msg.role,
          content: msg.content
        };
      });

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keys.openrouter}`,
          'HTTP-Referer': 'http://localhost:1420', // Required by OpenRouter
          'X-Title': 'VectorHUD', // Required by OpenRouter
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages
        })
      });

      const data = await res.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'API Error');
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.choices[0].message.content
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      logger.error(`AI Error: ${err}`);
      setMessages(prev => [...prev, { role: 'assistant', content: `[ERROR] ${err.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full text-text-primary font-mono text-sm p-4 space-y-4">
      {/* Header Controls */}
      <div className="flex gap-2 mb-2">
        <select 
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="flex-1 bg-black border border-border-wire rounded-sm p-2 outline-none text-xs"
        >
          {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button 
          onClick={handleAttachScreenshot}
          className="bg-black border border-border-wire rounded-sm p-2 hover:bg-white/5 hover:text-accent-amber transition-colors"
          title="Attach latest screenshot"
        >
          📸 ATTACH
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 border border-border-wire bg-black/50 rounded-sm overflow-hidden flex flex-col relative p-3 gap-3 overflow-y-auto custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center opacity-40 italic text-center px-4">
            Awaiting tactical input. Attach a screenshot or ask a question.
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] border rounded-sm p-2 ${
                msg.role === 'user' 
                  ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' 
                  : 'bg-white/5 border-border-wire text-text-secondary'
              }`}>
                {msg.image && (
                  <img src={msg.image} alt="Attached" className="w-full max-h-32 object-cover border border-border-wire/50 mb-2 rounded-sm" />
                )}
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))
        )}
        {isTyping && (
          <div className="flex items-start">
            <div className="bg-white/5 border border-border-wire rounded-sm p-2 text-text-secondary italic opacity-70">
              Processing...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="mt-auto flex flex-col gap-2">
        {attachedImagePath && (
          <div className="flex justify-between items-center bg-accent-amber/10 border border-accent-amber/30 text-accent-amber px-2 py-1 rounded-sm text-xs">
            <span className="truncate flex-1">Attached: {attachedImagePath.split('/').pop()}</span>
            <button type="button" onClick={() => setAttachedImagePath(null)} className="ml-2 hover:text-white">✕</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Query tactical database..."
            className="flex-1 bg-black border border-border-wire rounded-sm p-2 outline-none focus:border-accent-green focus:bg-accent-green/5 transition-colors"
          />
          <button 
            type="submit" 
            disabled={(!input.trim() && !attachedImagePath) || isTyping}
            className="bg-black border border-border-wire rounded-sm px-4 hover:bg-accent-green/10 hover:border-accent-green hover:text-accent-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          >
            SEND
          </button>
        </div>
      </form>
    </div>
  );
}
