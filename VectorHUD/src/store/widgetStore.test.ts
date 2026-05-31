import { describe, it, expect, beforeEach } from 'vitest';
import { useWidgetStore } from './widgetStore';

describe('widgetStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useWidgetStore.setState({ activeWidgets: {}, topZIndex: 10 });
  });

  it('should initialize empty state', () => {
    const state = useWidgetStore.getState();
    expect(state.activeWidgets).toEqual({});
    expect(state.topZIndex).toBe(10);
  });

  it('should toggle a new widget on', () => {
    const store = useWidgetStore.getState();
    
    // Toggle hardware metrics widget (defined in WIDGETS)
    store.toggleWidget('hardware-metrics');
    
    const newState = useWidgetStore.getState();
    expect(newState.activeWidgets['hardware-metrics']).toBeDefined();
    expect(newState.activeWidgets['hardware-metrics'].isPinned).toBe(false);
    expect(newState.topZIndex).toBe(11);
    expect(newState.activeWidgets['hardware-metrics'].zIndex).toBe(11);
  });

  it('should update widget bounds', () => {
    const store = useWidgetStore.getState();
    store.toggleWidget('hardware-metrics');
    
    // Update the bounds
    useWidgetStore.getState().updateWidgetBounds('hardware-metrics', { x: 500, width: 800 });
    
    const updatedState = useWidgetStore.getState();
    expect(updatedState.activeWidgets['hardware-metrics'].x).toBe(500);
    expect(updatedState.activeWidgets['hardware-metrics'].width).toBe(800);
  });

  it('should toggle pinning state', () => {
    const store = useWidgetStore.getState();
    store.toggleWidget('media-capture');
    
    expect(useWidgetStore.getState().activeWidgets['media-capture'].isPinned).toBe(false);
    
    useWidgetStore.getState().togglePin('media-capture');
    expect(useWidgetStore.getState().activeWidgets['media-capture'].isPinned).toBe(true);
    
    useWidgetStore.getState().togglePin('media-capture');
    expect(useWidgetStore.getState().activeWidgets['media-capture'].isPinned).toBe(false);
  });
});
