import { useTimerStore } from '../../store/timerStore';
import { useState } from 'react';

export function TimerWidget() {
  const [activeTab, setActiveTab] = useState<'stopwatch' | 'countdown'>('countdown');
  
  const swTime = useTimerStore(state => state.swTime);
  const swIsRunning = useTimerStore(state => state.swIsRunning);
  const startSw = useTimerStore(state => state.startSw);
  const pauseSw = useTimerStore(state => state.pauseSw);
  const resetSw = useTimerStore(state => state.resetSw);

  const cdInput = useTimerStore(state => state.cdInput);
  const cdTime = useTimerStore(state => state.cdTime);
  const cdIsRunning = useTimerStore(state => state.cdIsRunning);
  const cdFinished = useTimerStore(state => state.cdFinished);
  const setCdInput = useTimerStore(state => state.setCdInput);
  const startCd = useTimerStore(state => state.startCd);
  const pauseCd = useTimerStore(state => state.pauseCd);
  const resetCd = useTimerStore(state => state.resetCd);

  const formatTime = (timeInSeconds: number) => {
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const s = (timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col h-full text-text-primary font-mono text-sm p-4">
      {/* Tabs */}
      <div className="flex border-b border-border-wire mb-4">
        <button
          className={`flex-1 pb-2 text-center transition-colors ${activeTab === 'countdown' ? 'text-accent-amber border-b-2 border-accent-amber font-bold' : 'text-text-muted hover:text-text-primary'}`}
          onClick={() => setActiveTab('countdown')}
        >
          COUNTDOWN
        </button>
        <button
          className={`flex-1 pb-2 text-center transition-colors ${activeTab === 'stopwatch' ? 'text-accent-cyan border-b-2 border-accent-cyan font-bold' : 'text-text-muted hover:text-text-primary'}`}
          onClick={() => setActiveTab('stopwatch')}
        >
          STOPWATCH
        </button>
      </div>

      {activeTab === 'countdown' ? (
        <div className="flex flex-col flex-1 items-center justify-center space-y-6">
          <div className={`text-6xl font-bold tracking-wider ${cdFinished ? 'text-accent-rose animate-pulse' : 'text-accent-amber'}`}>
            {formatTime(cdTime)}
          </div>
          
          <div className="flex space-x-4">
            <button
              className="px-4 py-2 bg-overlay-light border border-border-wire rounded-md hover:bg-overlay-hover transition-colors text-xs"
              onClick={() => {
                setCdInput(Math.max(0, cdInput - 60));
              }}
            >
              -1M
            </button>
            <button
              className="px-4 py-2 bg-overlay-light border border-border-wire rounded-md hover:bg-overlay-hover transition-colors text-xs"
              onClick={() => {
                setCdInput(cdInput + 60);
              }}
            >
              +1M
            </button>
          </div>

          <div className="flex space-x-4 mt-auto">
            <button
              className="px-6 py-2 bg-accent-amber text-black font-bold rounded-md hover:bg-yellow-400 transition-colors w-24"
              onClick={() => {
                if (cdIsRunning) pauseCd();
                else startCd();
              }}
            >
              {cdIsRunning ? 'PAUSE' : 'START'}
            </button>
            <button
              className="px-6 py-2 bg-overlay-light border border-border-wire rounded-md hover:bg-overlay-hover transition-colors w-24 text-accent-rose"
              onClick={resetCd}
            >
              RESET
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 items-center justify-center space-y-6">
          <div className="text-6xl font-bold tracking-wider text-accent-cyan">
            {formatTime(swTime)}
          </div>
          
          <div className="flex space-x-4 mt-auto">
            <button
              className="px-6 py-2 bg-accent-cyan text-black font-bold rounded-md hover:bg-cyan-400 transition-colors w-24"
              onClick={() => {
                if (swIsRunning) pauseSw();
                else startSw();
              }}
            >
              {swIsRunning ? 'PAUSE' : 'START'}
            </button>
            <button
              className="px-6 py-2 bg-overlay-light border border-border-wire rounded-md hover:bg-overlay-hover transition-colors w-24 text-accent-rose"
              onClick={resetSw}
            >
              RESET
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
