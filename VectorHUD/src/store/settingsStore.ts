import { create } from 'zustand';
import { getSettingsStore } from '../utils/store';

interface SettingsState {
  isSettingsOpen: boolean;
  openRouterModel: string;
  globalFontSize: number;
  theme: string;
  customColor: string;
  recordMicrophone: boolean;
  recordSystemAudio: boolean;
  overlayHotkey: string;
  screenshotHotkey: string;
  recordHotkey: string;
  replayHotkey: string;
  timerHotkey: string;
  stopwatchHotkey: string;
  timerResetHotkey: string;
  
  toggleSettings: () => void;
  setOpenRouterModel: (model: string) => Promise<void>;
  setGlobalFontSize: (size: number) => Promise<void>;
  setTheme: (theme: string) => Promise<void>;
  setCustomColor: (color: string) => Promise<void>;
  setRecordMicrophone: (enabled: boolean) => Promise<void>;
  setRecordSystemAudio: (enabled: boolean) => Promise<void>;
  setOverlayHotkey: (hotkey: string) => Promise<void>;
  setScreenshotHotkey: (hotkey: string) => Promise<void>;
  setRecordHotkey: (hotkey: string) => Promise<void>;
  setReplayHotkey: (hotkey: string) => Promise<void>;
  setTimerHotkey: (hotkey: string) => Promise<void>;
  setStopwatchHotkey: (hotkey: string) => Promise<void>;
  setTimerResetHotkey: (hotkey: string) => Promise<void>;
  loadPreferences: () => Promise<void>;
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

export const useSettingsStore = create<SettingsState>((set) => ({
  isSettingsOpen: false,
  openRouterModel: 'openai/gpt-4o', // Default model
  globalFontSize: 14,
  theme: 'default',
  customColor: '#FF0000',
  recordMicrophone: false,
  recordSystemAudio: true,
  overlayHotkey: 'ctrl+alt+o',
  screenshotHotkey: 'ctrl+alt+s',
  recordHotkey: 'ctrl+alt+r',
  replayHotkey: 'ctrl+alt+b',
  timerHotkey: 'ctrl+alt+t',
  stopwatchHotkey: 'ctrl+alt+w',
  timerResetHotkey: 'ctrl+alt+y',

  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  setOpenRouterModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('openRouterModel', model);
    await store.save();
    set({ openRouterModel: model });
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

  loadPreferences: async () => {
    const store = await getSettingsStore();
    const model = await store.get<string>('openRouterModel');
    const fontSize = await store.get<number>('globalFontSize');
    const theme = await store.get<string>('theme');
    const customColor = await store.get<string>('customColor');
    const mic = await store.get<boolean>('recordMicrophone');
    const systemAudio = await store.get<boolean>('recordSystemAudio');
    const oHot = await store.get<string>('overlayHotkey');
    const sHot = await store.get<string>('screenshotHotkey');
    const rHot = await store.get<string>('recordHotkey');
    const rpHot = await store.get<string>('replayHotkey');
    const tHot = await store.get<string>('timerHotkey');
    const swHot = await store.get<string>('stopwatchHotkey');
    const trHot = await store.get<string>('timerResetHotkey');

    const finalTheme = theme || 'default';
    const finalColor = customColor || '#FF0000';

    set({
      openRouterModel: model || 'openai/gpt-4o',
      globalFontSize: fontSize || 14,
      theme: finalTheme,
      customColor: finalColor,
      recordMicrophone: mic !== undefined ? mic : false,
      recordSystemAudio: systemAudio !== undefined ? systemAudio : true,
      overlayHotkey: oHot || 'ctrl+alt+o',
      screenshotHotkey: sHot || 'ctrl+alt+s',
      recordHotkey: rHot || 'ctrl+alt+r',
      replayHotkey: rpHot || 'ctrl+alt+b',
      timerHotkey: tHot || 'ctrl+alt+t',
      stopwatchHotkey: swHot || 'ctrl+alt+w',
      timerResetHotkey: trHot || 'ctrl+alt+y',
    });

    applyThemeColors(finalTheme, finalColor);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_hotkeys', {
        overlayHotkey: oHot || 'ctrl+alt+o',
        screenshotHotkey: sHot || 'ctrl+alt+s',
        recordHotkey: rHot || 'ctrl+alt+r',
        replayHotkey: rpHot || 'ctrl+alt+b',
        timerHotkey: tHot || 'ctrl+alt+t',
        stopwatchHotkey: swHot || 'ctrl+alt+w',
        timerResetHotkey: trHot || 'ctrl+alt+y'
      });
    } catch (err) {
      console.error("Failed to sync hotkeys to Rust backend:", err);
    }

    if (fontSize) {
      document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    }
  }
}));
