import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

interface ShellState {
  isInteractive: boolean;
  ignoreFocusLoss: boolean;
  toggleInteractive: () => Promise<void>;
  setInteractive: (interactive: boolean) => Promise<void>;
  setIgnoreFocusLoss: (val: boolean) => void;
}

export const useShellStore = create<ShellState>((set, get) => ({
  isInteractive: false, // Default to ghost mode (non-interactive)
  ignoreFocusLoss: false,

  toggleInteractive: async () => {
    const newState = !get().isInteractive;
    await get().setInteractive(newState);
  },

  setInteractive: async (interactive: boolean) => {
    try {
      await invoke('set_interactive_mode', { interactive, interactablePins: false });
      set({ isInteractive: interactive });
      logger.info(`Shell interactive mode set to: ${interactive}`);
    } catch (err) {
      logger.error(`Failed to set interactive mode: ${err}`);
    }
  },

  setIgnoreFocusLoss: (val: boolean) => {
    set({ ignoreFocusLoss: val });
  }
}));
