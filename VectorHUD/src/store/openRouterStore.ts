import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface OpenRouterState {
  input: string;
  draftImagePath: string | null;
  sidebarOpen: boolean;
  setInput: (input: string) => void;
  setDraftImagePath: (path: string | null) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  clearDraft: () => void;
}

export const useOpenRouterStore = create<OpenRouterState>()(
  persist(
    (set) => ({
      input: '',
      draftImagePath: null,
      sidebarOpen: false,
      setInput: (input) => set({ input }),
      setDraftImagePath: (draftImagePath) => set({ draftImagePath }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      clearDraft: () => set({ input: '', draftImagePath: null }),
    }),
    {
      name: 'vectorhud-openrouter-draft',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
