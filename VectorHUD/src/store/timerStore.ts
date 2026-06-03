import { create } from 'zustand';
import { useToastStore } from './toastStore';

interface TimerState {
  // Stopwatch
  swTime: number;
  swIsRunning: boolean;
  startSw: () => void;
  pauseSw: () => void;
  resetSw: () => void;
  
  // Countdown
  cdInput: number;
  cdTime: number;
  cdIsRunning: boolean;
  cdFinished: boolean;
  setCdInput: (input: number) => void;
  startCd: () => void;
  pauseCd: () => void;
  resetCd: () => void;
}

// Internal reference for intervals
let swInterval: number | null = null;
let cdInterval: number | null = null;

export const useTimerStore = create<TimerState>((set, get) => ({
  swTime: 0,
  swIsRunning: false,
  startSw: () => {
    if (get().swIsRunning) return;
    set({ swIsRunning: true });
    swInterval = window.setInterval(() => {
      set(state => ({ swTime: state.swTime + 1 }));
    }, 1000);
  },
  pauseSw: () => {
    if (swInterval) window.clearInterval(swInterval);
    swInterval = null;
    set({ swIsRunning: false });
  },
  resetSw: () => {
    if (swInterval) window.clearInterval(swInterval);
    swInterval = null;
    set({ swTime: 0, swIsRunning: false });
  },

  cdInput: 60,
  cdTime: 60,
  cdIsRunning: false,
  cdFinished: false,
  setCdInput: (input: number) => {
    set({ cdInput: input, cdTime: input, cdFinished: false });
  },
  startCd: () => {
    if (get().cdIsRunning || get().cdTime <= 0) return;
    set({ cdIsRunning: true, cdFinished: false });
    cdInterval = window.setInterval(() => {
      set(state => {
        if (state.cdTime <= 1) {
          if (cdInterval) window.clearInterval(cdInterval);
          cdInterval = null;
          
          useToastStore.getState().showToast('⏱️ Timer Finished!');
          
          // Optionally emit a sound or notification from the backend
          // invoke('play_notification_sound').catch(console.error);

          return { cdTime: 0, cdIsRunning: false, cdFinished: true };
        }
        return { cdTime: state.cdTime - 1 };
      });
    }, 1000);
  },
  pauseCd: () => {
    if (cdInterval) window.clearInterval(cdInterval);
    cdInterval = null;
    set({ cdIsRunning: false });
  },
  resetCd: () => {
    if (cdInterval) window.clearInterval(cdInterval);
    cdInterval = null;
    set({ cdTime: get().cdInput, cdIsRunning: false, cdFinished: false });
  }
}));
