// @vitest-environment jsdom
/**
 * Offline Mode Widget Tests
 *
 * Verifies that the Notion and OpenRouter widgets adapt correctly
 * to offline states (navigator.onLine = false) by displaying warnings,
 * disabling online actions, and falling back to local storage.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';

// Mock scrollIntoView for jsdom compatibility
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// ──────────────────────────────────────────────
//  Mock: @tauri-apps/api/core
// ──────────────────────────────────────────────
const mockInvoke = vi.fn().mockImplementation((cmd: string) => {
  return Promise.resolve(null);
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
  },
}));

// ──────────────────────────────────────────────
//  Mock: ../../utils/db
// ──────────────────────────────────────────────
vi.mock('../../utils/db', () => ({
  getDb: () => Promise.resolve({
    select: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { OpenRouterWidget } from './OpenRouterWidget';
import { NotionCaptureWidget } from './NotionCaptureWidget';

describe('Offline Mode Widget Tests', () => {
  let onlineSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    onlineSpy = vi.spyOn(navigator, 'onLine', 'get');
  });

  afterEach(() => {
    onlineSpy.mockRestore();
    cleanup();
  });

  describe('OpenRouterWidget Offline Mode', () => {
    it('should display the offline banner and disable submit inputs when offline', () => {
      // Force navigator.onLine to return false
      onlineSpy.mockReturnValue(false);

      render(React.createElement(OpenRouterWidget));

      // Verify the banner is rendered
      expect(screen.getByText(/OFFLINE: AI Chat & Voice PTT Unavailable/i)).toBeTruthy();

      // Verify input field is disabled and shows connection offline placeholder
      const input = screen.getByPlaceholderText(/CONNECTION OFFLINE/i) as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.disabled).toBe(true);

      // Verify microphone button is disabled
      const micBtn = screen.getByTitle(/Record voice/i) as HTMLButtonElement;
      expect(micBtn.disabled).toBe(true);

      // Verify send button is disabled
      const sendBtn = screen.getByRole('button', { name: /Send/i }) as HTMLButtonElement;
      expect(sendBtn.disabled).toBe(true);

      // Verify vision buffer button is disabled
      const visionBtn = screen.getByRole('button', { name: /Engage Vision Buffer/i }) as HTMLButtonElement;
      expect(visionBtn.disabled).toBe(true);
    });
  });

  describe('NotionCaptureWidget Offline Mode', () => {
    it('should show offline badge and adapt button actions in draft view', () => {
      onlineSpy.mockReturnValue(false);

      render(React.createElement(NotionCaptureWidget));

      // Verify header status is set to OFFLINE (use exact match to avoid sync_offline/tooltip matches)
      expect(screen.getByText('📡 OFFLINE')).toBeTruthy();

      // Verify sync button is offline disabled
      const syncBtn = screen.getByRole('button', { name: /SYNC_OFFLINE/i }) as HTMLButtonElement;
      expect(syncBtn.disabled).toBe(true);

      // Verify local save button is scaled up and reads SAVE_LOCAL_ONLY
      const saveBtn = screen.getByRole('button', { name: /SAVE_LOCAL_ONLY/i }) as HTMLButtonElement;
      expect(saveBtn).toBeTruthy();
      expect(saveBtn.className).toContain('flex-1');
    });

    it('should show offline database placeholder in Database tab', () => {
      onlineSpy.mockReturnValue(false);

      render(React.createElement(NotionCaptureWidget));

      // Switch to database view tab
      const dbTab = screen.getByRole('button', { name: /DATABASE_VIEW/i });
      expect(dbTab).toBeTruthy();
      // Click tab using testing-library's click helper
      fireEvent.click(dbTab);

      // Verify database offline placeholder is displayed
      expect(screen.getByText(/DATABASE_OFFLINE/i)).toBeTruthy();
      expect(screen.getByText(/active notes database and checklist syncing are unavailable/i)).toBeTruthy();
    });
  });
});
