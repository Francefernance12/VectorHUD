import { create } from 'zustand';
import { getSettingsStore } from '../utils/store';

interface SettingsState {
  isSettingsOpen: boolean;
  openRouterModel: string;
  openaiModel: string;
  anthropicModel: string;
  groqModel: string;
  customOpenRouterModel: string;
  useCustomOpenRouterModel: boolean;
  aiProvider: string;
  globalFontSize: number;
  theme: string;
  customColor: string;
  recordMicrophone: boolean;
  recordSystemAudio: boolean;
  replayResolution: string;
  replayFps: number;
  overlayHotkey: string;
  screenshotHotkey: string;
  recordHotkey: string;
  replayHotkey: string;
  timerHotkey: string;
  stopwatchHotkey: string;
  timerResetHotkey: string;
  voicePttHotkey: string;
  
  toggleSettings: () => void;
  setOpenRouterModel: (model: string) => Promise<void>;
  setOpenaiModel: (model: string) => Promise<void>;
  setAnthropicModel: (model: string) => Promise<void>;
  setGroqModel: (model: string) => Promise<void>;
  setCustomOpenRouterModel: (model: string) => Promise<void>;
  setUseCustomOpenRouterModel: (use: boolean) => Promise<void>;
  setAiProvider: (provider: string) => Promise<void>;
  setGlobalFontSize: (size: number) => Promise<void>;
  setTheme: (theme: string) => Promise<void>;
  setCustomColor: (color: string) => Promise<void>;
  setRecordMicrophone: (enabled: boolean) => Promise<void>;
  setRecordSystemAudio: (enabled: boolean) => Promise<void>;
  setReplayResolution: (res: string) => Promise<void>;
  setReplayFps: (fps: number) => Promise<void>;
  setOverlayHotkey: (hotkey: string) => Promise<void>;
  setScreenshotHotkey: (hotkey: string) => Promise<void>;
  setRecordHotkey: (hotkey: string) => Promise<void>;
  setReplayHotkey: (hotkey: string) => Promise<void>;
  setTimerHotkey: (hotkey: string) => Promise<void>;
  setStopwatchHotkey: (hotkey: string) => Promise<void>;
  setTimerResetHotkey: (hotkey: string) => Promise<void>;
  setVoicePttHotkey: (hotkey: string) => Promise<void>;
  loadPreferences: () => Promise<void>;
  syncHotkeys: () => Promise<void>;
}

