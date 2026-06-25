import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AttachedFile {
  name: string;
  path: string;
  content: string;
  size: number;
  lines: number;
}

interface OpenRouterState {
  input: string;
  draftImagePath: string | null;
  sidebarOpen: boolean;
  attachedFiles: AttachedFile[];
  setInput: (input: string) => void;
  setDraftImagePath: (path: string | null) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setAttachedFiles: (files: AttachedFile[]) => void;
  currentSessionId: string;
  setCurrentSessionId: (id: string) => void;
  clearDraft: () => void;
}

export const useOpenRouterStore = create<OpenRouterState>()(
  persist(
    (set) => ({
      input: '',
      draftImagePath: null,
      sidebarOpen: false,
      attachedFiles: [],
      setInput: (input) => set({ input }),
      setDraftImagePath: (draftImagePath) => set({ draftImagePath }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setAttachedFiles: (attachedFiles) => set({ attachedFiles }),
      currentSessionId: '',
      setCurrentSessionId: (currentSessionId) => set({ currentSessionId }),
      clearDraft: () => set({ input: '', draftImagePath: null, attachedFiles: [] }),
    }),
    {
      name: 'vectorhud-openrouter-draft',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        input: state.input, 
        sidebarOpen: state.sidebarOpen, 
        currentSessionId: state.currentSessionId,
        attachedFiles: state.attachedFiles
      }),
    }
  )
);
