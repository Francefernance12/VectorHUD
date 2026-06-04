import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Square } from 'lucide-react';
import { useRecordingStore } from '../store/recordingStore';
import { executeQuery } from '../utils/db';
import { logger } from '../utils/logger';

export function RecordingStatusBar() {
  const { isRecording, elapsedSeconds, incrementElapsed, resetElapsed, setRecording } = useRecordingStore();

  useEffect(() => {
    if (!isRecording) {
      resetElapsed();
      return;
    }

    const interval = setInterval(() => {
      incrementElapsed();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isRecording, incrementElapsed, resetElapsed]);

  const handleStop = async () => {
    try {
      const path = await invoke<string>('stop_video_recording');
      logger.info(`Video recording stopped via status bar: ${path}`);
      
      await executeQuery(
        'INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)',
        [path, 'video', 'Desktop']
      );

      setRecording(false);
      resetElapsed();

      // Notify MediaCaptureWidget if it is open to reload its list
      window.dispatchEvent(new CustomEvent('refresh-capture-history'));
    } catch (err) {
      logger.error(`Stop recording from status bar failed: ${err}`);
    }
  };

  if (!isRecording) return null;

  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-x-0 top-4 z-[9999] pointer-events-auto flex justify-center">
      <div 
        className="bg-[#0F0F0F]/90 backdrop-blur-md border border-red-500/40 rounded-full px-4 py-1.5 flex items-center gap-3 shadow-[0_0_15px_rgba(239,68,68,0.2)] text-white font-mono text-xs select-none"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="tracking-widest font-bold">REC {formatTime(elapsedSeconds)}</span>
        
        <span className="w-[1px] h-3 bg-zinc-800" />
        
        <button 
          onClick={handleStop}
          className="p-1 rounded hover:bg-red-500/20 text-red-500 hover:text-red-400 transition-colors flex items-center justify-center cursor-pointer"
          title="Stop Recording"
        >
          <Square size={10} className="fill-red-500/20" />
        </button>
      </div>
    </div>
  );
}
