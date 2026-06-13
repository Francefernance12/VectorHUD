import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NotionNote {
  id: string;
  title: string;
  description: string;
  status: string;
  date: string;
}

export interface NotionBlock {
  id: string;
  b_type: string;
  task_text: string;
  checked: boolean;
}

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
  notes: NotionNote[];
  setNotes: (notes: NotionNote[]) => void;
  expandedNoteId: string | null;
  setExpandedNoteId: (id: string | null) => void;
  noteBlocks: Record<string, NotionBlock[]>;
  setNoteBlocks: (blocks: Record<string, NotionBlock[]>) => void;
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
