// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { OpenRouterWidget } from './OpenRouterWidget';
import { useOpenRouterStore } from '../../store/openRouterStore';

// Mock scrollIntoView for jsdom compatibility
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock: @tauri-apps/api/core
const mockInvoke = vi.fn().mockImplementation((cmd: string, args: any) => {
  if (cmd === 'read_attached_file') {
    return Promise.resolve("mocked file content for " + args.path);
  }
  return Promise.resolve(null);
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock: @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Mock: ../../utils/logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock: ../../utils/db
const mockSelect = vi.fn().mockImplementation((query: string) => {
  if (query.includes('session_titles')) {
    return Promise.resolve([
      { session_id: 'sess-1', title: 'Tactical Combat Strategy', timestamp: '2026-06-23T12:00:00Z', custom_title: 'Tactical Combat Strategy' },
      { session_id: 'sess-2', title: 'Telemetry Optimization Logs', timestamp: '2026-06-23T13:00:00Z', custom_title: 'Telemetry Optimization Logs' }
    ]);
  }
  return Promise.resolve([]);
});

vi.mock('../../utils/db', () => ({
  getDb: () => Promise.resolve({
    select: (...args: any[]) => mockSelect(...args),
    execute: vi.fn().mockResolvedValue(undefined),
  }),
  executeQuery: vi.fn().mockResolvedValue(undefined),
}));

describe('OpenRouterWidget Enhancements Tests', () => {
  let onlineSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    onlineSpy = vi.spyOn(navigator, 'onLine', 'get');
    onlineSpy.mockReturnValue(true);
    useOpenRouterStore.setState({
      sidebarOpen: true,
      currentSessionId: 'sess-1'
    });
  });

  afterEach(() => {
    onlineSpy.mockRestore();
    cleanup();
  });

  it('should render search sessions bar and filter list', async () => {
    render(React.createElement(OpenRouterWidget));

    // Wait for db select to load sessions
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search Sessions.../i)).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText(/Search Sessions.../i) as HTMLInputElement;
    
    // Type a query that matches only one session
    fireEvent.change(searchInput, { target: { value: 'combat' } });

    // Verify filtered sidebar titles
    await waitFor(() => {
      expect(screen.getByText('Tactical Combat Strategy')).toBeTruthy();
      expect(screen.queryByText('Telemetry Optimization Logs')).toBeNull();
    });
  });

  it('should toggle session settings drawer and render options', async () => {
    render(React.createElement(OpenRouterWidget));

    // Open settings drawer using gear icon
    const gearBtn = screen.getByTitle(/Session Settings/i);
    expect(gearBtn).toBeTruthy();
    fireEvent.click(gearBtn);

    // Verify drawer headers and inputs are visible
    expect(screen.getByText('Session Model')).toBeTruthy();
    expect(screen.getByText('Temperature')).toBeTruthy();
    expect(screen.getByText('Token Ammo Gauge')).toBeTruthy();
    expect(screen.getByText('Active HUD Skills')).toBeTruthy();
    expect(screen.getByText('SYSTEM CONTROLLER')).toBeTruthy();
  });

  it('should allow file attachments and render metadata wirecards', async () => {
    const { container } = render(React.createElement(OpenRouterWidget));

    // Mock file input click
    const paperclipBtn = screen.getByTitle(/Attach documents/i);
    expect(paperclipBtn).toBeTruthy();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // Mock file list attachment
    const file = new File(['code block content'], 'test_code.py', { type: 'text/plain' });
    Object.defineProperty(file, 'path', {
      value: 'd:/ProgrammingProjects/FrancisGamebar/VectorHUD/src/test_code.py',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for the draft card to render
    await waitFor(() => {
      expect(screen.getByText('test_code.py')).toBeTruthy();
      expect(screen.getByText(/0.0 KB | 1 LINES/i)).toBeTruthy();
    });
  });

  it('should apply model-specific defaults when switching models and resetting', async () => {
    render(React.createElement(OpenRouterWidget));

    // Open settings drawer
    const gearBtn = screen.getByTitle(/Session Settings/i);
    fireEvent.click(gearBtn);

    // Get the model select dropdown
    const modelSelect = screen.getByText('Session Model').parentElement?.querySelector('select') as HTMLSelectElement;
    expect(modelSelect).toBeTruthy();

    // Switch model to Claude 3.5 Sonnet
    fireEvent.change(modelSelect, { target: { value: 'anthropic/claude-3.5-sonnet' } });

    // Claude 3.5 Sonnet temperature default is 1.0, let's verify temperature is updated
    await waitFor(() => {
      expect(screen.getByText('1.0')).toBeTruthy();
    });

    // Let's check that the Model Defaults button works
    const modelDefaultsBtn = screen.getByText('Model Defaults');
    expect(modelDefaultsBtn).toBeTruthy();
    fireEvent.click(modelDefaultsBtn);

    // Verify it resets and temperature remains at the model default
    await waitFor(() => {
      expect(screen.getByText('1.0')).toBeTruthy();
    });
  });
});
