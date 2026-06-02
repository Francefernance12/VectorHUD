import { create } from 'zustand';
import { getSettingsStore } from '../utils/store';

interface SettingsState {
  isSettingsOpen: boolean;
  openRouterModel: string;
  globalFontSize: number;
  interactablePins: boolean;
  recordMicrophone: boolean;
  recordSystemAudio: boolean;
  overlayHotkey: string;
  screenshotHotkey: string;
  recordHotkey: string;
  replayHotkey: string;
  
  toggleSettings: () => void;
  setOpenRouterModel: (model: string) => Promise<void>;
  setGlobalFontSize: (size: number) => Promise<void>;
  setInteractablePins: (interactable: boolean) => Promise<void>;
  setRecordMicrophone: (enabled: boolean) => Promise<void>;
  setRecordSystemAudio: (enabled: boolean) => Promise<void>;
  setOverlayHotkey: (hotkey: string) => Promise<void>;
  setScreenshotHotkey: (hotkey: string) => Promise<void>;
  setRecordHotkey: (hotkey: string) => Promise<void>;
  setReplayHotkey: (hotkey: string) => Promise<void>;
  loadPreferences: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isSettingsOpen: false,
  openRouterModel: 'openai/gpt-4o', // Default model
  globalFontSize: 14,
  interactablePins: false,
  recordMicrophone: false,
  recordSystemAudio: true,
  overlayHotkey: 'ctrl+alt+o',
  screenshotHotkey: 'ctrl+alt+s',
  recordHotkey: 'ctrl+alt+r',
  replayHotkey: 'ctrl+alt+b',

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

  setInteractablePins: async (interactable) => {
    const store = await getSettingsStore();
    await store.set('interactablePins', interactable);
    await store.save();
    set({ interactablePins: interactable });
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

  loadPreferences: async () => {
    const store = await getSettingsStore();
    const model = await store.get<string>('openRouterModel');
    const fontSize = await store.get<number>('globalFontSize');
    const interactable = await store.get<boolean>('interactablePins');
    const mic = await store.get<boolean>('recordMicrophone');
    const systemAudio = await store.get<boolean>('recordSystemAudio');
    const oHot = await store.get<string>('overlayHotkey');
    const sHot = await store.get<string>('screenshotHotkey');
    const rHot = await store.get<string>('recordHotkey');
    const rpHot = await store.get<string>('replayHotkey');

    set({
      openRouterModel: model || 'openai/gpt-4o',
      globalFontSize: fontSize || 14,
      interactablePins: interactable || false,
      recordMicrophone: mic !== undefined ? mic : false,
      recordSystemAudio: systemAudio !== undefined ? systemAudio : true,
      overlayHotkey: oHot || 'ctrl+alt+o',
      screenshotHotkey: sHot || 'ctrl+alt+s',
      recordHotkey: rHot || 'ctrl+alt+r',
      replayHotkey: rpHot || 'ctrl+alt+b',
    });

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_hotkeys', {
        overlayHotkey: oHot || 'ctrl+alt+o',
        screenshotHotkey: sHot || 'ctrl+alt+s',
        recordHotkey: rHot || 'ctrl+alt+r',
        replayHotkey: rpHot || 'ctrl+alt+b'
      });
    } catch (err) {
      console.error("Failed to sync hotkeys to Rust backend:", err);
    }

    if (fontSize) {
      document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    }
  }
}));
