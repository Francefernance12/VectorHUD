import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';
import { useSettingsStore } from './settingsStore';

interface ShellState {
  isInteractive: boolean;
  toggleInteractive: () => Promise<void>;
  setInteractive: (interactive: boolean) => Promise<void>;
}

export const useShellStore = create<ShellState>((set, get) => ({
  isInteractive: false, // Default to ghost mode (non-interactive)

  toggleInteractive: async () => {
    const newState = !get().isInteractive;
    await get().setInteractive(newState);
  },

  setInteractive: async (interactive: boolean) => {
    try {
      const interactablePins = useSettingsStore.getState().interactablePins;
      await invoke('set_interactive_mode', { interactive, interactablePins });
      set({ isInteractive: interactive });
      logger.info(`Shell interactive mode set to: ${interactive}, Pins Interactable: ${interactablePins}`);
    } catch (err) {
      logger.error(`Failed to set interactive mode: ${err}`);
    }
  }
}));
