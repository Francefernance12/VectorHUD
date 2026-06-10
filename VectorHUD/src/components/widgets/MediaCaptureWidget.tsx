import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { listen } from '@tauri-apps/api/event';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { Trash2, Camera, Zap, Gamepad2, Monitor, FolderOpen } from 'lucide-react';
import { getDb, executeQuery } from '../../utils/db';
import { logger } from '../../utils/logger';
import { CaptureHistory } from '../../types';
import { useToastStore } from '../../store/toastStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useRecordingStore } from '../../store/recordingStore';
import { useShellStore } from '../../store/shellStore';

export function MediaCaptureWidget() {
  const [captures, setCaptures] = useState<CaptureHistory[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const { isRecording, setRecording, isReplayActive, setReplayActive, activeApp, setActiveApp, isFullscreen, setIsFullscreen, isKnownGame, setIsKnownGame } = useRecordingStore();

  const [expandedCapture, setExpandedCapture] = useState<CaptureHistory | null>(null);

  const fetchHistory = async () => {
    try {
      const db = await getDb();
      const res = await db.select<CaptureHistory[]>('SELECT * FROM capture_history ORDER BY timestamp DESC LIMIT 20');
      
      const validCaptures: CaptureHistory[] = [];
      for (const cap of res) {
        const normalizedPath = cap.file_path.replace(/\\/g, '/');
        const exists = await invoke<boolean>('check_file_exists', { path: normalizedPath });
        if (exists) {
          validCaptures.push({ ...cap, file_path: normalizedPath });
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
    const fetchRecordingStatus = async () => {
      try {
        const status = await invoke<{ is_recording: boolean, is_replay_active: boolean }>('get_recording_status');
        setRecording(status.is_recording);
        setReplayActive(status.is_replay_active);
      } catch (err) {
        logger.error(`Failed to get recording status: ${err}`);
      }
    };
    fetchRecordingStatus();

    const handleRefreshHistory = () => {
      fetchHistory();
    };
    window.addEventListener('refresh-capture-history', handleRefreshHistory);

    const unlistenMetrics = listen<{ active_app?: string, is_fullscreen?: boolean }>('hardware-metrics-update', (e) => {
      if (e.payload.active_app && e.payload.active_app !== activeApp) {
        setActiveApp(e.payload.active_app);
        // Check if known game
        getDb().then(db => {
          db.select<{process_name: string}[]>('SELECT process_name FROM known_games WHERE process_name = ?1', [e.payload.active_app])
            .then(res => setIsKnownGame(res.length > 0))
            .catch(console.error);
        });
      }
      if (e.payload.is_fullscreen !== undefined) {
        setIsFullscreen(e.payload.is_fullscreen);
      }
    });

    return () => {
      window.removeEventListener('refresh-capture-history', handleRefreshHistory);
      unlistenMetrics.then(fn => fn());
    };
  }, [setRecording, setReplayActive, activeApp]);

  useEffect(() => {
    const isGameActive = isKnownGame;
    if (activeApp === 'Desktop' || activeApp === '') {
      if (isReplayActive) {
        invoke('stop_replay_buffer')
          .then(() => {
            logger.info('Auto-stopped replay buffer (desktop active)');
            setReplayActive(false);
          })
          .catch(console.error);
      }
      return;
    }

    if (isGameActive && !isReplayActive && !isRecording) {
      const micEnabled = useSettingsStore.getState().recordMicrophone;
      const audioEnabled = useSettingsStore.getState().recordSystemAudio;
      const res = useSettingsStore.getState().replayResolution;
      const fps = useSettingsStore.getState().replayFps;
      invoke('start_replay_buffer', { micEnabled, audioEnabled, resolution: res, fps })
        .then(() => {
          logger.info('Auto-started replay buffer for game');
          setReplayActive(true);
        })
        .catch(err => logger.error(`Auto-start replay failed: ${err}`));
    } else if (!isGameActive && isReplayActive) {
      invoke('stop_replay_buffer')
        .then(() => {
          logger.info('Auto-stopped replay buffer (no game active)');
          setReplayActive(false);
        })
        .catch(err => logger.error(`Auto-stop replay failed: ${err}`));
    }
  }, [isKnownGame, isFullscreen, isReplayActive, isRecording, activeApp, setReplayActive]);

  const handleToggleGame = async () => {
    try {
      if (isKnownGame) {
        await executeQuery('DELETE FROM known_games WHERE process_name = ?1', [activeApp]);
        setIsKnownGame(false);
      } else {
        await executeQuery('INSERT OR IGNORE INTO known_games (process_name) VALUES (?1)', [activeApp]);
        setIsKnownGame(true);
      }
    } catch (err) {
      logger.error(`Toggle game failed: ${err}`);
    }
  };

  const handleScreenshot = async () => {
    setIsCapturing(true);
    try {
      const path = await invoke<string>('capture_screenshot');
      const normalizedPath = path.replace(/\\/g, '/');
      logger.info(`Screenshot saved to: ${normalizedPath}`);
      
      await executeQuery(
        'INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)',
        [normalizedPath, 'screenshot', 'Desktop']
      );

      await fetchHistory();
      useShellStore.getState().setInteractive(true);
    } catch (err) {
      logger.error(`Screenshot capture failed: ${err}`);
      useShellStore.getState().setInteractive(true);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      try {
        const path = await invoke<string>('stop_video_recording');
        const normalizedPath = path.replace(/\\/g, '/');
        logger.info(`Video recording saved to: ${normalizedPath}`);
        
        await executeQuery(
          'INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)',
          [normalizedPath, 'video', 'Desktop']
        );

        setRecording(false);
        await fetchHistory();
      } catch (err) {
        logger.error(`Stop recording failed: ${err}`);
      }
    } else {
      try {
        const micEnabled = useSettingsStore.getState().recordMicrophone;
        const audioEnabled = useSettingsStore.getState().recordSystemAudio;
        const path = await invoke<string>('start_video_recording', { micEnabled, audioEnabled });
        logger.info(`Video recording started: ${path}`);
        setRecording(true);
      } catch (err) {
        logger.error(`Start recording failed: ${err}`);
      }
    }
  };

  const handleToggleReplayBuffer = async () => {
    if (isReplayActive) {
      try {
        await invoke('stop_replay_buffer');
        logger.info('Replay buffer stopped');
        setReplayActive(false);
      } catch (err) {
        logger.error(`Stop replay buffer failed: ${err}`);
      }
    } else {
      try {
        const micEnabled = useSettingsStore.getState().recordMicrophone;
        const audioEnabled = useSettingsStore.getState().recordSystemAudio;
        const res = useSettingsStore.getState().replayResolution;
        const fps = useSettingsStore.getState().replayFps;
        try {
          await invoke('start_replay_buffer', { micEnabled, audioEnabled, resolution: res, fps });
          logger.info('Replay buffer started');
          setReplayActive(true);
        } catch (err) {
          logger.error(`Start replay buffer failed: ${err}`);
        }
      } catch (err) {
        logger.error(`Start replay buffer failed: ${err}`);
      }
    }
  };

  const handleSaveReplayClip = async () => {
    useToastStore.getState().showToast("⏳ Processing 30s Clip...");
    try {
      const path = await invoke<string>('save_replay_buffer');
      const normalizedPath = path.replace(/\\/g, '/');
      logger.info(`Replay clip saved: ${normalizedPath}`);

      await executeQuery(
        'INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)',
        [normalizedPath, 'video', 'Desktop']
      );

      await fetchHistory();
      useToastStore.getState().showToast("⚡ Replay Clip Saved");
    } catch (err) {
      logger.error(`Save replay failed: ${err}`);
      useToastStore.getState().showToast("❌ Failed to save replay");
    }
  };

  const openGalleryWindow = (cap: CaptureHistory) => {
    setExpandedCapture(cap);
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
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center bg-black/40 border border-white/5 p-2 rounded-sm mb-2">
          <div className="flex items-center gap-2 truncate text-xs text-zinc-300">
            {isKnownGame || isFullscreen ? <Gamepad2 size={14} className="text-accent-green" /> : <Monitor size={14} className="text-zinc-500" />}
            <span className="truncate">Active: <span className="font-bold text-white">{activeApp}</span></span>
          </div>
          {activeApp !== 'Desktop' && activeApp !== '' && (
            <button 
              onClick={handleToggleGame}
              className={`text-[10px] px-2 py-1 rounded-sm uppercase tracking-widest font-bold transition-colors ${
                isKnownGame ? 'bg-accent-green/20 text-accent-green hover:bg-red-500/20 hover:text-red-500' : 'bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white'
              }`}
            >
              {isKnownGame ? 'Unmark Game' : 'Mark Game'}
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handleScreenshot}
            disabled={isCapturing || isRecording}
            className={`flex-1 py-3 border rounded-sm font-bold tracking-wider transition-colors flex items-center justify-center gap-2 ${
              isCapturing 
                ? 'bg-accent-green/20 border-accent-green/50 text-accent-green cursor-wait' 
                : 'bg-black border-border-wire hover:bg-accent-green/10 hover:border-accent-green hover:text-accent-green disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            <Camera className="w-4 h-4" />
            {isCapturing ? 'CAPTURING...' : 'SCREENSHOT'}
          </button>

          <button 
            onClick={handleToggleRecording}
            disabled={isCapturing}
            className={`flex-1 py-3 border rounded-sm font-bold tracking-wider transition-colors flex items-center justify-center gap-2 ${
              isRecording 
                ? 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30' 
                : 'bg-black border-border-wire hover:bg-red-500/10 hover:border-red-500 hover:text-red-400 disabled:opacity-50'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
            {isRecording ? 'STOP REC' : 'RECORD'}
          </button>
        </div>

        <div className="flex gap-2">
          {!isReplayActive ? (
            <button 
              onClick={handleToggleReplayBuffer}
              disabled={isRecording || (!isKnownGame && !isFullscreen)}
              className="w-full py-3 bg-black border border-border-wire rounded-sm font-bold tracking-wider hover:bg-accent-amber/10 hover:border-accent-amber hover:text-accent-amber transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!isKnownGame && !isFullscreen ? "Replay buffer requires a Game to be active" : undefined}
            >
              <Zap className="w-4 h-4" />
              START REPLAY BUFFER
            </button>
          ) : (
            <>
              <button 
                onClick={handleSaveReplayClip}
                className="flex-1 py-3 bg-accent-amber/20 border border-accent-amber text-accent-amber rounded-sm font-bold tracking-wider hover:bg-accent-amber/30 transition-colors flex items-center justify-center gap-2 animate-pulse"
              >
                <Zap className="w-4 h-4 fill-accent-amber" />
                SAVE REPLAY (30S)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Gallery Section */}
      <div className="flex-1 border border-border-wire bg-black/50 rounded-sm overflow-hidden flex flex-col">
        <div className="bg-surface/80 border-b border-border-wire px-3 py-1 flex justify-between items-center text-xs text-accent-amber font-bold tracking-widest">
          <span>RECENT CAPTURES</span>
          <button 
            onClick={() => invoke('open_capture_folder')}
            className="text-zinc-500 hover:text-accent-amber transition-colors p-1 rounded hover:bg-white/5"
            title="Open Capture Folder"
          >
            <FolderOpen size={14} />
          </button>
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
                <div className="truncate flex-1 max-w-[75%] flex items-center gap-2">
                  <span className="opacity-60 flex items-center gap-1.5 shrink-0">
                    {cap.media_type === 'video' ? (
                      <>
                        <Zap size={11} className="text-accent-amber fill-accent-amber/20 animate-pulse" />
                        <span className="text-[9px] tracking-widest font-bold text-accent-amber uppercase">CLIP</span>
                      </>
                    ) : (
                      <>
                        <img 
                          src={convertFileSrc(cap.file_path)} 
                          alt="Thumbnail" 
                          className="w-8 h-5 object-cover rounded-[2px] border border-white/10"
                        />
                        <span className="text-[9px] tracking-widest font-bold text-accent-green uppercase">IMG</span>
                      </>
                    )}
                  </span>
                  <span className="truncate text-zinc-300 text-xs" title={cap.file_path}>{cap.file_path.split('/').pop() || cap.file_path.split('\\').pop()}</span>
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
      {expandedCapture && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-8 backdrop-blur-md pointer-events-auto cursor-pointer"
          onClick={() => setExpandedCapture(null)}
        >
          {expandedCapture.media_type === 'video' ? (
            <video 
              src={convertFileSrc(expandedCapture.file_path)} 
              controls 
              autoPlay 
              className="max-w-[90vw] max-h-[90vh] object-contain shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-border-wire/50 rounded-sm cursor-default font-sans"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img 
              src={convertFileSrc(expandedCapture.file_path)} 
              alt="Expanded Capture" 
              className="max-w-[90vw] max-h-[90vh] object-contain shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-border-wire/50 rounded-sm cursor-default"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <button 
            className="absolute top-8 right-8 text-white opacity-50 hover:opacity-100 text-3xl hover:text-accent-green transition-colors font-sans"
            onClick={() => setExpandedCapture(null)}
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
