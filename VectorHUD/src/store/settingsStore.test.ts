// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settingsStore';

// Mock getSettingsStore
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockSave = vi.fn();

vi.mock('../utils/store', () => ({
  getSettingsStore: () => Promise.resolve({
    set: mockSet,
    get: mockGet,
    save: mockSave
  })
}));

// Mock tauri autostart plugin
vi.mock('@tauri-apps/plugin-autostart', () => ({
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
  isEnabled: vi.fn().mockResolvedValue(false)
}));

// Mock tauri Core API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('mocked')
}));

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default states', () => {
    const state = useSettingsStore.getState();
    expect(state.metricsPollInterval).toBe(1000);
    expect(state.gpuTempAlertThreshold).toBe(80);
    expect(state.cpuTempAlertThreshold).toBe(80);
    expect(state.replayDuration).toBe(30);
    expect(state.excludeHudFromCapture).toBe(true);
    expect(state.favoriteMixerApps).toBe('chrome.exe, discord.exe, spotify.exe');
    expect(state.volumeStep).toBe(5);
    expect(state.pttBrevityLimit).toBe(320);
    expect(state.systemPromptOverride).toBe('');
    expect(state.backgroundBlur).toBe(8);
    expect(state.backdropOpacity).toBe(60);
    expect(state.launchOnStartup).toBe(false);
    expect(state.widgetBorderRadius).toBe(12);
    expect(state.widgetBorderWidth).toBe(1);
    expect(state.widgetBorderOpacity).toBe(15);
    expect(state.widgetGlowSize).toBe(15);
    expect(state.widgetGlowOpacity).toBe(15);
    expect(state.selectedAudioInput).toBe('Default');
    expect(state.selectedAudioOutput).toBe('Default');
    expect(state.microphoneVolume).toBe(100);
    expect(state.microphoneMuted).toBe(false);
  });

  it('should call set and save on setMetricsPollInterval', async () => {
    await useSettingsStore.getState().setMetricsPollInterval(1500);
    expect(mockSet).toHaveBeenCalledWith('metricsPollInterval', 1500);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().metricsPollInterval).toBe(1500);
  });

  it('should call set and save on setGpuTempAlertThreshold', async () => {
    await useSettingsStore.getState().setGpuTempAlertThreshold(85);
    expect(mockSet).toHaveBeenCalledWith('gpuTempAlertThreshold', 85);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().gpuTempAlertThreshold).toBe(85);
  });

  it('should call set and save on setCpuTempAlertThreshold', async () => {
    await useSettingsStore.getState().setCpuTempAlertThreshold(75);
    expect(mockSet).toHaveBeenCalledWith('cpuTempAlertThreshold', 75);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().cpuTempAlertThreshold).toBe(75);
  });

  it('should call set and save on setReplayDuration', async () => {
    await useSettingsStore.getState().setReplayDuration(45);
    expect(mockSet).toHaveBeenCalledWith('replayDuration', 45);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().replayDuration).toBe(45);
  });

  it('should call set and save on setExcludeHudFromCapture', async () => {
    await useSettingsStore.getState().setExcludeHudFromCapture(false);
    expect(mockSet).toHaveBeenCalledWith('excludeHudFromCapture', false);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().excludeHudFromCapture).toBe(false);
  });

  it('should call set and save on setFavoriteMixerApps', async () => {
    await useSettingsStore.getState().setFavoriteMixerApps('notepad.exe');
    expect(mockSet).toHaveBeenCalledWith('favoriteMixerApps', 'notepad.exe');
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().favoriteMixerApps).toBe('notepad.exe');
  });

  it('should call set and save on setVolumeStep', async () => {
    await useSettingsStore.getState().setVolumeStep(10);
    expect(mockSet).toHaveBeenCalledWith('volumeStep', 10);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().volumeStep).toBe(10);
  });

  it('should call set and save on setPttBrevityLimit', async () => {
    await useSettingsStore.getState().setPttBrevityLimit(100);
    expect(mockSet).toHaveBeenCalledWith('pttBrevityLimit', 100);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().pttBrevityLimit).toBe(100);
  });

  it('should call set and save on setSystemPromptOverride', async () => {
    await useSettingsStore.getState().setSystemPromptOverride('custom-prompt');
    expect(mockSet).toHaveBeenCalledWith('systemPromptOverride', 'custom-prompt');
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().systemPromptOverride).toBe('custom-prompt');
  });

  it('should call set, save and set root css on setBackgroundBlur', async () => {
    await useSettingsStore.getState().setBackgroundBlur(12);
    expect(mockSet).toHaveBeenCalledWith('backgroundBlur', 12);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().backgroundBlur).toBe(12);
  });

  it('should call set, save and set root css on setBackdropOpacity', async () => {
    await useSettingsStore.getState().setBackdropOpacity(75);
    expect(mockSet).toHaveBeenCalledWith('backdropOpacity', 75);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().backdropOpacity).toBe(75);
  });

  it('should call set and save on setLaunchOnStartup', async () => {
    await useSettingsStore.getState().setLaunchOnStartup(true);
    expect(mockSet).toHaveBeenCalledWith('launchOnStartup', true);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().launchOnStartup).toBe(true);
  });

  it('should call set and save on setWidgetBorderRadius', async () => {
    await useSettingsStore.getState().setWidgetBorderRadius(16);
    expect(mockSet).toHaveBeenCalledWith('widgetBorderRadius', 16);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().widgetBorderRadius).toBe(16);
  });

  it('should call set and save on setWidgetBorderWidth', async () => {
    await useSettingsStore.getState().setWidgetBorderWidth(2);
    expect(mockSet).toHaveBeenCalledWith('widgetBorderWidth', 2);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().widgetBorderWidth).toBe(2);
  });

  it('should call set and save on setWidgetBorderOpacity', async () => {
    await useSettingsStore.getState().setWidgetBorderOpacity(30);
    expect(mockSet).toHaveBeenCalledWith('widgetBorderOpacity', 30);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().widgetBorderOpacity).toBe(30);
  });

  it('should call set and save on setWidgetGlowSize', async () => {
    await useSettingsStore.getState().setWidgetGlowSize(20);
    expect(mockSet).toHaveBeenCalledWith('widgetGlowSize', 20);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().widgetGlowSize).toBe(20);
  });

  it('should call set and save on setWidgetGlowOpacity', async () => {
    await useSettingsStore.getState().setWidgetGlowOpacity(25);
    expect(mockSet).toHaveBeenCalledWith('widgetGlowOpacity', 25);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().widgetGlowOpacity).toBe(25);
  });

  it('should call set and save on setSelectedAudioInput', async () => {
    await useSettingsStore.getState().setSelectedAudioInput('Mic 1');
    expect(mockSet).toHaveBeenCalledWith('selectedAudioInput', 'Mic 1');
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().selectedAudioInput).toBe('Mic 1');
  });

  it('should call set and save on setSelectedAudioOutput', async () => {
    await useSettingsStore.getState().setSelectedAudioOutput('Speakers 1');
    expect(mockSet).toHaveBeenCalledWith('selectedAudioOutput', 'Speakers 1');
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().selectedAudioOutput).toBe('Speakers 1');
  });

  it('should call set, save and invoke on setMicrophoneVolume', async () => {
    await useSettingsStore.getState().setMicrophoneVolume(80);
    expect(mockSet).toHaveBeenCalledWith('microphoneVolume', 80);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().microphoneVolume).toBe(80);
  });

  it('should call set, save and invoke on setMicrophoneMuted', async () => {
    await useSettingsStore.getState().setMicrophoneMuted(true);
    expect(mockSet).toHaveBeenCalledWith('microphoneMuted', true);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().microphoneMuted).toBe(true);
  });

  it('should call set and save on setSyncBorderGlowWithTheme', async () => {
    await useSettingsStore.getState().setSyncBorderGlowWithTheme(false);
    expect(mockSet).toHaveBeenCalledWith('syncBorderGlowWithTheme', false);
    expect(mockSet).toHaveBeenCalledWith('syncBorderWithTheme', false);
    expect(mockSet).toHaveBeenCalledWith('syncGlowWithTheme', false);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().syncBorderGlowWithTheme).toBe(false);
    expect(useSettingsStore.getState().syncBorderWithTheme).toBe(false);
    expect(useSettingsStore.getState().syncGlowWithTheme).toBe(false);
  });

  it('should call set and save on setSyncBorderWithTheme', async () => {
    await useSettingsStore.getState().setSyncBorderWithTheme(false);
    expect(mockSet).toHaveBeenCalledWith('syncBorderWithTheme', false);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().syncBorderWithTheme).toBe(false);
  });

  it('should call set and save on setSyncGlowWithTheme', async () => {
    await useSettingsStore.getState().setSyncGlowWithTheme(false);
    expect(mockSet).toHaveBeenCalledWith('syncGlowWithTheme', false);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().syncGlowWithTheme).toBe(false);
  });

  it('should call set and save on setCustomBorderColor', async () => {
    await useSettingsStore.getState().setCustomBorderColor('#ff0000');
    expect(mockSet).toHaveBeenCalledWith('customBorderColor', '#ff0000');
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().customBorderColor).toBe('#ff0000');
  });

  it('should call set and save on setCustomGlowColor', async () => {
    await useSettingsStore.getState().setCustomGlowColor('#0000ff');
    expect(mockSet).toHaveBeenCalledWith('customGlowColor', '#0000ff');
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().customGlowColor).toBe('#0000ff');
  });

  it('should call set and save on setDockCollapsed', async () => {
    await useSettingsStore.getState().setDockCollapsed(true);
    expect(mockSet).toHaveBeenCalledWith('dockCollapsed', true);
    expect(mockSave).toHaveBeenCalled();
    expect(useSettingsStore.getState().dockCollapsed).toBe(true);
  });

  it('should enforce clamping failsafes for settings', async () => {
    // metricsPollInterval (1000..10000)
    await useSettingsStore.getState().setMetricsPollInterval(500);
    expect(useSettingsStore.getState().metricsPollInterval).toBe(1000);
    await useSettingsStore.getState().setMetricsPollInterval(15000);
    expect(useSettingsStore.getState().metricsPollInterval).toBe(10000);

    // temp thresholds (40..100)
    await useSettingsStore.getState().setGpuTempAlertThreshold(20);
    expect(useSettingsStore.getState().gpuTempAlertThreshold).toBe(40);
    await useSettingsStore.getState().setGpuTempAlertThreshold(120);
    expect(useSettingsStore.getState().gpuTempAlertThreshold).toBe(100);

    await useSettingsStore.getState().setCpuTempAlertThreshold(20);
    expect(useSettingsStore.getState().cpuTempAlertThreshold).toBe(40);
    await useSettingsStore.getState().setCpuTempAlertThreshold(120);
    expect(useSettingsStore.getState().cpuTempAlertThreshold).toBe(100);

    // replayDuration (5..300)
    await useSettingsStore.getState().setReplayDuration(2);
    expect(useSettingsStore.getState().replayDuration).toBe(5);
    await useSettingsStore.getState().setReplayDuration(400);
    expect(useSettingsStore.getState().replayDuration).toBe(300);

    // volumeStep (1..50)
    await useSettingsStore.getState().setVolumeStep(0);
    expect(useSettingsStore.getState().volumeStep).toBe(1);
    await useSettingsStore.getState().setVolumeStep(60);
    expect(useSettingsStore.getState().volumeStep).toBe(50);

    // brevity limit (50..2000)
    await useSettingsStore.getState().setPttBrevityLimit(10);
    expect(useSettingsStore.getState().pttBrevityLimit).toBe(50);
    await useSettingsStore.getState().setPttBrevityLimit(3000);
    expect(useSettingsStore.getState().pttBrevityLimit).toBe(2000);

    // backgroundBlur (0..20)
    await useSettingsStore.getState().setBackgroundBlur(-5);
    expect(useSettingsStore.getState().backgroundBlur).toBe(0);
    await useSettingsStore.getState().setBackgroundBlur(30);
    expect(useSettingsStore.getState().backgroundBlur).toBe(20);

    // backdropOpacity (0..95)
    await useSettingsStore.getState().setBackdropOpacity(-10);
    expect(useSettingsStore.getState().backdropOpacity).toBe(0);
    await useSettingsStore.getState().setBackdropOpacity(110);
    expect(useSettingsStore.getState().backdropOpacity).toBe(95);

    // widgetBorderRadius (0..24)
    await useSettingsStore.getState().setWidgetBorderRadius(-5);
    expect(useSettingsStore.getState().widgetBorderRadius).toBe(0);
    await useSettingsStore.getState().setWidgetBorderRadius(35);
    expect(useSettingsStore.getState().widgetBorderRadius).toBe(24);

    // widgetBorderWidth (1..4)
    await useSettingsStore.getState().setWidgetBorderWidth(0);
    expect(useSettingsStore.getState().widgetBorderWidth).toBe(1);
    await useSettingsStore.getState().setWidgetBorderWidth(10);
    expect(useSettingsStore.getState().widgetBorderWidth).toBe(4);

    // widgetBorderOpacity (5..80)
    await useSettingsStore.getState().setWidgetBorderOpacity(2);
    expect(useSettingsStore.getState().widgetBorderOpacity).toBe(5);
    await useSettingsStore.getState().setWidgetBorderOpacity(95);
    expect(useSettingsStore.getState().widgetBorderOpacity).toBe(80);

    // widgetGlowSize (0..30)
    await useSettingsStore.getState().setWidgetGlowSize(-5);
    expect(useSettingsStore.getState().widgetGlowSize).toBe(0);
    await useSettingsStore.getState().setWidgetGlowSize(40);
    expect(useSettingsStore.getState().widgetGlowSize).toBe(30);

    // widgetGlowOpacity (0..100)
    await useSettingsStore.getState().setWidgetGlowOpacity(-10);
    expect(useSettingsStore.getState().widgetGlowOpacity).toBe(0);
    await useSettingsStore.getState().setWidgetGlowOpacity(120);
    expect(useSettingsStore.getState().widgetGlowOpacity).toBe(100);

    // microphoneVolume (0..100)
    await useSettingsStore.getState().setMicrophoneVolume(-10);
    expect(useSettingsStore.getState().microphoneVolume).toBe(0);
    await useSettingsStore.getState().setMicrophoneVolume(120);
    expect(useSettingsStore.getState().microphoneVolume).toBe(100);
  });
});
