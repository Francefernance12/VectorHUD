import { create } from 'zustand';
import { getSettingsStore } from '../utils/store';

interface SettingsState {
  isSettingsOpen: boolean;
  openRouterModel: string;
  openaiModel: string;
  anthropicModel: string;
  groqModel: string;
  customOpenRouterModel: string;
  useCustomOpenRouterModel: boolean;
  aiProvider: string;
  globalFontSize: number;
  theme: string;
  customColor: string;
  recordMicrophone: boolean;
  recordSystemAudio: boolean;
  replayResolution: string;
  replayFps: number;
  overlayHotkey: string;
  screenshotHotkey: string;
  recordHotkey: string;
  replayHotkey: string;
  timerHotkey: string;
  stopwatchHotkey: string;
  timerResetHotkey: string;
  voicePttHotkey: string;
  interactHotkey: string;

  // New settings fields
  metricsPollInterval: number;
  gpuTempAlertThreshold: number;
  cpuTempAlertThreshold: number;
  replayDuration: number;
  excludeHudFromCapture: boolean;
  favoriteMixerApps: string;
  volumeStep: number;
  pttBrevityLimit: number;
  systemPromptOverride: string;
  backgroundBlur: number;
  backdropOpacity: number;
  launchOnStartup: boolean;

  // Visual customizations
  widgetBorderRadius: number;
  widgetBorderWidth: number;
  widgetBorderOpacity: number;
  widgetGlowSize: number;
  widgetGlowOpacity: number;

  // Audio settings
  selectedAudioInput: string;
  selectedAudioOutput: string;
  microphoneVolume: number;
  microphoneMuted: boolean;

  syncBorderGlowWithTheme: boolean;
  syncBorderWithTheme: boolean;
  syncGlowWithTheme: boolean;
  customBorderColor: string;
  customGlowColor: string;
  
  toggleSettings: () => void;
  setOpenRouterModel: (model: string) => Promise<void>;
  setOpenaiModel: (model: string) => Promise<void>;
  setAnthropicModel: (model: string) => Promise<void>;
  setGroqModel: (model: string) => Promise<void>;
  setCustomOpenRouterModel: (model: string) => Promise<void>;
  setUseCustomOpenRouterModel: (use: boolean) => Promise<void>;
  setAiProvider: (provider: string) => Promise<void>;
  setGlobalFontSize: (size: number) => Promise<void>;
  setTheme: (theme: string) => Promise<void>;
  setCustomColor: (color: string) => Promise<void>;
  setRecordMicrophone: (enabled: boolean) => Promise<void>;
  setRecordSystemAudio: (enabled: boolean) => Promise<void>;
  setReplayResolution: (res: string) => Promise<void>;
  setReplayFps: (fps: number) => Promise<void>;
  setOverlayHotkey: (hotkey: string) => Promise<void>;
  setScreenshotHotkey: (hotkey: string) => Promise<void>;
  setRecordHotkey: (hotkey: string) => Promise<void>;
  setReplayHotkey: (hotkey: string) => Promise<void>;
  setTimerHotkey: (hotkey: string) => Promise<void>;
  setStopwatchHotkey: (hotkey: string) => Promise<void>;
  setTimerResetHotkey: (hotkey: string) => Promise<void>;
  setVoicePttHotkey: (hotkey: string) => Promise<void>;
  setInteractHotkey: (hotkey: string) => Promise<void>;

  // New settings setters
  setMetricsPollInterval: (val: number) => Promise<void>;
  setGpuTempAlertThreshold: (val: number) => Promise<void>;
  setCpuTempAlertThreshold: (val: number) => Promise<void>;
  setReplayDuration: (val: number) => Promise<void>;
  setExcludeHudFromCapture: (val: boolean) => Promise<void>;
  setFavoriteMixerApps: (val: string) => Promise<void>;
  setVolumeStep: (val: number) => Promise<void>;
  setPttBrevityLimit: (val: number) => Promise<void>;
  setSystemPromptOverride: (val: string) => Promise<void>;
  setBackgroundBlur: (val: number) => Promise<void>;
  setBackdropOpacity: (val: number) => Promise<void>;
  setLaunchOnStartup: (val: boolean) => Promise<void>;

