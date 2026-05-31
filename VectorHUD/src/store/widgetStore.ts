import { create } from 'zustand';

export interface WidgetDefinition {
  id: string;
  label: string;
  iconName: string;
}

export const WIDGETS: WidgetDefinition[] = [
  { id: 'hardware-metrics', label: 'Hardware', iconName: 'Cpu' },
  { id: 'media-capture', label: 'Media', iconName: 'Camera' },
  { id: 'audio-mixer', label: 'Audio', iconName: 'Volume2' },
];

interface WidgetState {
  activeWidgets: Record<string, boolean>;
  toggleWidget: (id: string) => void;
  setWidgetActive: (id: string, active: boolean) => void;
}

export const useWidgetStore = create<WidgetState>((set) => ({
  activeWidgets: {},
  toggleWidget: (id) => set((state) => ({
    activeWidgets: { ...state.activeWidgets, [id]: !state.activeWidgets[id] }
  })),
  setWidgetActive: (id, active) => set((state) => ({
    activeWidgets: { ...state.activeWidgets, [id]: active }
  })),
}));
