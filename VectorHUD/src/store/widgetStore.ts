import { create } from 'zustand';

export interface WidgetDefinition {
  id: string;
  label: string;
  iconName: string;
  defaultWidth: number;
  defaultHeight: number;
}

export const WIDGETS: WidgetDefinition[] = [
  { id: 'hardware-metrics', label: 'Hardware', iconName: 'Cpu', defaultWidth: 300, defaultHeight: 400 },
  { id: 'media-capture', label: 'Media', iconName: 'Camera', defaultWidth: 400, defaultHeight: 300 },
  { id: 'audio-mixer', label: 'Audio', iconName: 'Volume2', defaultWidth: 350, defaultHeight: 500 },
];

export interface WidgetInstance {
  id: string;
  zIndex: number;
  isPinned: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WidgetState {
  activeWidgets: Record<string, WidgetInstance>;
  topZIndex: number;
  toggleWidget: (id: string) => void;
  bringToFront: (id: string) => void;
  updateWidgetBounds: (id: string, bounds: Partial<{x: number, y: number, width: number, height: number}>) => void;
  togglePin: (id: string) => void;
  setInitialState: (widgets: Record<string, WidgetInstance>) => void;
}

export const useWidgetStore = create<WidgetState>((set) => ({
  activeWidgets: {},
  topZIndex: 10,
  
  setInitialState: (widgets) => set((state) => {
    // Calculate the highest z-index to avoid overlap issues
    let highestZ = 10;
    Object.values(widgets).forEach(w => {
      if (w.zIndex > highestZ) highestZ = w.zIndex;
    });
    return { activeWidgets: widgets, topZIndex: highestZ };
  }),

  toggleWidget: (id) => set((state) => {
    const isActive = !!state.activeWidgets[id];
    if (isActive) {
      // Remove widget
      const newWidgets = { ...state.activeWidgets };
      delete newWidgets[id];
      return { activeWidgets: newWidgets };
    } else {
      // Add widget with highest z-index
      const newZ = state.topZIndex + 1;
      const widgetDef = WIDGETS.find(w => w.id === id);
      if (!widgetDef) return state;

      return {
        topZIndex: newZ,
        activeWidgets: {
          ...state.activeWidgets,
          [id]: { 
            id, 
            zIndex: newZ,
            isPinned: false,
            x: 100 + ((newZ % 10) * 20), 
            y: 100 + ((newZ % 10) * 20),
            width: widgetDef.defaultWidth,
            height: widgetDef.defaultHeight
          }
        }
      };
    }
  }),
  
  bringToFront: (id) => set((state) => {
    if (!state.activeWidgets[id]) return state;
    const newZ = state.topZIndex + 1;
    return {
      topZIndex: newZ,
      activeWidgets: {
        ...state.activeWidgets,
        [id]: { ...state.activeWidgets[id], zIndex: newZ }
      }
    };
  }),

  updateWidgetBounds: (id, bounds) => set((state) => {
    if (!state.activeWidgets[id]) return state;
    return {
      activeWidgets: {
        ...state.activeWidgets,
        [id]: { ...state.activeWidgets[id], ...bounds }
      }
    };
  }),

  togglePin: (id) => set((state) => {
    if (!state.activeWidgets[id]) return state;
    return {
      activeWidgets: {
        ...state.activeWidgets,
        [id]: { ...state.activeWidgets[id], isPinned: !state.activeWidgets[id].isPinned }
      }
    };
  }),
}));
