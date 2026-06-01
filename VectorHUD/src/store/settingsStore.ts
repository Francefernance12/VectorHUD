import { create } from 'zustand';
import { getSettingsStore } from '../utils/store';

interface SettingsState {
  isSettingsOpen: boolean;
  openRouterModel: string;
  globalFontSize: number;
  interactablePins: boolean;
  
  toggleSettings: () => void;
  setOpenRouterModel: (model: string) => Promise<void>;
  setGlobalFontSize: (size: number) => Promise<void>;
  setInteractablePins: (interactable: boolean) => Promise<void>;
  loadPreferences: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isSettingsOpen: false,
  openRouterModel: 'openai/gpt-4o', // Default model
  globalFontSize: 14,
  interactablePins: false,

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

  loadPreferences: async () => {
    const store = await getSettingsStore();
    const model = await store.get<string>('openRouterModel');
    const fontSize = await store.get<number>('globalFontSize');
    const interactable = await store.get<boolean>('interactablePins');

    set({
      openRouterModel: model || 'openai/gpt-4o',
      globalFontSize: fontSize || 14,
      interactablePins: interactable || false,
    });

    if (fontSize) {
      document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    }
  }
}));
