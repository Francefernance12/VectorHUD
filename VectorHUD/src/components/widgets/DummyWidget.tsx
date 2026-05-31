export function DummyWidget() {
  return (
    <div className="w-full h-full p-4 text-zinc-400 font-mono text-[11px] flex flex-col gap-2 overflow-y-auto">
      <div className="flex justify-between items-center border-b border-border-wire/30 pb-2 mb-2">
        <span className="text-accent-green tracking-widest">SYSTEM.STATUS</span>
        <span className="text-primary font-bold">ONLINE</span>
      </div>
      <p className="flex justify-between"><span>CPU_USAGE</span> <span className="text-accent-amber">42%</span></p>
      <p className="flex justify-between"><span>GPU_TEMP</span> <span>65°C</span></p>
      <p className="flex justify-between"><span>MEM_ALLOC</span> <span>8.2GB</span></p>
      <p className="flex justify-between"><span>NET_DOWN</span> <span>120Mb/s</span></p>
      
      <div className="mt-4 p-2 bg-black/50 rounded border border-border-wire/20">
        <p className="text-accent-green animate-pulse">&gt; waiting for telemetry...</p>
      </div>
      
      <p className="text-[9px] mt-auto opacity-40 text-center uppercase tracking-widest">
        Drag bottom-right corner to resize
      </p>
    </div>
  );
}