const applyThemeColors = (theme: string, customColor: string) => {
  const root = document.documentElement;
  const hexToRgb = (hex: string) => {
    let c = hex.substring(1);      // strip #
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    return `${parseInt(c.slice(0, 2), 16)}, ${parseInt(c.slice(2, 4), 16)}, ${parseInt(c.slice(4, 6), 16)}`;
  };

  const setColors = (hex: string) => {
    root.style.setProperty('--accent-amber', hex);
    root.style.setProperty('--accent-green', hex);
    root.style.setProperty('--accent-amber-rgb', hexToRgb(hex));
    root.style.setProperty('--accent-green-rgb', hexToRgb(hex));
  };

  if (theme === 'custom' && customColor) {
    setColors(customColor);
  } else if (theme === 'amber') {
    setColors('#FFB000');
  } else if (theme === 'neon_blue') {
    setColors('#00F0FF');
  } else if (theme === 'matrix_green') {
    setColors('#00FF41');
  } else if (theme === 'outrun_pink') {
    setColors('#FF00FF');
  } else {
    // Default
    root.style.setProperty('--accent-amber', '#FFB000');
    root.style.setProperty('--accent-amber-rgb', '255, 176, 0');
    root.style.setProperty('--accent-green', '#4AF626');
  }
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isSettingsOpen: false,
  openRouterModel: 'google/gemini-2.5-flash',
  openaiModel: 'gpt-4o-mini',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  groqModel: 'llama-3.3-70b-versatile',
  customOpenRouterModel: '',
  useCustomOpenRouterModel: false,
  aiProvider: 'openrouter',
  globalFontSize: 14,
  theme: 'default',
  customColor: '#FF0000',
  recordMicrophone: false,
  recordSystemAudio: true,
  replayResolution: '720p',
  replayFps: 30,
  overlayHotkey: 'ctrl+alt+o',
  screenshotHotkey: 'ctrl+alt+s',
  recordHotkey: 'ctrl+alt+r',
  replayHotkey: 'ctrl+alt+b',
  timerHotkey: 'ctrl+alt+t',
  stopwatchHotkey: 'ctrl+alt+w',
  timerResetHotkey: 'ctrl+alt+y',
  voicePttHotkey: 'ctrl+alt+v',

  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  setOpenRouterModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('openRouterModel', model);
    await store.save();
    set({ openRouterModel: model });
  },

  setOpenaiModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('openaiModel', model);
    await store.save();
    set({ openaiModel: model });
  },

  setAnthropicModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('anthropicModel', model);
    await store.save();
    set({ anthropicModel: model });
  },

  setGroqModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('groqModel', model);
    await store.save();
    set({ groqModel: model });
  },

  setCustomOpenRouterModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('customOpenRouterModel', model);
    await store.save();
    set({ customOpenRouterModel: model });
  },

  setUseCustomOpenRouterModel: async (use) => {
    const store = await getSettingsStore();
    await store.set('useCustomOpenRouterModel', use);
    await store.save();
    set({ useCustomOpenRouterModel: use });
  },

  setAiProvider: async (provider) => {
    const store = await getSettingsStore();
    await store.set('aiProvider', provider);
    await store.save();
    set({ aiProvider: provider });
  },

  setGlobalFontSize: async (size) => {
    const store = await getSettingsStore();
    await store.set('globalFontSize', size);
    await store.save();
    set({ globalFontSize: size });
    // Apply font size globally via CSS variable
    document.documentElement.style.setProperty('--base-font-size', `${size}px`);
  },

  setTheme: async (theme) => {
    const store = await getSettingsStore();
    await store.set('theme', theme);
    await store.save();
    set({ theme });
    applyThemeColors(theme, useSettingsStore.getState().customColor);
  },

  setCustomColor: async (customColor) => {
    const store = await getSettingsStore();
    await store.set('customColor', customColor);
    await store.save();
    set({ customColor });
    applyThemeColors(useSettingsStore.getState().theme, customColor);
  },

  setRecordMicrophone: async (enabled) => {
    const store = await getSettingsStore();
    await store.set('recordMicrophone', enabled);
    await store.save();
    set({ recordMicrophone: enabled });
  },

  setRecordSystemAudio: async (enabled) => {
    const store = await getSettingsStore();
    await store.set('recordSystemAudio', enabled);
    await store.save();
    set({ recordSystemAudio: enabled });
  },

  setReplayResolution: async (res) => {
    const store = await getSettingsStore();
    await store.set('replayResolution', res);
    await store.save();
    set({ replayResolution: res });
  },

  setReplayFps: async (fps) => {
    const store = await getSettingsStore();
    await store.set('replayFps', fps);
    await store.save();
    set({ replayFps: fps });
  },

  setOverlayHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('overlayHotkey', hotkey);
    await store.save();
    set({ overlayHotkey: hotkey });
  },

  setScreenshotHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('screenshotHotkey', hotkey);
    await store.save();
    set({ screenshotHotkey: hotkey });
  },

  setRecordHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('recordHotkey', hotkey);
    await store.save();
    set({ recordHotkey: hotkey });
  },

  setReplayHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('replayHotkey', hotkey);
    await store.save();
    set({ replayHotkey: hotkey });
  },

  setTimerHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('timerHotkey', hotkey);
    await store.save();
    set({ timerHotkey: hotkey });
  },

  setStopwatchHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('stopwatchHotkey', hotkey);
    await store.save();
    set({ stopwatchHotkey: hotkey });
  },

  setTimerResetHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('timerResetHotkey', hotkey);
    await store.save();
    set({ timerResetHotkey: hotkey });
  },

  setVoicePttHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('voicePttHotkey', hotkey);
    await store.save();
    set({ voicePttHotkey: hotkey });
  },

  loadPreferences: async () => {
    const store = await getSettingsStore();
    const model = await store.get<string>('openRouterModel');
    const oaiModel = await store.get<string>('openaiModel');
    const antModel = await store.get<string>('anthropicModel');
    const grqModel = await store.get<string>('groqModel');
    const customOrModel = await store.get<string>('customOpenRouterModel');
    const useCustomOr = await store.get<boolean>('useCustomOpenRouterModel');
    const provider = await store.get<string>('aiProvider');
    const fontSize = await store.get<number>('globalFontSize');
    const theme = await store.get<string>('theme');
    const customColor = await store.get<string>('customColor');
    const mic = await store.get<boolean>('recordMicrophone');
    const systemAudio = await store.get<boolean>('recordSystemAudio');
    const rRes = await store.get<string>('replayResolution');
    const rFps = await store.get<number>('replayFps');
    const oHot = await store.get<string>('overlayHotkey');
    const sHot = await store.get<string>('screenshotHotkey');
    const rHot = await store.get<string>('recordHotkey');
    const rpHot = await store.get<string>('replayHotkey');
    const tHot = await store.get<string>('timerHotkey');
    const swHot = await store.get<string>('stopwatchHotkey');
    const trHot = await store.get<string>('timerResetHotkey');
    const vpHot = await store.get<string>('voicePttHotkey');

    const finalTheme = theme || 'default';
    const finalColor = customColor || '#FF0000';

    set({
      openRouterModel: model || 'google/gemini-2.5-flash',
      openaiModel: oaiModel || 'gpt-4o-mini',
      anthropicModel: antModel || 'claude-3-5-sonnet-20241022',
      groqModel: grqModel || 'llama-3.3-70b-versatile',
      customOpenRouterModel: customOrModel || '',
      useCustomOpenRouterModel: useCustomOr !== undefined ? useCustomOr : false,
      aiProvider: provider || 'openrouter',
      globalFontSize: fontSize || 14,
      theme: finalTheme,
      customColor: finalColor,
      recordMicrophone: mic !== undefined ? mic : false,
      recordSystemAudio: systemAudio !== undefined ? systemAudio : true,
      replayResolution: rRes || '720p',
      replayFps: rFps || 30,
      overlayHotkey: oHot || 'ctrl+alt+o',
      screenshotHotkey: sHot || 'ctrl+alt+s',
      recordHotkey: rHot || 'ctrl+alt+r',
      replayHotkey: rpHot || 'ctrl+alt+b',
      timerHotkey: tHot || 'ctrl+alt+t',
      stopwatchHotkey: swHot || 'ctrl+alt+w',
      timerResetHotkey: trHot || 'ctrl+alt+y',
      voicePttHotkey: vpHot || 'ctrl+alt+v',
    });

    applyThemeColors(finalTheme, finalColor);

    try {
      await get().syncHotkeys();
    } catch (err) {
      console.error("Failed to sync hotkeys to Rust backend:", err);
    }

    if (fontSize) {
      document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    }
  },

  syncHotkeys: async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const state = get();
    await invoke('update_hotkeys', {
      overlayHotkey: state.overlayHotkey,
      screenshotHotkey: state.screenshotHotkey,
      recordHotkey: state.recordHotkey,
      replayHotkey: state.replayHotkey,
      timerHotkey: state.timerHotkey,
      stopwatchHotkey: state.stopwatchHotkey,
      timerResetHotkey: state.timerResetHotkey,
      voicePttHotkey: state.voicePttHotkey
    });
  }
}));
