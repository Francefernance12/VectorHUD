import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AudioStoreState {
  favoriteApps: string[];
  toggleFavoriteApp: (appName: string) => void;
}

export const useAudioStore = create<AudioStoreState>()(
  persist(
    (set, get) => ({
      favoriteApps: [],
      toggleFavoriteApp: (appName) => {
        const current = get().favoriteApps;
        if (current.includes(appName)) {
          set({ favoriteApps: current.filter(app => app !== appName) });
        } else {
          set({ favoriteApps: [...current, appName] });
        }
      }
    }),
    {
      name: 'vectorhud-audio-favorites',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
