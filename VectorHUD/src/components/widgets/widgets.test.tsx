// @vitest-environment jsdom
/**
 * Cross-Platform Widget Tests
 *
 * These tests verify that VectorHUD's widget components can mount and render
 * correctly in a mock browser (jsdom) environment without any native Windows
 * dependencies (DXGI, Core Audio, PresentMon, etc.).
 *
 * All Tauri IPC calls are mocked so these tests can run on any OS / CI runner.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// ──────────────────────────────────────────────
//  Mock: @tauri-apps/api/core
// ──────────────────────────────────────────────
const mockInvoke = vi.fn().mockImplementation((cmd: string) => {
  switch (cmd) {
    case 'get_audio_mixer_state':
      return Promise.resolve({
        master_volume: 0.75,
        master_muted: false,
        sessions: [
          { process_id: 1234, name: 'chrome.exe', volume: 0.5, muted: false },
          { process_id: 5678, name: 'discord.exe', volume: 0.8, muted: false },
        ],
      });
    case 'get_current_media':
      return Promise.resolve({
        title: 'Test Song',
        artist: 'Test Artist',
        album_artist: 'Test Album Artist',
        is_playing: true,
      });
    case 'get_audio_devices':
      return Promise.resolve({
        inputs: [{ id: 'mic-1', name: 'Test Microphone' }],
        outputs: [{ id: 'spk-1', name: 'Test Speakers' }],
      });
    case 'get_audio_peak_levels':
      return Promise.resolve([0.3, 0.1]);
    default:
      return Promise.resolve(null);
  }
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ──────────────────────────────────────────────
//  Mock: @tauri-apps/api/event
// ──────────────────────────────────────────────
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// ──────────────────────────────────────────────
//  Mock: ../../utils/logger
// ──────────────────────────────────────────────
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    flushCrashBacklog: vi.fn(),
  },
}));

// ──────────────────────────────────────────────
//  Mock: ../../utils/store  (Tauri plugin-store)
// ──────────────────────────────────────────────
vi.mock('../../utils/store', () => ({
  getSettingsStore: () =>
    Promise.resolve({
      set: vi.fn(),
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    }),
}));

// ──────────────────────────────────────────────
//  Mock: @tauri-apps/plugin-autostart
// ──────────────────────────────────────────────
vi.mock('@tauri-apps/plugin-autostart', () => ({
  enable: vi.fn().mockResolvedValue(undefined),
  disable: vi.fn().mockResolvedValue(undefined),
  isEnabled: vi.fn().mockResolvedValue(false),
}));

// ──────────────────────────────────────────────
//  Imports (after mocks are registered)
// ──────────────────────────────────────────────
import { HardwareWidget } from './HardwareWidget';
import { AudioHubWidget } from './AudioHubWidget';
import { TimerWidget } from './TimerWidget';
import { DummyWidget } from './DummyWidget';

// ═══════════════════════════════════════════════
//  TEST SUITES
// ═══════════════════════════════════════════════

describe('Cross-Platform Widget Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ───────────────────────────────────────
  //  DummyWidget
  // ───────────────────────────────────────
  describe('DummyWidget', () => {
    it('should mount and render placeholder telemetry', () => {
      render(React.createElement(DummyWidget));

      expect(screen.getByText('SYSTEM.STATUS')).toBeTruthy();
      expect(screen.getByText('ONLINE')).toBeTruthy();
      expect(screen.getByText('CPU_USAGE')).toBeTruthy();
      expect(screen.getByText('42%')).toBeTruthy();
      expect(screen.getByText('GPU_TEMP')).toBeTruthy();
      expect(screen.getByText('65°C')).toBeTruthy();
    });

    it('should render drag-to-resize hint', () => {
      render(React.createElement(DummyWidget));
      expect(screen.getByText('Drag bottom-right corner to resize')).toBeTruthy();
    });
  });

  // ───────────────────────────────────────
  //  HardwareWidget
  // ───────────────────────────────────────
  describe('HardwareWidget', () => {
    it('should mount without native Windows dependencies', () => {
      const { container } = render(React.createElement(HardwareWidget));
      expect(container.querySelector('.flex.flex-col')).toBeTruthy();
    });

    it('should render CPU, GPU, RAM, VRAM labels', () => {
      render(React.createElement(HardwareWidget));

      // CPU and GPU text appears in multiple elements (label + tooltip), so use getAllByText
      expect(screen.getAllByText(/^CPU/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/^GPU/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('RAM')).toBeTruthy();
      expect(screen.getByText('VRAM')).toBeTruthy();
    });

    it('should display FPS fallback when no data is available', () => {
      render(React.createElement(HardwareWidget));
      expect(screen.getByText(/FPS: --/)).toBeTruthy();
    });

    it('should render HUD CPU and HUD RAM self-metrics section', () => {
      render(React.createElement(HardwareWidget));
      expect(screen.getByText(/HUD CPU:/)).toBeTruthy();
      expect(screen.getByText(/HUD RAM:/)).toBeTruthy();
    });

    it('should show temperature placeholder (--°C) when not elevated', () => {
      render(React.createElement(HardwareWidget));
      // CPU temp will be null by default, so it should show the placeholder
      expect(screen.getByText('(--°C)', { exact: true })).toBeTruthy();
    });
  });

  // ───────────────────────────────────────
  //  AudioHubWidget
  // ───────────────────────────────────────
  describe('AudioHubWidget', () => {
    it('should mount and render tab selector', () => {
      render(React.createElement(AudioHubWidget));

      expect(screen.getByText('Mixer')).toBeTruthy();
      expect(screen.getByText('Devices')).toBeTruthy();
    });

    it('should render Master Output section by default', () => {
      render(React.createElement(AudioHubWidget));
      expect(screen.getByText('Master Output')).toBeTruthy();
    });

    it('should render App Mixer label', () => {
      render(React.createElement(AudioHubWidget));
      expect(screen.getByText('App Mixer')).toBeTruthy();
    });

    it('should switch to Devices tab when clicked', () => {
      render(React.createElement(AudioHubWidget));

      const devicesTab = screen.getByText('Devices');
      fireEvent.click(devicesTab);

      expect(screen.getByText('Hardware Interfaces')).toBeTruthy();
      expect(screen.getByText('Speaker / Output Device')).toBeTruthy();
      expect(screen.getByText('Microphone / Input Device')).toBeTruthy();
    });
  });

  // ───────────────────────────────────────
  //  TimerWidget
  // ───────────────────────────────────────
  describe('TimerWidget', () => {
    it('should mount and render tab labels', () => {
      render(React.createElement(TimerWidget));

      expect(screen.getByText('COUNTDOWN')).toBeTruthy();
      expect(screen.getByText('STOPWATCH')).toBeTruthy();
    });

    it('should render START and RESET buttons', () => {
      render(React.createElement(TimerWidget));

      expect(screen.getByText('START')).toBeTruthy();
      expect(screen.getByText('RESET')).toBeTruthy();
    });

    it('should render countdown time adjustment buttons', () => {
      render(React.createElement(TimerWidget));

      expect(screen.getByText('-1M')).toBeTruthy();
      expect(screen.getByText('+1M')).toBeTruthy();
    });

    it('should switch to Stopwatch tab when clicked', () => {
      render(React.createElement(TimerWidget));

      const stopwatchTab = screen.getByText('STOPWATCH');
      fireEvent.click(stopwatchTab);

      // Both tabs should still render
      expect(screen.getByText('COUNTDOWN')).toBeTruthy();
      expect(screen.getByText('STOPWATCH')).toBeTruthy();

      // Start and Reset should exist for the stopwatch
      expect(screen.getByText('START')).toBeTruthy();
      expect(screen.getByText('RESET')).toBeTruthy();
    });
  });
});
