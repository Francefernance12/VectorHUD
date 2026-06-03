import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Volume2, VolumeX, Mic, MicOff, Music, Play, Pause, SkipForward, SkipBack } from 'lucide-react';
import { logger } from '../../utils/logger';

interface AudioSession {
  process_id: number;
  name: string;
  volume: number;
  muted: boolean;
}

interface SystemAudio {
  master_volume: number;
  master_muted: boolean;
  sessions: AudioSession[];
}

interface MediaMetadata {
  title: string;
  artist: string;
  album_artist: string;
  is_playing: boolean;
}

export function AudioHubWidget() {
  const [audioState, setAudioState] = useState<SystemAudio | null>(null);
  const [mediaState, setMediaState] = useState<MediaMetadata | null>(null);

  const fetchAudioState = async () => {
    try {
      const state = await invoke<SystemAudio>('get_audio_mixer_state');
      setAudioState(state);
    } catch (err) {
      // logger.error(`Failed to fetch audio state: ${err}`);
    }
  };

  const fetchMediaState = async () => {
    try {
      const state = await invoke<MediaMetadata | null>('get_current_media');
      setMediaState(state);
    } catch (err) {
      // logger.error(`Failed to fetch media state: ${err}`);
    }
  };

  useEffect(() => {
    fetchAudioState();
    fetchMediaState();

    const interval = setInterval(() => {
      fetchAudioState();
      fetchMediaState();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAppVolumeChange = async (pid: number, volume: number) => {
    try {
      await invoke('set_app_volume', { pid, volume: volume / 100 });
      fetchAudioState();
    } catch (err) {
      logger.error(`Failed to set app volume: ${err}`);
    }
  };

  const handleMasterVolumeChange = async (volume: number) => {
    try {
      await invoke('set_master_volume', { volume: volume / 100 });
      fetchAudioState();
    } catch (err) {
      logger.error(`Failed to set master volume: ${err}`);
    }
  };

  const handlePlayPause = async () => {
    try {
      await invoke('media_play_pause');
      fetchMediaState();
    } catch (err) {}
  };

  const handleNext = async () => {
    try {
      await invoke('media_next');
      fetchMediaState();
    } catch (err) {}
  };

  const handlePrev = async () => {
    try {
      await invoke('media_prev');
      fetchMediaState();
    } catch (err) {}
  };

  return (
    <div className="flex flex-col h-full text-text-primary font-mono text-sm p-4 space-y-6 overflow-y-auto custom-scrollbar">
      
      {/* Media Player Section */}
      {mediaState && (
        <div className="flex flex-col space-y-3 bg-black/40 border border-white/5 p-3 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-blue/20 rounded-md flex items-center justify-center text-accent-blue flex-shrink-0">
              <Music size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold truncate text-sm">{mediaState.title}</div>
              <div className="text-zinc-400 truncate text-xs">{mediaState.artist || mediaState.album_artist}</div>
            </div>
          </div>
          
          <div className="flex justify-center items-center gap-6 pt-1">
            <button onClick={handlePrev} className="text-zinc-400 hover:text-white transition-colors">
              <SkipBack size={18} />
            </button>
            <button onClick={handlePlayPause} className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:bg-zinc-200 transition-colors">
              {mediaState.is_playing ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-1" />}
            </button>
            <button onClick={handleNext} className="text-zinc-400 hover:text-white transition-colors">
              <SkipForward size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Master Volume Section */}
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
          <span>Master Output</span>
          <span>{audioState ? Math.round(audioState.master_volume * 100) : 0}%</span>
        </div>
        <div className="flex items-center gap-3">
          {audioState?.master_muted || (audioState && audioState.master_volume === 0) ? (
            <VolumeX size={16} className="text-red-400" />
          ) : (
            <Volume2 size={16} className="text-accent-green" />
          )}
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={audioState ? Math.round(audioState.master_volume * 100) : 0}
            onChange={(e) => handleMasterVolumeChange(parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-accent-green"
          />
        </div>
      </div>

      <div className="w-full h-px bg-white/5 my-2" />

      {/* App Mixer Section */}
      <div className="flex flex-col space-y-4">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">App Mixer</div>
        
        {audioState?.sessions.filter(s => s.name !== "Unknown").map((session) => (
          <div key={session.process_id} className="flex flex-col space-y-1">
            <div className="flex justify-between items-center text-xs text-zinc-300">
              <span className="truncate pr-2">{session.name}</span>
              <span>{Math.round(session.volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <Volume2 size={14} className="text-zinc-500" />
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={Math.round(session.volume * 100)}
                onChange={(e) => handleAppVolumeChange(session.process_id, parseInt(e.target.value))}
                className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-zinc-300 hover:accent-accent-blue transition-colors"
              />
            </div>
          </div>
        ))}
        
        {audioState?.sessions.length === 0 && (
          <div className="text-xs text-zinc-600 text-center py-4">No active audio sources</div>
        )}
      </div>

    </div>
  );
}
