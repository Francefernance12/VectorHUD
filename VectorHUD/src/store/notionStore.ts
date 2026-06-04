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
  activeTab: 'draft' | 'notes';
  setActiveTab: (tab: 'draft' | 'notes') => void;
  notes: any[];
  setNotes: (notes: any[]) => void;
  expandedNoteId: string | null;
  setExpandedNoteId: (id: string | null) => void;
  noteBlocks: Record<string, any[]>;
  setNoteBlocks: (blocks: Record<string, any[]>) => void;
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
      activeTab: 'draft',
      setActiveTab: (tab) => set({ activeTab: tab }),
      notes: [],
      setNotes: (notes) => set({ notes }),
      expandedNoteId: null,
      setExpandedNoteId: (id) => set({ expandedNoteId: id }),
      noteBlocks: {},
      setNoteBlocks: (blocks) => set({ noteBlocks: blocks }),
    }),
    {
      name: 'vectorhud-notion-draft',
      partialize: (state) => ({ draft: state.draft }), // Only persist the draft
    }
  )
);