  setWidgetBorderRadius: (val: number) => Promise<void>;
  setWidgetBorderWidth: (val: number) => Promise<void>;
  setWidgetBorderOpacity: (val: number) => Promise<void>;
  setWidgetGlowSize: (val: number) => Promise<void>;
  setWidgetGlowOpacity: (val: number) => Promise<void>;
  setSelectedAudioInput: (val: string) => Promise<void>;
  setSelectedAudioOutput: (val: string) => Promise<void>;
  setMicrophoneVolume: (val: number) => Promise<void>;
  setMicrophoneMuted: (val: boolean) => Promise<void>;

  setSyncBorderGlowWithTheme: (val: boolean) => Promise<void>;
  setSyncBorderWithTheme: (val: boolean) => Promise<void>;
  setSyncGlowWithTheme: (val: boolean) => Promise<void>;
  setCustomBorderColor: (val: string) => Promise<void>;
  setCustomGlowColor: (val: string) => Promise<void>;
  
  loadPreferences: () => Promise<void>;
  syncHotkeys: () => Promise<void>;
}

const applyThemeColors = (theme: string, customColor: string) => {
  const root = document.documentElement;
  const hexToRgb = (hex: string) => {
    let c = hex.substring(1);      // strip #
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    return `${parseInt(c.slice(0, 2), 16)}, ${parseInt(c.slice(2, 4), 16)}, ${parseInt(c.slice(4, 6), 16)}`;
  };

  const setColors = (hex: string) => {
    root.style.setProperty('--accent-amber', hex);
    root.style.setProperty('--accent-green', hex);
    root.style.setProperty('--accent-amber-rgb', hexToRgb(hex));
    root.style.setProperty('--accent-green-rgb', hexToRgb(hex));
  };

  if (theme === 'custom' && customColor) {
    setColors(customColor);
  } else if (theme === 'amber') {
    setColors('#FFB000');
  } else if (theme === 'neon_blue') {
    setColors('#00F0FF');
  } else if (theme === 'matrix_green') {
    setColors('#00FF41');
  } else if (theme === 'outrun_pink') {
    setColors('#FF00FF');
  } else {
    // Default
    root.style.setProperty('--accent-amber', '#FFB000');
    root.style.setProperty('--accent-amber-rgb', '255, 176, 0');
    root.style.setProperty('--accent-green', '#4AF626');
    root.style.setProperty('--accent-green-rgb', '74, 246, 38');
  }

  // Border & Glow customizations
  const state = useSettingsStore.getState();
  const syncBorder = state.syncBorderWithTheme !== undefined ? state.syncBorderWithTheme : (state.syncBorderGlowWithTheme !== undefined ? state.syncBorderGlowWithTheme : true);
  const syncGlow = state.syncGlowWithTheme !== undefined ? state.syncGlowWithTheme : (state.syncBorderGlowWithTheme !== undefined ? state.syncBorderGlowWithTheme : true);
  const customBorder = state.customBorderColor || '#ffffff';
  const customGlow = state.customGlowColor || '#4af626';

  if (syncBorder) {
    root.style.removeProperty('--widget-border-color');
  } else {
    root.style.setProperty('--widget-border-color', customBorder);
  }

  if (syncGlow) {
    root.style.removeProperty('--widget-glow-color-rgb');
  } else {
    root.style.setProperty('--widget-glow-color-rgb', hexToRgb(customGlow));
  }
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  isSettingsOpen: false,
  openRouterModel: 'google/gemini-2.5-flash',
  openaiModel: 'gpt-4o-mini',
  anthropicModel: 'claude-3-5-sonnet-20241022',
  groqModel: 'llama-3.3-70b-versatile',
  customOpenRouterModel: '',
  useCustomOpenRouterModel: false,
  aiProvider: 'openrouter',
  globalFontSize: 14,
  theme: 'default',
  customColor: '#FF0000',
  recordMicrophone: false,
  recordSystemAudio: true,
  replayResolution: '720p',
  replayFps: 30,
  overlayHotkey: 'ctrl+alt+o',
  screenshotHotkey: 'ctrl+alt+s',
  recordHotkey: 'ctrl+alt+r',
  replayHotkey: 'ctrl+alt+b',
  timerHotkey: 'ctrl+alt+t',
  stopwatchHotkey: 'ctrl+alt+w',
  timerResetHotkey: 'ctrl+alt+y',
  voicePttHotkey: 'ctrl+alt+v',
  interactHotkey: 'ctrl+alt+i',

  metricsPollInterval: 1000,
  gpuTempAlertThreshold: 80,
  cpuTempAlertThreshold: 80,
  replayDuration: 30,
  excludeHudFromCapture: true,
  favoriteMixerApps: 'chrome.exe, discord.exe, spotify.exe',
  volumeStep: 5,
  pttBrevityLimit: 320,
  systemPromptOverride: '',
  backgroundBlur: 8,
  backdropOpacity: 60,
  launchOnStartup: false,

  widgetBorderRadius: 12,
  widgetBorderWidth: 1,
  widgetBorderOpacity: 15,
  widgetGlowSize: 15,
  widgetGlowOpacity: 15,
  selectedAudioInput: 'Default',
  selectedAudioOutput: 'Default',
  microphoneVolume: 100,
  microphoneMuted: false,

  syncBorderGlowWithTheme: true,
  syncBorderWithTheme: true,
  syncGlowWithTheme: true,
  customBorderColor: '#ffffff',
  customGlowColor: '#4af626',

  toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

  setOpenRouterModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('openRouterModel', model);
    await store.save();
    set({ openRouterModel: model });
  },

  setOpenaiModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('openaiModel', model);
    await store.save();
    set({ openaiModel: model });
  },

  setAnthropicModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('anthropicModel', model);
    await store.save();
    set({ anthropicModel: model });
  },

  setGroqModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('groqModel', model);
    await store.save();
    set({ groqModel: model });
  },

  setCustomOpenRouterModel: async (model) => {
    const store = await getSettingsStore();
    await store.set('customOpenRouterModel', model);
    await store.save();
    set({ customOpenRouterModel: model });
  },

  setUseCustomOpenRouterModel: async (use) => {
    const store = await getSettingsStore();
    await store.set('useCustomOpenRouterModel', use);
    await store.save();
    set({ useCustomOpenRouterModel: use });
  },

  setAiProvider: async (provider) => {
    const store = await getSettingsStore();
    await store.set('aiProvider', provider);
    await store.save();
    set({ aiProvider: provider });
  },

  setGlobalFontSize: async (size) => {
    const store = await getSettingsStore();
    await store.set('globalFontSize', size);
    await store.save();
    set({ globalFontSize: size });
    // Apply font size globally via CSS variable
    document.documentElement.style.setProperty('--base-font-size', `${size}px`);
  },

  setTheme: async (theme) => {
    const store = await getSettingsStore();
    await store.set('theme', theme);
    await store.save();
    set({ theme });
    applyThemeColors(theme, useSettingsStore.getState().customColor);
  },

  setCustomColor: async (customColor) => {
    const store = await getSettingsStore();
    await store.set('customColor', customColor);
    await store.save();
    set({ customColor });
    applyThemeColors(useSettingsStore.getState().theme, customColor);
  },

  setRecordMicrophone: async (enabled) => {
    const store = await getSettingsStore();
    await store.set('recordMicrophone', enabled);
    await store.save();
    set({ recordMicrophone: enabled });
  },

  setRecordSystemAudio: async (enabled) => {
    const store = await getSettingsStore();
    await store.set('recordSystemAudio', enabled);
    await store.save();
    set({ recordSystemAudio: enabled });
  },

  setReplayResolution: async (res) => {
    const store = await getSettingsStore();
    await store.set('replayResolution', res);
    await store.save();
    set({ replayResolution: res });
  },

  setReplayFps: async (fps) => {
    const store = await getSettingsStore();
    await store.set('replayFps', fps);
    await store.save();
    set({ replayFps: fps });
  },

  setOverlayHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('overlayHotkey', hotkey);
    await store.save();
    set({ overlayHotkey: hotkey });
  },

  setScreenshotHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('screenshotHotkey', hotkey);
    await store.save();
    set({ screenshotHotkey: hotkey });
  },

  setRecordHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('recordHotkey', hotkey);
    await store.save();
    set({ recordHotkey: hotkey });
  },

  setReplayHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('replayHotkey', hotkey);
    await store.save();
    set({ replayHotkey: hotkey });
  },

  setTimerHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('timerHotkey', hotkey);
    await store.save();
    set({ timerHotkey: hotkey });
  },

  setStopwatchHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('stopwatchHotkey', hotkey);
    await store.save();
    set({ stopwatchHotkey: hotkey });
  },

  setTimerResetHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('timerResetHotkey', hotkey);
    await store.save();
    set({ timerResetHotkey: hotkey });
  },

  setVoicePttHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('voicePttHotkey', hotkey);
    await store.save();
    set({ voicePttHotkey: hotkey });
  },

  setInteractHotkey: async (hotkey) => {
    const store = await getSettingsStore();
    await store.set('interactHotkey', hotkey);
    await store.save();
    set({ interactHotkey: hotkey });
  },

  setMetricsPollInterval: async (val) => {
    const store = await getSettingsStore();
    await store.set('metricsPollInterval', val);
    await store.save();
    set({ metricsPollInterval: val });
  },

  setGpuTempAlertThreshold: async (val) => {
    const store = await getSettingsStore();
    await store.set('gpuTempAlertThreshold', val);
    await store.save();
    set({ gpuTempAlertThreshold: val });
  },

  setCpuTempAlertThreshold: async (val) => {
    const store = await getSettingsStore();
    await store.set('cpuTempAlertThreshold', val);
    await store.save();
    set({ cpuTempAlertThreshold: val });
  },

  setReplayDuration: async (val) => {
    const store = await getSettingsStore();
    await store.set('replayDuration', val);
    await store.save();
    set({ replayDuration: val });
  },

  setExcludeHudFromCapture: async (val) => {
    const store = await getSettingsStore();
    await store.set('excludeHudFromCapture', val);
    await store.save();
    set({ excludeHudFromCapture: val });
  },

  setFavoriteMixerApps: async (val) => {
    const store = await getSettingsStore();
    await store.set('favoriteMixerApps', val);
    await store.save();
    set({ favoriteMixerApps: val });
  },

  setVolumeStep: async (val) => {
    const store = await getSettingsStore();
    await store.set('volumeStep', val);
    await store.save();
    set({ volumeStep: val });
  },

  setPttBrevityLimit: async (val) => {
    const store = await getSettingsStore();
    await store.set('pttBrevityLimit', val);
    await store.save();
    set({ pttBrevityLimit: val });
  },

  setSystemPromptOverride: async (val) => {
    const store = await getSettingsStore();
    await store.set('systemPromptOverride', val);
    await store.save();
    set({ systemPromptOverride: val });
  },

  setBackgroundBlur: async (val) => {
    const store = await getSettingsStore();
    await store.set('backgroundBlur', val);
    await store.save();
    set({ backgroundBlur: val });
    document.documentElement.style.setProperty('--bg-blur-amount', `${val}px`);
  },

  setBackdropOpacity: async (val) => {
    const store = await getSettingsStore();
    await store.set('backdropOpacity', val);
    await store.save();
    set({ backdropOpacity: val });
    document.documentElement.style.setProperty('--bg-opacity-amount', `${val / 100}`);
  },

  setLaunchOnStartup: async (val) => {
    const store = await getSettingsStore();
    await store.set('launchOnStartup', val);
    await store.save();
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart');
      if (val) {
        await enable();
      } else {
        await disable();
      }
    } catch (e) {
      console.error('Failed to update autostart status:', e);
    }
    set({ launchOnStartup: val });
  },

  setWidgetBorderRadius: async (val) => {
    const store = await getSettingsStore();
    await store.set('widgetBorderRadius', val);
    await store.save();
    set({ widgetBorderRadius: val });
    document.documentElement.style.setProperty('--widget-border-radius', `${val}px`);
  },

  setWidgetBorderWidth: async (val) => {
    const store = await getSettingsStore();
    await store.set('widgetBorderWidth', val);
    await store.save();
    set({ widgetBorderWidth: val });
    document.documentElement.style.setProperty('--widget-border-width', `${val}px`);
  },

  setWidgetBorderOpacity: async (val) => {
    const store = await getSettingsStore();
    await store.set('widgetBorderOpacity', val);
    await store.save();
    set({ widgetBorderOpacity: val });
    document.documentElement.style.setProperty('--widget-border-opacity', `${val / 100}`);
  },

  setWidgetGlowSize: async (val) => {
    const store = await getSettingsStore();
    await store.set('widgetGlowSize', val);
    await store.save();
    set({ widgetGlowSize: val });
    document.documentElement.style.setProperty('--widget-glow-size', `${val}px`);
  },

  setWidgetGlowOpacity: async (val) => {
    const store = await getSettingsStore();
    await store.set('widgetGlowOpacity', val);
    await store.save();
    set({ widgetGlowOpacity: val });
    document.documentElement.style.setProperty('--widget-glow-opacity', `${val / 100}`);
  },

  setSelectedAudioInput: async (val) => {
    const store = await getSettingsStore();
    await store.set('selectedAudioInput', val);
    await store.save();
    set({ selectedAudioInput: val });
  },

  setSelectedAudioOutput: async (val) => {
    const store = await getSettingsStore();
    await store.set('selectedAudioOutput', val);
    await store.save();
    set({ selectedAudioOutput: val });
  },

  setMicrophoneVolume: async (val) => {
    const store = await getSettingsStore();
    await store.set('microphoneVolume', val);
    await store.save();
    set({ microphoneVolume: val });
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_microphone_volume', { volume: val / 100 });
  },

  setMicrophoneMuted: async (val) => {
    const store = await getSettingsStore();
    await store.set('microphoneMuted', val);
    await store.save();
    set({ microphoneMuted: val });
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_microphone_mute', { muted: val });
  },

  setSyncBorderGlowWithTheme: async (val) => {
    const store = await getSettingsStore();
    await store.set('syncBorderGlowWithTheme', val);
    await store.set('syncBorderWithTheme', val);
    await store.set('syncGlowWithTheme', val);
    await store.save();
    set({ syncBorderGlowWithTheme: val, syncBorderWithTheme: val, syncGlowWithTheme: val });
    applyThemeColors(useSettingsStore.getState().theme, useSettingsStore.getState().customColor);
  },

  setSyncBorderWithTheme: async (val) => {
    const store = await getSettingsStore();
    await store.set('syncBorderWithTheme', val);
    await store.save();
    set({ syncBorderWithTheme: val });
    applyThemeColors(useSettingsStore.getState().theme, useSettingsStore.getState().customColor);
  },

  setSyncGlowWithTheme: async (val) => {
    const store = await getSettingsStore();
    await store.set('syncGlowWithTheme', val);
    await store.save();
    set({ syncGlowWithTheme: val });
    applyThemeColors(useSettingsStore.getState().theme, useSettingsStore.getState().customColor);
  },

  setCustomBorderColor: async (val) => {
    const store = await getSettingsStore();
    await store.set('customBorderColor', val);
    await store.save();
    set({ customBorderColor: val });
    applyThemeColors(useSettingsStore.getState().theme, useSettingsStore.getState().customColor);
  },

  setCustomGlowColor: async (val) => {
    const store = await getSettingsStore();
    await store.set('customGlowColor', val);
    await store.save();
    set({ customGlowColor: val });
    applyThemeColors(useSettingsStore.getState().theme, useSettingsStore.getState().customColor);
  },

  loadPreferences: async () => {
    const store = await getSettingsStore();
    const model = await store.get<string>('openRouterModel');
    const oaiModel = await store.get<string>('openaiModel');
    const antModel = await store.get<string>('anthropicModel');
    const grqModel = await store.get<string>('groqModel');
    const customOrModel = await store.get<string>('customOpenRouterModel');
    const useCustomOr = await store.get<boolean>('useCustomOpenRouterModel');
    const provider = await store.get<string>('aiProvider');
    const fontSize = await store.get<number>('globalFontSize');
    const theme = await store.get<string>('theme');
    const customColor = await store.get<string>('customColor');
    const mic = await store.get<boolean>('recordMicrophone');
    const systemAudio = await store.get<boolean>('recordSystemAudio');
    const rRes = await store.get<string>('replayResolution');
    const rFps = await store.get<number>('replayFps');
    const oHot = await store.get<string>('overlayHotkey');
    const sHot = await store.get<string>('screenshotHotkey');
    const rHot = await store.get<string>('recordHotkey');
    const rpHot = await store.get<string>('replayHotkey');
    const tHot = await store.get<string>('timerHotkey');
    const swHot = await store.get<string>('stopwatchHotkey');
    const trHot = await store.get<string>('timerResetHotkey');
    const vpHot = await store.get<string>('voicePttHotkey');
    const iHot = await store.get<string>('interactHotkey');

    // New preferences hydration
    const mInterval = await store.get<number>('metricsPollInterval');
    const gTemp = await store.get<number>('gpuTempAlertThreshold');
    const cTemp = await store.get<number>('cpuTempAlertThreshold');
    const rDur = await store.get<number>('replayDuration');
    const exHud = await store.get<boolean>('excludeHudFromCapture');
    const favApps = await store.get<string>('favoriteMixerApps');
    const volStep = await store.get<number>('volumeStep');
    const brevity = await store.get<number>('pttBrevityLimit');
    const sysPrompt = await store.get<string>('systemPromptOverride');
    const bgBlur = await store.get<number>('backgroundBlur');
    const bdOpacity = await store.get<number>('backdropOpacity');
    const startStartup = await store.get<boolean>('launchOnStartup');

    const wRadius = await store.get<number>('widgetBorderRadius');
    const wWidth = await store.get<number>('widgetBorderWidth');
    const wBorderOpacity = await store.get<number>('widgetBorderOpacity');
    const wGlowSize = await store.get<number>('widgetGlowSize');
    const wGlowOpacity = await store.get<number>('widgetGlowOpacity');
    const audioInput = await store.get<string>('selectedAudioInput');
    const audioOutput = await store.get<string>('selectedAudioOutput');
    const micVol = await store.get<number>('microphoneVolume');
    const micMuted = await store.get<boolean>('microphoneMuted');

    const syncBorderGlow = await store.get<boolean>('syncBorderGlowWithTheme');
    const syncBorder = await store.get<boolean>('syncBorderWithTheme');
    const syncGlow = await store.get<boolean>('syncGlowWithTheme');
    const customBorder = await store.get<string>('customBorderColor');
    const customGlow = await store.get<string>('customGlowColor');

    const finalTheme = theme || 'default';
    const finalColor = customColor || '#FF0000';

    let finalLaunchOnStartup = startStartup !== undefined ? startStartup : false;
    try {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart');
      finalLaunchOnStartup = await isEnabled();
    } catch (e) {
      console.warn('Failed to check autostart status at load:', e);
    }

    set({
      openRouterModel: model || 'google/gemini-2.5-flash',
      openaiModel: oaiModel || 'gpt-4o-mini',
      anthropicModel: antModel || 'claude-3-5-sonnet-20241022',
      groqModel: grqModel || 'llama-3.3-70b-versatile',
      customOpenRouterModel: customOrModel || '',
      useCustomOpenRouterModel: useCustomOr !== undefined ? useCustomOr : false,
      aiProvider: provider || 'openrouter',
      globalFontSize: fontSize || 14,
      theme: finalTheme,
      customColor: finalColor,
      recordMicrophone: mic !== undefined ? mic : false,
      recordSystemAudio: systemAudio !== undefined ? systemAudio : true,
      replayResolution: rRes || '720p',
      replayFps: rFps || 30,
      overlayHotkey: oHot || 'ctrl+alt+o',
      screenshotHotkey: sHot || 'ctrl+alt+s',
      recordHotkey: rHot || 'ctrl+alt+r',
      replayHotkey: rpHot || 'ctrl+alt+b',
      timerHotkey: tHot || 'ctrl+alt+t',
      stopwatchHotkey: swHot || 'ctrl+alt+w',
      timerResetHotkey: trHot || 'ctrl+alt+y',
      voicePttHotkey: vpHot || 'ctrl+alt+v',
      interactHotkey: iHot || 'ctrl+alt+i',

      metricsPollInterval: mInterval !== undefined ? mInterval : 1000,
      gpuTempAlertThreshold: gTemp !== undefined ? gTemp : 80,
      cpuTempAlertThreshold: cTemp !== undefined ? cTemp : 80,
      replayDuration: rDur !== undefined ? rDur : 30,
      excludeHudFromCapture: exHud !== undefined ? exHud : true,
      favoriteMixerApps: favApps !== undefined ? favApps : 'chrome.exe, discord.exe, spotify.exe',
      volumeStep: volStep !== undefined ? volStep : 5,
      pttBrevityLimit: brevity !== undefined ? brevity : 320,
      systemPromptOverride: sysPrompt !== undefined ? sysPrompt : '',
      backgroundBlur: bgBlur !== undefined ? bgBlur : 8,
      backdropOpacity: bdOpacity !== undefined ? bdOpacity : 60,
      launchOnStartup: finalLaunchOnStartup,

      widgetBorderRadius: wRadius !== undefined ? wRadius : 12,
      widgetBorderWidth: wWidth !== undefined ? wWidth : 1,
      widgetBorderOpacity: wBorderOpacity !== undefined ? wBorderOpacity : 15,
      widgetGlowSize: wGlowSize !== undefined ? wGlowSize : 15,
      widgetGlowOpacity: wGlowOpacity !== undefined ? wGlowOpacity : 15,
      selectedAudioInput: audioInput || 'Default',
      selectedAudioOutput: audioOutput || 'Default',
      microphoneVolume: micVol !== undefined ? micVol : 100,
      microphoneMuted: micMuted !== undefined ? micMuted : false,

      syncBorderGlowWithTheme: syncBorderGlow !== undefined ? syncBorderGlow : true,
      syncBorderWithTheme: syncBorder !== undefined ? syncBorder : (syncBorderGlow !== undefined ? syncBorderGlow : true),
      syncGlowWithTheme: syncGlow !== undefined ? syncGlow : (syncBorderGlow !== undefined ? syncBorderGlow : true),
      customBorderColor: customBorder || '#ffffff',
      customGlowColor: customGlow || '#4af626',
    });

    applyThemeColors(finalTheme, finalColor);

    try {
      await get().syncHotkeys();
    } catch (err) {
      console.error("Failed to sync hotkeys to Rust backend:", err);
    }

    if (fontSize) {
      document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    }

    const finalBlur = bgBlur !== undefined ? bgBlur : 8;
    const finalOpacity = bdOpacity !== undefined ? bdOpacity : 60;
    document.documentElement.style.setProperty('--bg-blur-amount', `${finalBlur}px`);
    document.documentElement.style.setProperty('--bg-opacity-amount', `${finalOpacity / 100}`);

    const finalRadius = wRadius !== undefined ? wRadius : 12;
    const finalWidth = wWidth !== undefined ? wWidth : 1;
    const finalBorderOpacity = wBorderOpacity !== undefined ? wBorderOpacity : 15;
    const finalGlowSize = wGlowSize !== undefined ? wGlowSize : 15;
    const finalGlowOpacity = wGlowOpacity !== undefined ? wGlowOpacity : 15;

    document.documentElement.style.setProperty('--widget-border-radius', `${finalRadius}px`);
    document.documentElement.style.setProperty('--widget-border-width', `${finalWidth}px`);
    document.documentElement.style.setProperty('--widget-border-opacity', `${finalBorderOpacity / 100}`);
    document.documentElement.style.setProperty('--widget-glow-size', `${finalGlowSize}px`);
    document.documentElement.style.setProperty('--widget-glow-opacity', `${finalGlowOpacity / 100}`);

    // Try to sync with hardware states for mic on boot
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const mVol = await invoke<number>('get_microphone_volume');
      const mMuted = await invoke<boolean>('get_microphone_mute');
      set({ microphoneVolume: Math.round(mVol * 100), microphoneMuted: mMuted });
    } catch (e) {
      console.warn("Failed to load microphone hardware states:", e);
    }
  },

  syncHotkeys: async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    const state = get();
    await invoke('update_hotkeys', {
      overlayHotkey: state.overlayHotkey,
      screenshotHotkey: state.screenshotHotkey,
      recordHotkey: state.recordHotkey,
      replayHotkey: state.replayHotkey,
      timerHotkey: state.timerHotkey,
      stopwatchHotkey: state.stopwatchHotkey,
      timerResetHotkey: state.timerResetHotkey,
      voicePttHotkey: state.voicePttHotkey,
      interactHotkey: state.interactHotkey
    });
  }
}));
