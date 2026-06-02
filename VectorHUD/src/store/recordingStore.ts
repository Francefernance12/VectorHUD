import { create } from 'zustand';

interface RecordingState {
  isRecording: boolean;
  isReplayActive: boolean;
  elapsedSeconds: number;
  setRecording: (isRecording: boolean) => void;
  setReplayActive: (isActive: boolean) => void;
  setElapsedSeconds: (seconds: number) => void;
  incrementElapsed: () => void;
  resetElapsed: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  isReplayActive: false,
  elapsedSeconds: 0,
  setRecording: (isRecording) => set((state) => ({ isRecording, elapsedSeconds: isRecording ? state.elapsedSeconds : 0 })),
  setReplayActive: (isActive) => set({ isReplayActive: isActive }),
  setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),
  incrementElapsed: () => set((state) => ({ elapsedSeconds: state.elapsedSeconds + 1 })),
  resetElapsed: () => set({ elapsedSeconds: 0 }),
}));
