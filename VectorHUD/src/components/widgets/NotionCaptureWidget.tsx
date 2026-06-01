import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen } from 'lucide-react';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../types';
import { getDb } from '../../utils/db';

export function NotionCaptureWidget() {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSyncToNotion = async () => {
    if (!note.trim()) return;

    setIsSubmitting(true);
    setStatus('Syncing to Notion...');

    try {
      const db = await getDb();
      const secretRes = await db.select<{ encrypted_value: string }[]>("SELECT encrypted_value FROM user_credentials WHERE id = 'notion_secret'");
      const dbIdRes = await db.select<{ encrypted_value: string }[]>("SELECT encrypted_value FROM user_credentials WHERE id = 'notion_db_id'");

      if (secretRes.length > 0 && dbIdRes.length > 0) {
        const token = await invoke<string>('decrypt_data', { encoded: secretRes[0].encrypted_value });
        const dbId = await invoke<string>('decrypt_data', { encoded: dbIdRes[0].encrypted_value });
        
        if (token && dbId) {
          await invoke('sync_to_notion', { note, token, dbId });
          setNote('');
          setStatus('Synced to Notion!');
          logger.info('Notion sync successful');
        } else {
          throw new Error("Notion API keys missing. Please add them in Settings.");
        }
      } else {
        throw new Error("Notion API keys missing. Please add them in Settings.");
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      logger.error(`Notion sync failed: ${msg}`);
      setStatus(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  const handleSaveLocal = async () => {
    if (!note.trim()) return;

    setIsSubmitting(true);
    setStatus('Saving locally...');

    try {
      await invoke('save_local_note', { note });
      setNote('');
      setStatus('Saved to local file!');
      logger.info('Local note save successful');
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      logger.error(`Local save failed: ${msg}`);
      setStatus(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full text-text-primary font-mono p-4 bg-black/40 relative group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-accent-amber tracking-widest uppercase">Quick Capture</span>
          <button 
            onClick={() => invoke('open_notes_folder')}
            className="text-zinc-500 hover:text-accent-amber transition-colors p-1 rounded-md hover:bg-white/5 opacity-0 group-hover:opacity-100"
            title="Open local notes folder"
          >
            <FolderOpen size={14} />
          </button>
        </div>
        {status && (
          <span className={`text-[10px] ${status.includes('Error') ? 'text-red-400' : 'text-accent-green'}`}>
            {status}
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSyncToNotion();
            }
          }}
          placeholder="Jot down a thought, coordinate, or reminder..."
          className="flex-1 bg-transparent border border-border-wire rounded-sm p-3 outline-none resize-none focus:border-accent-amber focus:bg-accent-amber/5 transition-colors text-sm custom-scrollbar"
        />
        <div className="flex gap-2 mt-3">
          <button 
            type="button" 
            onClick={handleSyncToNotion}
            disabled={!note.trim() || isSubmitting}
            className="flex-1 py-2 bg-black border border-border-wire rounded-sm hover:bg-accent-amber/10 hover:border-accent-amber hover:text-accent-amber transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold tracking-wider text-xs"
          >
            {isSubmitting ? '...' : 'SYNC'}
          </button>
          <button 
            type="button" 
            onClick={handleSaveLocal}
            disabled={!note.trim() || isSubmitting}
            className="flex-1 py-2 bg-black border border-border-wire rounded-sm hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold tracking-wider text-xs text-zinc-400 hover:text-white"
          >
            SAVE LOCAL
          </button>
        </div>
      </div>
    </div>
  );
}
