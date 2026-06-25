import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface Toast {
  id: number;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string) => void;
  removeToast: (id: number) => void;
}

let toastIdCounter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message: string) => {
    const id = Date.now() * 1000 + (++toastIdCounter % 1000);
    
    // Move the window to the monitor with the active mouse cursor in the background
    invoke('move_to_active_monitor')
      .catch((err) => console.warn("Failed to move window to active monitor for toast:", err));

    set((state) => ({
      toasts: [...state.toasts, { id, message }]
    }));
    
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 4000); // 4 seconds duration
  },
  removeToast: (id: number) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }
}));
