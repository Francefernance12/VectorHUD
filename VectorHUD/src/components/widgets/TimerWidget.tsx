import { useState } from 'react';
import { useTimerStore } from '../../store/timerStore';

export function TimerWidget() {
  const activeTab = useTimerStore(state => state.activeTab);
  const setActiveTab = useTimerStore(state => state.setActiveTab);
  
  const swTime = useTimerStore(state => state.swTime);
  const swIsRunning = useTimerStore(state => state.swIsRunning);
  const startSw = useTimerStore(state => state.startSw);
  const pauseSw = useTimerStore(state => state.pauseSw);
  const resetSw = useTimerStore(state => state.resetSw);
  const setSwTime = useTimerStore(state => state.setSwTime);

  const cdInput = useTimerStore(state => state.cdInput);
  const cdTime = useTimerStore(state => state.cdTime);
  const cdIsRunning = useTimerStore(state => state.cdIsRunning);
  const cdFinished = useTimerStore(state => state.cdFinished);
  const setCdInput = useTimerStore(state => state.setCdInput);
  const startCd = useTimerStore(state => state.startCd);
  const pauseCd = useTimerStore(state => state.pauseCd);
  const resetCd = useTimerStore(state => state.resetCd);

  const [isEditingCd, setIsEditingCd] = useState(false);
  const [cdMin, setCdMin] = useState('0');
  const [cdSec, setCdSec] = useState('0');

  const [isEditingSw, setIsEditingSw] = useState(false);
  const [swMin, setSwMin] = useState('0');
  const [swSec, setSwSec] = useState('0');

  const formatTime = (timeInSeconds: number) => {
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const s = (timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleStartEditCd = () => {
    if (cdIsRunning) return;
    const m = Math.floor(cdTime / 60);
    const s = cdTime % 60;
    setCdMin(m.toString().padStart(2, '0'));
    setCdSec(s.toString().padStart(2, '0'));
    setIsEditingCd(true);
  };

  const handleCommitCd = () => {
    const mins = Math.max(0, parseInt(cdMin) || 0);
    const secs = Math.max(0, Math.min(59, parseInt(cdSec) || 0));
    const total = (mins * 60) + secs;
    setCdInput(total);
    setIsEditingCd(false);
  };

  const handleBlurCd = (e: React.FocusEvent) => {
    const parent = e.currentTarget.parentElement;
    if (e.relatedTarget && parent && parent.contains(e.relatedTarget as Node)) {
      return;
    }
    handleCommitCd();
  };

  const handleStartEditSw = () => {
    if (swIsRunning) return;
    const m = Math.floor(swTime / 60);
    const s = swTime % 60;
    setSwMin(m.toString().padStart(2, '0'));
    setSwSec(s.toString().padStart(2, '0'));
    setIsEditingSw(true);
  };

  const handleCommitSw = () => {
    const mins = Math.max(0, parseInt(swMin) || 0);
    const secs = Math.max(0, Math.min(59, parseInt(swSec) || 0));
    const total = (mins * 60) + secs;
    setSwTime(total);
    setIsEditingSw(false);
  };

  const handleBlurSw = (e: React.FocusEvent) => {
    const parent = e.currentTarget.parentElement;
    if (e.relatedTarget && parent && parent.contains(e.relatedTarget as Node)) {
      return;
    }
    handleCommitSw();
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
          {isEditingCd ? (
            <div className="flex items-center text-6xl font-bold tracking-wider text-accent-amber font-mono select-text">
              <input
                type="number"
                min="0"
                max="999"
                value={cdMin}
                onChange={(e) => setCdMin(e.target.value.slice(0, 3))}
                onBlur={handleBlurCd}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitCd();
                  if (e.key === 'Escape') setIsEditingCd(false);
                }}
                autoFocus
                className="w-[100px] bg-transparent text-center border-b border-accent-amber/30 focus:border-accent-amber focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="px-1 text-zinc-600">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={cdSec}
                onChange={(e) => setCdSec(e.target.value.slice(0, 2))}
                onBlur={handleBlurCd}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitCd();
                  if (e.key === 'Escape') setIsEditingCd(false);
                }}
                className="w-[80px] bg-transparent text-center border-b border-accent-amber/30 focus:border-accent-amber focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          ) : (
            <div 
              onClick={handleStartEditCd}
              className={`text-6xl font-bold tracking-wider select-none cursor-pointer ${cdIsRunning ? 'cursor-default' : 'hover:text-accent-amber/80 border-b border-transparent hover:border-accent-amber/30'} ${cdFinished ? 'text-red-500 animate-pulse' : 'text-accent-amber'}`}
              title={!cdIsRunning ? "Click to set custom time" : undefined}
            >
              {formatTime(cdTime)}
            </div>
          )}
          
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
          {isEditingSw ? (
            <div className="flex items-center text-6xl font-bold tracking-wider text-accent-green font-mono select-text">
              <input
                type="number"
                min="0"
                max="999"
                value={swMin}
                onChange={(e) => setSwMin(e.target.value.slice(0, 3))}
                onBlur={handleBlurSw}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitSw();
                  if (e.key === 'Escape') setIsEditingSw(false);
                }}
                autoFocus
                className="w-[100px] bg-transparent text-center border-b border-accent-green/30 focus:border-accent-green focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="px-1 text-zinc-600">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={swSec}
                onChange={(e) => setSwSec(e.target.value.slice(0, 2))}
                onBlur={handleBlurSw}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitSw();
                  if (e.key === 'Escape') setIsEditingSw(false);
                }}
                className="w-[80px] bg-transparent text-center border-b border-accent-green/30 focus:border-accent-green focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          ) : (
            <div 
              onClick={handleStartEditSw}
              className={`text-6xl font-bold tracking-wider select-none cursor-pointer ${swIsRunning ? 'cursor-default' : 'hover:text-accent-green/80 border-b border-transparent hover:border-accent-green/30'} text-accent-green`}
              title={!swIsRunning ? "Click to set custom time" : undefined}
            >
              {formatTime(swTime)}
            </div>
          )}
          
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
