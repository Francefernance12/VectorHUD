import { useEffect, useState } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface HardwareMetrics {
  cpu_usage: number;
  ram_usage_percent: number;
  ram_total_gb: number;
  ram_used_gb: number;
}

export function HardwareWidget() {
  const [cpuUsage, setCpuUsage] = useState(0);
  const [ramUsage, setRamUsage] = useState(0);
  const [ramTotal, setRamTotal] = useState(32); // GB
  const [ramUsed, setRamUsed] = useState(0);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    const setupListener = async () => {
      unlisten = await listen<HardwareMetrics>('hardware-metrics-update', (event) => {
        const payload = event.payload;
        setCpuUsage(Math.round(payload.cpu_usage));
        setRamUsage(Math.round(payload.ram_usage_percent));
        setRamTotal(parseFloat(payload.ram_total_gb.toFixed(1)));
        setRamUsed(parseFloat(payload.ram_used_gb.toFixed(1)));
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full text-text-primary font-mono text-sm p-4 space-y-6">
      
      {/* CPU Section */}
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-bold text-accent-green tracking-widest">CPU</span>
          <span className="text-accent-green font-bold">{cpuUsage}%</span>
        </div>
        <div className="w-full h-3 bg-black border border-border-wire rounded-sm overflow-hidden relative">
          <div 
            className="h-full bg-accent-green transition-all duration-500 ease-in-out"
            style={{ width: `${cpuUsage}%` }}
          />
        </div>
      </div>

      {/* RAM Section */}
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-bold text-accent-amber tracking-widest">RAM</span>
          <span className="text-accent-amber font-bold">{ramUsed} / {ramTotal} GB</span>
        </div>
        <div className="w-full h-3 bg-black border border-border-wire rounded-sm overflow-hidden relative">
          <div 
            className="h-full bg-accent-amber transition-all duration-500 ease-in-out"
            style={{ width: `${ramUsage}%` }}
          />
        </div>
      </div>

      {/* Status Footer */}
      <div className="mt-auto pt-4 border-t border-border-wire text-xs opacity-60 flex justify-between">
        <span>SYS: ONLINE</span>
        <span className="animate-pulse">● REC</span>
      </div>

    </div>
  );
}
