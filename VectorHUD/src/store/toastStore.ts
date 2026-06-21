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

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (message: string) => {
    const id = Date.now();
    
    // First, ask the backend to position the overlay on the monitor where the mouse cursor is
    invoke('move_to_active_monitor')
      .catch((err) => console.warn("Failed to move window to active monitor for toast:", err))
      .finally(() => {
        set((state) => ({
          toasts: [...state.toasts, { id, message }]
        }));
        
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
          }));
        }, 4000); // 4 seconds duration
      });
  },
  removeToast: (id: number) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }
}));
