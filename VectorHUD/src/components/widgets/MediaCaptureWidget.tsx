import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { Trash2 } from 'lucide-react';
import { getDb, executeQuery } from '../../utils/db';
import { logger } from '../../utils/logger';

interface CaptureHistory {
  id: number;
  file_path: string;
  media_type: string;
  timestamp: string;
}

export function MediaCaptureWidget() {
  const [captures, setCaptures] = useState<CaptureHistory[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);

  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      const db = await getDb();
      const res = await db.select<CaptureHistory[]>('SELECT * FROM capture_history ORDER BY timestamp DESC LIMIT 20');
      
      const validCaptures: CaptureHistory[] = [];
      for (const cap of res) {
        const exists = await invoke<boolean>('check_file_exists', { path: cap.file_path });
        if (exists) {
          validCaptures.push(cap);
        } else {
          logger.info(`Cleaning up ghost capture record for ${cap.file_path}`);
          await db.execute('DELETE FROM capture_history WHERE id = ?1', [cap.id]);
        }
      }
      setCaptures(validCaptures);
    } catch (err) {
      logger.error(`Failed to fetch history: ${err}`);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleScreenshot = async () => {
    setIsCapturing(true);
    try {
      const path = await invoke<string>('capture_screenshot');
      logger.info(`Screenshot saved to: ${path}`);
      
      await executeQuery(
        'INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)',
        [path, 'screenshot', 'Desktop']
      );

      await fetchHistory();
    } catch (err) {
      logger.error(`Screenshot capture failed: ${err}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const openGalleryWindow = (cap: CaptureHistory) => {
    setExpandedImage(convertFileSrc(cap.file_path));
  };

  const handleDelete = async (cap: CaptureHistory, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('delete_capture', { path: cap.file_path });
      const db = await getDb();
      await db.execute('DELETE FROM capture_history WHERE id = ?1', [cap.id]);
      setCaptures(prev => prev.filter(c => c.id !== cap.id));
      logger.info(`Deleted capture ${cap.file_path}`);
    } catch (err) {
      logger.error(`Failed to delete capture: ${err}`);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full text-text-primary font-mono text-sm p-4 space-y-4">
      
      {/* Header Controls */}
      <div className="flex gap-2">
        <button 
          onClick={handleScreenshot}
          disabled={isCapturing}
          className={`flex-1 py-3 border rounded-sm font-bold tracking-wider transition-colors ${
            isCapturing 
              ? 'bg-accent-green/20 border-accent-green/50 text-accent-green cursor-wait' 
              : 'bg-black border-border-wire hover:bg-accent-green/10 hover:border-accent-green hover:text-accent-green'
          }`}
        >
          {isCapturing ? 'CAPTURING...' : 'TAKE SCREENSHOT'}
        </button>
        <button 
          disabled
          className="flex-1 py-3 bg-black border border-border-wire rounded-sm font-bold tracking-wider opacity-50 cursor-not-allowed"
          title="Video recording will be implemented in a future update"
        >
          RECORD 30s
        </button>
      </div>

      {/* Gallery Section */}
      <div className="flex-1 border border-border-wire bg-black/50 rounded-sm overflow-hidden flex flex-col">
        <div className="bg-surface/80 border-b border-border-wire px-3 py-1 text-xs text-accent-amber font-bold tracking-widest">
          RECENT CAPTURES
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {captures.length === 0 ? (
            <div className="h-full flex items-center justify-center opacity-50 italic">
              No recent captures found.
            </div>
          ) : (
            captures.map((cap) => (
              <div 
                key={cap.id} 
                onClick={() => openGalleryWindow(cap)}
                className="flex justify-between items-center p-2 border border-border-wire/50 hover:bg-white/5 cursor-pointer transition-colors group"
              >
                <div className="truncate flex-1 max-w-[70%]">
                  <span className="opacity-60 mr-2">[{cap.media_type.toUpperCase()}]</span>
                  <span className="truncate" title={cap.file_path}>{cap.file_path.split('/').pop()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="opacity-50 text-xs">{cap.timestamp}</div>
                  <button 
                    onClick={(e) => handleDelete(cap, e)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-500 rounded transition-all"
                    title="Delete capture"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Inline Portal Gallery Modal */}
      {expandedImage && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-8 backdrop-blur-md pointer-events-auto cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
          <img 
            src={expandedImage} 
            alt="Expanded Capture" 
            className="max-w-full max-h-full object-contain shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-border-wire/50 rounded-sm cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            className="absolute top-8 right-8 text-white opacity-50 hover:opacity-100 text-3xl hover:text-accent-green transition-colors font-sans"
            onClick={() => setExpandedImage(null)}
          >
            ✕
          </button>
        </div>,
        document.body
      )}

      {/* Footer Info */}
      <div className="mt-auto pt-2 border-t border-border-wire text-xs opacity-60 flex justify-between">
        <span>DEST: ~/Pictures/VectorHUD</span>
        <span>{captures.length} ITEMS</span>
      </div>

    </div>
    </>
  );
}
