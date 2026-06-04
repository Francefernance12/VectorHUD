import { useTimerStore } from '../../store/timerStore';

export function TimerWidget() {
  const activeTab = useTimerStore(state => state.activeTab);
  const setActiveTab = useTimerStore(state => state.setActiveTab);
  
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
          className={`flex-1 pb-2 text-center transition-colors ${activeTab === 'countdown' ? 'text-accent-amber border-b-2 border-accent-amber font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
          onClick={() => setActiveTab('countdown')}
        >
          COUNTDOWN
        </button>
        <button
          className={`flex-1 pb-2 text-center transition-colors ${activeTab === 'stopwatch' ? 'text-accent-green border-b-2 border-accent-green font-bold' : 'text-zinc-500 hover:text-zinc-300'}`}
          onClick={() => setActiveTab('stopwatch')}
        >
          STOPWATCH
        </button>
      </div>

      {activeTab === 'countdown' ? (
        <div className="flex flex-col flex-1 items-center justify-center space-y-6">
          <div className={`text-6xl font-bold tracking-wider ${cdFinished ? 'text-red-500 animate-pulse' : 'text-accent-amber'}`}>
            {formatTime(cdTime)}
          </div>
          
          <div className="flex space-x-4">
            <button
              className="px-4 py-2 bg-black/40 border border-border-wire rounded-md hover:bg-white/5 transition-colors text-xs text-zinc-300"
              onClick={() => {
                setCdInput(Math.max(0, cdInput - 60));
              }}
            >
              -1M
            </button>
            <button
              className="px-4 py-2 bg-black/40 border border-border-wire rounded-md hover:bg-white/5 transition-colors text-xs text-zinc-300"
              onClick={() => {
                setCdInput(cdInput + 60);
              }}
            >
              +1M
            </button>
          </div>

          <div className="flex space-x-4 mt-auto">
            <button
              className="px-6 py-2 bg-accent-amber text-black font-bold rounded-md hover:brightness-110 transition-all w-24 shadow-[0_0_15px_rgba(255,176,0,0.3)]"
              onClick={() => {
                if (cdIsRunning) pauseCd();
                else startCd();
              }}
            >
              {cdIsRunning ? 'PAUSE' : 'START'}
            </button>
            <button
              className="px-6 py-2 bg-black/40 border border-border-wire rounded-md hover:bg-red-500/20 transition-colors w-24 text-red-400"
              onClick={resetCd}
            >
              RESET
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 items-center justify-center space-y-6">
          <div className="text-6xl font-bold tracking-wider text-accent-green">
            {formatTime(swTime)}
          </div>
          
          <div className="flex space-x-4 mt-auto">
            <button
              className="px-6 py-2 bg-accent-green text-black font-bold rounded-md hover:brightness-110 transition-all w-24 shadow-[0_0_15px_rgba(74,246,38,0.3)]"
              onClick={() => {
                if (swIsRunning) pauseSw();
                else startSw();
              }}
            >
              {swIsRunning ? 'PAUSE' : 'START'}
            </button>
            <button
              className="px-6 py-2 bg-black/40 border border-border-wire rounded-md hover:bg-red-500/20 transition-colors w-24 text-red-400"
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
