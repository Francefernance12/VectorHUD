import { useEffect, useState, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useSettingsStore } from '../../store/settingsStore';
import { useToastStore } from '../../store/toastStore';
import { AlertTriangle } from 'lucide-react';

interface HardwareMetrics {
  cpu_usage: number;
  ram_usage_percent: number;
  ram_total_gb: number;
  ram_used_gb: number;
  gpu_usage: number;
  vram_usage_percent: number;
  vram_used_gb: number;
  fps: number;
  hud_cpu_usage: number;
  hud_ram_usage_mb: number;
  cpu_temp?: number;
  gpu_temp?: number;
}

export function HardwareWidget() {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [ramUsage, setRamUsage] = useState(0);
  const [ramTotal, setRamTotal] = useState(32); // GB
  const [ramUsed, setRamUsed] = useState(0);
  const [gpuUsage, setGpuUsage] = useState(0);
  const [vramUsage, setVramUsage] = useState(0);
  const [vramUsed, setVramUsed] = useState(0);
  const [fps, setFps] = useState(0);
  const [hudCpuUsage, setHudCpuUsage] = useState(0);
  const [hudRamUsageMb, setHudRamUsageMb] = useState(0);
  
  // Temperatures
  const [cpuTemp, setCpuTemp] = useState<number | null>(null);
  const [gpuTemp, setGpuTemp] = useState<number | null>(null);

  // Settings thresholds
  const { cpuTempAlertThreshold, gpuTempAlertThreshold } = useSettingsStore();

  // Alert throttling refs (prevent toast spamming, limit to every 60s)
  const lastCpuAlertRef = useRef<number>(0);
  const lastGpuAlertRef = useRef<number>(0);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      unlisten = await listen<HardwareMetrics>('hardware-metrics-update', (event) => {
        const payload = event.payload;
        setCpuUsage(Math.round(payload.cpu_usage));
        setRamUsage(Math.round(payload.ram_usage_percent));
        setRamTotal(parseFloat(payload.ram_total_gb.toFixed(1)));
        setRamUsed(parseFloat(payload.ram_used_gb.toFixed(1)));
        setGpuUsage(Math.round(payload.gpu_usage));
        setVramUsage(Math.round(payload.vram_usage_percent));
        setVramUsed(parseFloat(payload.vram_used_gb.toFixed(1)));
        setFps(payload.fps);
        setHudCpuUsage(payload.hud_cpu_usage || 0);
        setHudRamUsageMb(payload.hud_ram_usage_mb || 0);

        // Temperatures
        const cTemp = payload.cpu_temp !== undefined && payload.cpu_temp !== null ? Math.round(payload.cpu_temp) : null;
        const gTemp = payload.gpu_temp !== undefined && payload.gpu_temp !== null ? Math.round(payload.gpu_temp) : null;
        setCpuTemp(cTemp);
        setGpuTemp(gTemp);

        // Alert Triggers
        const now = Date.now();
        if (cTemp && cTemp >= cpuTempAlertThreshold) {
          if (now - lastCpuAlertRef.current > 60000) {
            useToastStore.getState().showToast(`⚠️ CPU TEMPERATURE CRITICAL: ${cTemp}°C`);
            lastCpuAlertRef.current = now;
          }
        }
        if (gTemp && gTemp >= gpuTempAlertThreshold) {
          if (now - lastGpuAlertRef.current > 60000) {
            useToastStore.getState().showToast(`⚠️ GPU TEMPERATURE CRITICAL: ${gTemp}°C`);
            lastGpuAlertRef.current = now;
          }
        }
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [cpuTempAlertThreshold, gpuTempAlertThreshold]);

  const cpuOverheated = cpuTemp !== null && cpuTemp >= cpuTempAlertThreshold;
  const gpuOverheated = gpuTemp !== null && gpuTemp >= gpuTempAlertThreshold;

  return (
    <div className="flex flex-col h-full text-text-primary font-mono text-sm p-4 space-y-4">
      
      {/* CPU Section */}
      <div className="flex flex-col space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className={`font-bold tracking-widest flex items-center gap-1.5 ${cpuOverheated ? 'text-red-500 animate-pulse' : 'text-accent-green'}`}>
            CPU {cpuTemp !== null ? `(${cpuTemp}°C)` : '(--°C)'}
            {cpuOverheated && <AlertTriangle size={12} className="text-red-500 animate-bounce" />}
          </span>
          <span className={`font-bold ${cpuOverheated ? 'text-red-500' : 'text-accent-green'}`}>{cpuUsage}%</span>
        </div>
        <div className="w-full h-2 bg-black border border-border-wire rounded-sm overflow-hidden relative">
          <div 
            className={`h-full transition-all duration-500 ease-in-out ${cpuOverheated ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-accent-green'}`}
            style={{ width: `${cpuUsage}%` }}
          />
        </div>
      </div>

      {/* GPU Section */}
      <div className="flex flex-col space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className={`font-bold tracking-widest flex items-center gap-1.5 ${gpuOverheated ? 'text-red-500 animate-pulse' : 'text-accent-green'}`}>
            GPU {gpuTemp !== null ? `(${gpuTemp}°C)` : '(--°C)'}
            {gpuOverheated && <AlertTriangle size={12} className="text-red-500 animate-bounce" />}
          </span>
          <span className={`font-bold ${gpuOverheated ? 'text-red-500' : 'text-accent-green'}`}>{gpuUsage}%</span>
        </div>
        <div className="w-full h-2 bg-black border border-border-wire rounded-sm overflow-hidden relative">
          <div 
            className={`h-full transition-all duration-500 ease-in-out ${gpuOverheated ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-accent-green'}`}
            style={{ width: `${gpuUsage}%` }}
          />
        </div>
      </div>

      {/* RAM Section */}
      <div className="flex flex-col space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-accent-amber tracking-widest">RAM</span>
          <span className="text-accent-amber font-bold">{ramUsed} / {ramTotal} GB</span>
        </div>
        <div className="w-full h-2 bg-black border border-border-wire rounded-sm overflow-hidden relative">
          <div 
            className="h-full bg-accent-amber transition-all duration-500 ease-in-out"
            style={{ width: `${ramUsage}%` }}
          />
        </div>
      </div>

      {/* VRAM Section */}
      <div className="flex flex-col space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-accent-green tracking-widest">VRAM</span>
          <span className="text-accent-green font-bold">{vramUsed} GB</span>
        </div>
        <div className="w-full h-2 bg-black border border-border-wire rounded-sm overflow-hidden relative">
          <div 
            className="h-full bg-accent-green transition-all duration-500 ease-in-out"
            style={{ width: `${vramUsage}%` }}
          />
        </div>
      </div>

      {/* Status Footer */}
      <div className="mt-auto pt-2 border-t border-border-wire text-xs opacity-60 flex justify-between items-center">
        <span>FPS: {fps > 0 ? fps : '--'}</span>
        <span className="animate-pulse">● REC</span>
      </div>

      {/* Overlay Perf Section */}
      <div className="pt-2 border-t border-border-wire text-xs opacity-70 flex justify-between items-center bg-black/30 px-2 py-1 rounded">
        <span>HUD CPU: {hudCpuUsage.toFixed(1)}%</span>
        <span>HUD RAM: {hudRamUsageMb.toFixed(0)} MB</span>
      </div>
    </div>
  );
}
