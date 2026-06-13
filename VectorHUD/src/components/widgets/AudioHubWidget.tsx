import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Volume2, VolumeX, Music, Play, Pause, SkipForward, SkipBack, Star, Mic } from 'lucide-react';
import { logger } from '../../utils/logger';
import { useAudioStore } from '../../store/audioStore';
import { useSettingsStore } from '../../store/settingsStore';

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
  const { favoriteApps, toggleFavoriteApp, currentMedia, setCurrentMedia } = useAudioStore();

  const {
    selectedAudioInput,
    selectedAudioOutput,
    microphoneVolume,
    microphoneMuted,
    setSelectedAudioInput,
    setSelectedAudioOutput,
    setMicrophoneVolume,
    setMicrophoneMuted
  } = useSettingsStore();

  const [devicesList, setDevicesList] = useState<{ inputs: any[], outputs: any[] }>({ inputs: [], outputs: [] });
  const [playPeakLevel, setPlayPeakLevel] = useState(0);
  const [recPeakLevel, setRecPeakLevel] = useState(0);

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
      setCurrentMedia(state);
    } catch (err) {
      // logger.error(`Failed to fetch media state: ${err}`);
    }
  };

  const fetchDevices = async () => {
    try {
      const dev = await invoke<any>('get_audio_devices');
      setDevicesList(dev);
    } catch (err) {
      // logger.error(`Failed to fetch audio devices: ${err}`);
    }
  };

  const playTestSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Try to route sound output to the chosen speaker
      if (selectedAudioOutput !== 'Default' && typeof (ctx.destination as any).setSinkId === 'function') {
        const match = devicesList.outputs.find(d => d.name === selectedAudioOutput);
        if (match) {
          (ctx.destination as any).setSinkId(match.id).catch(() => {});
        }
      }
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // 440Hz tone
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {
      logger.warn(`Failed to play test sound: ${err}`);
    }
  };

  useEffect(() => {
    let isActive = true;
    let pollInterval = 1000;
    let timeoutId: ReturnType<typeof setTimeout>;

    fetchDevices();

    const poll = async () => {
      if (!isActive) return;
      
      await fetchAudioState();
      await fetchMediaState();
      
      // If media is playing, poll faster, otherwise back off
      pollInterval = Math.min(5000, pollInterval + 500); // Backoff to 5s
      
      timeoutId = setTimeout(poll, pollInterval);
    };

    poll();

    // Reset polling speed when user interacts or state is refreshed
    const resetPoll = () => { pollInterval = 1000; };
    const handleRefresh = () => {
      fetchAudioState();
      fetchMediaState();
      fetchDevices();
      pollInterval = 1000;
    };

    window.addEventListener('mousemove', resetPoll);
    window.addEventListener('refresh-audio-state', handleRefresh);

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetPoll);
      window.removeEventListener('refresh-audio-state', handleRefresh);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const pollPeak = async () => {
      if (!active) return;
      try {
        const [playPeak, recPeak] = await invoke<[number, number]>('get_audio_peak_levels');
        setPlayPeakLevel(playPeak);
        setRecPeakLevel(recPeak);
      } catch {}
      setTimeout(pollPeak, 100);
    };
    pollPeak();
    return () => { active = false; };
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

  const handleMasterMuteToggle = async () => {
    try {
      await invoke('toggle_master_mute');
      fetchAudioState();
    } catch (err) {
      logger.error(`Failed to toggle master mute: ${err}`);
    }
  };

  const handleAppMuteToggle = async (pid: number) => {
    try {
      await invoke('toggle_app_mute', { pid });
      fetchAudioState();
    } catch (err) {
      logger.error(`Failed to toggle app mute: ${err}`);
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
      {currentMedia && (
        <div className="flex flex-col space-y-3 bg-black/40 border border-white/5 p-3 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-blue/20 rounded-md flex items-center justify-center text-accent-blue flex-shrink-0">
              <Music size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold truncate text-sm">{currentMedia.title}</div>
              <div className="text-zinc-400 truncate text-xs">{currentMedia.artist || currentMedia.album_artist}</div>
            </div>
          </div>
          
          <div className="flex justify-center items-center gap-6 pt-1">
            <button onClick={handlePrev} className="text-zinc-400 hover:text-white transition-colors">
              <SkipBack size={18} />
            </button>
            <button onClick={handlePlayPause} className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:bg-zinc-200 transition-colors">
              {currentMedia.is_playing ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-1" />}
            </button>
            <button onClick={handleNext} className="text-zinc-400 hover:text-white transition-colors">
              <SkipForward size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Hardware Interface Selectors & VU Meters */}
      <div className="flex flex-col space-y-4 bg-black/45 border border-white/5 p-3 rounded-lg">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Hardware Interfaces</div>
        
        {/* Output Selector & Test */}
        <div className="flex flex-col space-y-2">
          <label className="text-xs text-zinc-400">Speaker / Output Device</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedAudioOutput}
              onChange={(e) => setSelectedAudioOutput(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 px-3 py-2 outline-none rounded-sm font-mono cursor-pointer hover:border-zinc-700 transition-colors"
            >
              <option value="Default">Default System Device</option>
              {devicesList.outputs?.map(dev => (
                <option key={dev.id} value={dev.name}>{dev.name}</option>
              ))}
            </select>
            <button
              onClick={playTestSound}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-accent-green hover:text-accent-green text-xs font-bold uppercase transition-colors shrink-0 rounded-sm"
              title="Play test tone"
            >
              Test
            </button>
          </div>
          {/* Playback Peak Visualizer */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-8">OUT</span>
            <div className="flex-grow h-1.5 bg-zinc-800 rounded-sm overflow-hidden relative">
              <div 
                className="h-full bg-accent-green transition-all duration-75 ease-out"
                style={{ width: `${Math.min(100, playPeakLevel * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Input Selector & Volume */}
        <div className="flex flex-col space-y-2">
          <label className="text-xs text-zinc-400">Microphone / Input Device</label>
          <select
            value={selectedAudioInput}
            onChange={(e) => setSelectedAudioInput(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 px-3 py-2 outline-none rounded-sm font-mono cursor-pointer hover:border-zinc-700 transition-colors"
          >
            <option value="Default">Default System Device</option>
            {devicesList.inputs?.map(dev => (
              <option key={dev.id} value={dev.name}>{dev.name}</option>
            ))}
          </select>

          {/* Mic Volume Slider & Mute */}
          <div className="flex items-center gap-3 pt-1">
            <button 
              onClick={() => setMicrophoneMuted(!microphoneMuted)} 
              className="transition-colors hover:opacity-80"
              title={microphoneMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {microphoneMuted || microphoneVolume === 0 ? (
                <VolumeX size={15} className="text-red-400 animate-pulse" />
              ) : (
                <Mic size={15} className="text-accent-green" />
              )}
            </button>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={microphoneVolume}
              onChange={(e) => setMicrophoneVolume(parseInt(e.target.value))}
              className="flex-grow h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-accent-green"
            />
            <span className="text-xs text-zinc-400 w-8 text-right shrink-0">{microphoneVolume}%</span>
          </div>

          {/* Record Peak Visualizer */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 w-8">IN</span>
            <div className="flex-grow h-1.5 bg-zinc-800 rounded-sm overflow-hidden relative">
              <div 
                className="h-full bg-accent-green transition-all duration-75 ease-out"
                style={{ width: `${Math.min(100, recPeakLevel * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Master Volume Section */}
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">
          <span>Master Output</span>
          <span>{audioState ? Math.round(audioState.master_volume * 100) : 0}%</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleMasterMuteToggle} className="transition-colors hover:opacity-80">
            {audioState?.master_muted || (audioState && audioState.master_volume === 0) ? (
              <VolumeX size={16} className="text-red-400" />
            ) : (
              <Volume2 size={16} className="text-accent-green" />
            )}
          </button>
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
        
        {audioState?.sessions
          .filter(s => s.name !== "Unknown")
          .sort((a, b) => {
            const aFav = favoriteApps.includes(a.name);
            const bFav = favoriteApps.includes(b.name);
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;
            return a.name.localeCompare(b.name);
          })
          .map((session) => (
          <div key={session.process_id} className="flex flex-col space-y-1 group">
            <div className="flex justify-between items-center text-xs text-zinc-300">
              <div className="flex items-center gap-2 truncate pr-2">
                <button 
                  onClick={() => toggleFavoriteApp(session.name)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0"
                >
                  <Star 
                    size={12} 
                    className={favoriteApps.includes(session.name) ? "fill-accent-amber text-accent-amber" : "text-zinc-500 hover:text-accent-amber"} 
                  />
                </button>
                <span className={`truncate ${favoriteApps.includes(session.name) ? 'text-accent-amber font-bold' : ''}`}>{session.name}</span>
              </div>
              <span>{Math.round(session.volume * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => handleAppMuteToggle(session.process_id)} className="transition-colors hover:opacity-80">
                {session.muted || session.volume === 0 ? (
                  <VolumeX size={14} className="text-red-400" />
                ) : (
                  <Volume2 size={14} className="text-zinc-500" />
                )}
              </button>
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
