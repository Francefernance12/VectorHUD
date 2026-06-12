import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface MediaMetadata {
  title: string;
  artist: string;
  album_artist: string;
  is_playing: boolean;
}

interface AudioStoreState {
  favoriteApps: string[];
  toggleFavoriteApp: (appName: string) => void;
  currentMedia: MediaMetadata | null;
  setCurrentMedia: (media: MediaMetadata | null) => void;
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
      },
      currentMedia: null,
      setCurrentMedia: (media) => set({ currentMedia: media }),
    }),
    {
      name: 'vectorhud-audio-favorites',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ favoriteApps: state.favoriteApps }),
    }
  )
);
