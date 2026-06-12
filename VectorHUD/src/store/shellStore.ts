import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

interface ShellState {
  isInteractive: boolean;
  isOverlayOpen: boolean;
  ignoreFocusLoss: boolean;
  toggleInteractive: () => Promise<void>;
  setInteractive: (interactive: boolean) => Promise<void>;
  setOverlayOpen: (open: boolean) => void;
  setIgnoreFocusLoss: (val: boolean) => void;
}

export const useShellStore = create<ShellState>((set, get) => ({
  isInteractive: false, // Default to ghost mode (non-interactive)
  isOverlayOpen: false,
  ignoreFocusLoss: false,

  toggleInteractive: async () => {
    const newState = !get().isOverlayOpen;
    set({ isOverlayOpen: newState });
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

  setOverlayOpen: (open: boolean) => {
    set({ isOverlayOpen: open });
  },

  setIgnoreFocusLoss: (val: boolean) => {
    set({ ignoreFocusLoss: val });
  }
}));
