import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';

interface ApiKeys {
  openrouter?: string;
  notion_token?: string;
  notion_db_id?: string;
}

export function NotionCaptureWidget() {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;

    setIsSubmitting(true);
    setStatus('Syncing...');

    try {
      const keys = await invoke<ApiKeys>('get_api_keys');
      if (!keys.notion_token || !keys.notion_db_id) {
        throw new Error("Notion API keys missing from .env");
      }

      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keys.notion_token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parent: { database_id: keys.notion_db_id },
          properties: {
            "title": { // Assuming default 'Title' or 'Name' column in Notion databases is universally accessible as "title" type
              title: [
                {
                  text: {
                    content: note
                  }
                }
              ]
            }
          }
        })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to sync to Notion');
      }

      setNote('');
      setStatus('Synced successfully!');
      logger.info('Notion sync successful');
      
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      logger.error(`Notion sync failed: ${err}`);
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full text-text-primary font-mono p-4 bg-black/40">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-accent-amber tracking-widest uppercase">Quick Capture</span>
        {status && (
          <span className={`text-[10px] ${status.includes('Error') ? 'text-red-400' : 'text-accent-green'}`}>
            {status}
          </span>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Jot down a thought, coordinate, or reminder..."
          className="flex-1 bg-transparent border border-border-wire rounded-sm p-3 outline-none resize-none focus:border-accent-amber focus:bg-accent-amber/5 transition-colors text-sm custom-scrollbar"
        />
        <button 
          type="submit" 
          disabled={!note.trim() || isSubmitting}
          className="mt-3 py-2 bg-black border border-border-wire rounded-sm hover:bg-accent-amber/10 hover:border-accent-amber hover:text-accent-amber transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold tracking-wider text-xs"
        >
          {isSubmitting ? 'SYNCING TO NOTION...' : 'SYNC'}
        </button>
      </form>
    </div>
  );
}
