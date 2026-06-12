import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';

export interface HardwareMetrics {
  cpu_usage: number;
  ram_usage_percent: number;
  ram_total_gb: number;
  ram_used_gb: number;
  gpu_usage: number;
  vram_usage_percent: number;
  vram_used_gb: number;
  fps: number;
  hud_cpu_usage?: number;
  hud_ram_usage_mb?: number;
  active_app?: string;
  is_fullscreen?: boolean;
}

interface HardwareState {
  latestMetrics: HardwareMetrics | null;
  setMetrics: (metrics: HardwareMetrics) => void;
  initialize: () => Promise<() => void>;
}

let unlistenFn: (() => void) | null = null;

export const useHardwareStore = create<HardwareState>((set) => ({
  latestMetrics: null,
  setMetrics: (metrics) => set({ latestMetrics: metrics }),
  initialize: async () => {
    if (unlistenFn) return unlistenFn;

    const unlisten = await listen<HardwareMetrics>('hardware-metrics-update', (event) => {
      set({ latestMetrics: event.payload });
    });

    unlistenFn = () => {
      unlisten();
      unlistenFn = null;
    };

    return unlistenFn;
  }
}));
