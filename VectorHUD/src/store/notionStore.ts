import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotionDraft {
  title: string;
  description: string;
  content: string;
  tasks: string[];
}

interface NotionState {
  draft: NotionDraft;
  updateDraft: (updates: Partial<NotionDraft>) => void;
  clearDraft: () => void;
}

const defaultDraft: NotionDraft = {
  title: '',
  description: '',
  content: '',
  tasks: [''] // Start with one empty task input
};

export const useNotionStore = create<NotionState>()(
  persist(
    (set) => ({
      draft: defaultDraft,
      updateDraft: (updates) => 
        set((state) => ({ 
          draft: { ...state.draft, ...updates } 
        })),
      clearDraft: () => set({ draft: defaultDraft }),
    }),
    {
      name: 'vectorhud-notion-draft',
      partialize: (state) => ({ draft: state.draft }), // Only persist the draft
    }
  )
);
