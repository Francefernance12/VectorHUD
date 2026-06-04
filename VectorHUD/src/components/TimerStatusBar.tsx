import { Timer, Clock } from 'lucide-react';
import { useTimerStore } from '../store/timerStore';
import { useShellStore } from '../store/shellStore';

export function TimerStatusBar() {
  const { swTime, swIsRunning, cdTime, cdIsRunning, cdInput, cdFinished } = useTimerStore();
  const isInteractive = useShellStore((state) => state.isInteractive);

  const showSw = swTime > 0 || swIsRunning;
  // Show countdown if it's running, or if it has been modified but not reset, or if it finished
  const showCd = cdIsRunning || (cdTime > 0 && cdTime !== cdInput) || cdFinished;

  if (!showSw && !showCd) return null;

  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`fixed inset-x-0 top-14 z-[9998] ${isInteractive ? 'pointer-events-auto' : 'pointer-events-none'} flex justify-center`}>
      <div className="bg-[#0F0F0F]/90 backdrop-blur-md border border-white/10 rounded-full px-4 py-1.5 flex items-center gap-6 shadow-2xl text-white font-mono text-xs select-none">
      {showCd && (
        <div className="flex items-center gap-2">
          <Timer size={14} className={cdFinished ? "text-accent-rose animate-pulse" : "text-accent-amber"} />
          <span className={`font-bold tracking-widest ${cdFinished ? 'text-accent-rose animate-pulse' : ''}`}>
            {formatTime(cdTime)}
          </span>
        </div>
      )}
      
      {showSw && showCd && <div className="w-[1px] h-3 bg-white/20" />}
      
      {showSw && (
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-accent-cyan" />
          <span className="font-bold tracking-widest">{formatTime(swTime)}</span>
        </div>
      )}
      </div>
    </div>
  );
}
