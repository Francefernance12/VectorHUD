// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useAudioStore } from './store/audioStore';
import { useToastStore } from './store/toastStore';
import { listen } from '@tauri-apps/api/event';

// Mock event listeners registry
const eventListeners: Record<string, (event: any) => void> = {};

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockImplementation((event: string, callback: (event: any) => void) => {
    eventListeners[event] = callback;
    return Promise.resolve(() => {
      delete eventListeners[event];
    });
  }),
}));

const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

vi.mock('./utils/db', () => ({
  getDb: () => Promise.resolve({
    execute: vi.fn().mockResolvedValue({ rowsAffected: 0 }),
    select: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('./utils/logger', () => ({
  logger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
  },
  sanitizeError: (err: any) => String(err),
}));

// We can mock components inside App to make it fast
vi.mock('./components/Dock', () => ({
  Dock: () => <div data-testid="mock-dock" />
}));
vi.mock('./components/WidgetContainer', () => ({
  WidgetContainer: () => <div data-testid="mock-widget-container" />
}));
vi.mock('./components/SettingsModal', () => ({
  SettingsModal: () => <div data-testid="mock-settings-modal" />
}));

import App from './App';

describe('App & Global Hotkey Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(eventListeners).forEach((key) => {
      delete eventListeners[key];
    });
  });

  it('should initialize hotkey listeners on mount', async () => {
    render(<App />);
    
    // Wait for all async listeners to register
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Check that we register hotkeys
    expect(listen).toHaveBeenCalledWith('hotkey-overlay', expect.any(Function));
    expect(listen).toHaveBeenCalledWith('hotkey-interact', expect.any(Function));
    expect(listen).toHaveBeenCalledWith('hotkey-screenshot', expect.any(Function));
    expect(listen).toHaveBeenCalledWith('hotkey-record', expect.any(Function));
    expect(listen).toHaveBeenCalledWith('hotkey-replay', expect.any(Function));
    
    // Check mute slots
    for (let i = 1; i <= 10; i++) {
      expect(listen).toHaveBeenCalledWith(`hotkey-mute-${i}`, expect.any(Function));
    }
  });

  it('should toggle mute for favorited applications when hotkey is pressed', async () => {
    render(<App />);

    // Wait for all async listeners to register
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Configure favorite apps
    useAudioStore.setState({
      favoriteApps: ['spotify.exe', 'discord.exe']
    });

    // Mock mixer state
    mockInvoke.mockImplementation((cmd, _args) => {
      if (cmd === 'get_audio_mixer_state') {
        return Promise.resolve({
          master_volume: 0.8,
          master_muted: false,
          sessions: [
            { process_id: 101, name: 'spotify.exe', volume: 0.5, muted: false },
            { process_id: 202, name: 'chrome.exe', volume: 0.7, muted: false },
          ]
        });
      }
      if (cmd === 'toggle_app_mute') {
        return Promise.resolve();
      }
      return Promise.resolve();
    });

    // Retrieve and execute the hotkey-mute-1 callback
    const mute1Callback = eventListeners['hotkey-mute-1'];
    expect(mute1Callback).toBeDefined();

    await mute1Callback({ payload: {} });

    // Verify it invoked get_audio_mixer_state
    expect(mockInvoke).toHaveBeenCalledWith('get_audio_mixer_state');

    // Verify it invoked toggle_app_mute with spotify.exe pid (101)
    expect(mockInvoke).toHaveBeenCalledWith('toggle_app_mute', { pid: 101 });
  });

  it('should trigger move_to_active_monitor when toast is shown', async () => {
    mockInvoke.mockResolvedValue(undefined);

    useToastStore.getState().showToast('Test Message');

    expect(mockInvoke).toHaveBeenCalledWith('move_to_active_monitor');
  });
});
