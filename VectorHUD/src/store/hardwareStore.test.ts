import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useHardwareStore } from './hardwareStore';

// Mock Tauri's event listener
const mockListen = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({
  listen: (event: string, callback: (e: any) => void) => {
    mockListen(event, callback);
    // Return an unlisten function
    return Promise.resolve(() => {});
  }
}));

describe('hardwareStore', () => {
  beforeEach(() => {
    useHardwareStore.setState({ latestMetrics: null });
    mockListen.mockClear();
  });

  it('should initialize with null metrics', () => {
    expect(useHardwareStore.getState().latestMetrics).toBeNull();
  });

  it('should set metrics correctly', () => {
    const metrics = {
      cpu_usage: 12,
      ram_usage_percent: 45,
      ram_total_gb: 16,
      ram_used_gb: 7.2,
      gpu_usage: 25,
      vram_usage_percent: 30,
      vram_used_gb: 2.4,
      fps: 60
    };
    useHardwareStore.getState().setMetrics(metrics);
    expect(useHardwareStore.getState().latestMetrics).toEqual(metrics);
  });

  it('should register event listener on initialize', async () => {
    const unlisten = await useHardwareStore.getState().initialize();
    expect(mockListen).toHaveBeenCalledWith('hardware-metrics-update', expect.any(Function));
    expect(unlisten).toBeTypeOf('function');
  });
});
