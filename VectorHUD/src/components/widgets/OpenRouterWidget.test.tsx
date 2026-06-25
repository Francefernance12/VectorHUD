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
  if (cmd === 'select_attached_files') {
    return Promise.resolve(['d:/ProgrammingProjects/FrancisGamebar/VectorHUD/src/test_code.py']);
  }
  if (cmd === 'read_attached_file_data') {
    return Promise.resolve({
      name: 'test_code.py',
      path: args.path,
      content: 'code block content',
      size: 1024,
      lines: 1
    });
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
      currentSessionId: 'sess-1',
      attachedFiles: [],
      input: '',
      draftImagePath: null
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

    // Get the model select dropdown button and open it
    const modelDropdownButton = screen.getByText('Session Model').parentElement?.querySelector('button') as HTMLButtonElement;
    expect(modelDropdownButton).toBeTruthy();
    fireEvent.click(modelDropdownButton);

    // Switch model to Claude 3.5 Sonnet by clicking its custom option
    const sonnetOption = screen.getByText('Claude 3.5 Sonnet');
    expect(sonnetOption).toBeTruthy();
    fireEvent.click(sonnetOption);

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

  it('should allow adding user custom skills in settings drawer', async () => {
    render(React.createElement(OpenRouterWidget));
    
    // Open settings drawer
    const gearBtn = screen.getByTitle(/Session Settings/i);
    fireEvent.click(gearBtn);

    // Find and click the Add button for Custom Skills
    const addSkillBtn = screen.getByText('User Custom Skills').parentElement?.querySelector('button') as HTMLButtonElement;
    expect(addSkillBtn).toBeTruthy();
    fireEvent.click(addSkillBtn);

    // Verify form fields are shown
    expect(screen.getByPlaceholderText('E.G. NOTION_ASSISTANT')).toBeTruthy();
    
    // Fill in values
    const nameInput = screen.getByPlaceholderText('E.G. NOTION_ASSISTANT') as HTMLInputElement;
    const descInput = screen.getByPlaceholderText(/E.G. Directs AI to summarize/i) as HTMLInputElement;
    const instTextarea = screen.getByPlaceholderText('Instructions for the AI...') as HTMLTextAreaElement;
    
    fireEvent.change(nameInput, { target: { value: 'TEST_SKILL' } });
    fireEvent.change(descInput, { target: { value: 'This is a test skill' } });
    fireEvent.change(instTextarea, { target: { value: 'Always end with TEST_SKILL_SUCCESS' } });

    // Click Save Skill
    const saveBtn = screen.getByText('Save Skill');
    fireEvent.click(saveBtn);

    // Verify it is listed in custom skills list
    await waitFor(() => {
      expect(screen.getByText('TEST_SKILL')).toBeTruthy();
      expect(screen.getByText('This is a test skill')).toBeTruthy();
    });
  });

  it('should allow adding custom MCP servers and tools in settings drawer', async () => {
    render(React.createElement(OpenRouterWidget));
    
    // Open settings drawer
    const gearBtn = screen.getByTitle(/Session Settings/i);
    fireEvent.click(gearBtn);

    // Find and click the Add button for Custom MCPs
    const addMcpBtn = screen.getByText('User Custom MCPs').parentElement?.querySelector('button') as HTMLButtonElement;
    expect(addMcpBtn).toBeTruthy();
    fireEvent.click(addMcpBtn);

    // Verify form fields are shown
    expect(screen.getByPlaceholderText('E.G. SQLITE_EXPLORER')).toBeTruthy();
    
    // Fill in values
    const nameInput = screen.getByPlaceholderText('E.G. SQLITE_EXPLORER') as HTMLInputElement;
    const cmdInput = screen.getByPlaceholderText('node / npx') as HTMLInputElement;
    const argsInput = screen.getByPlaceholderText('e.g. index.js') as HTMLInputElement;
    
    fireEvent.change(nameInput, { target: { value: 'test_mcp' } });
    fireEvent.change(cmdInput, { target: { value: 'node' } });
    fireEvent.change(argsInput, { target: { value: 'index.js' } });

    // Add tool
    const addToolLink = screen.getByText('+ Add Tool');
    expect(addToolLink).toBeTruthy();
    fireEvent.click(addToolLink);

    const toolNameInput = screen.getByPlaceholderText('TOOL_NAME') as HTMLInputElement;
    const toolDescInput = screen.getByPlaceholderText('TOOL_DESCRIPTION') as HTMLInputElement;
    
    fireEvent.change(toolNameInput, { target: { value: 'test_tool' } });
    fireEvent.change(toolDescInput, { target: { value: 'Runs a test action' } });

    const addToolBtn = screen.getByText('Add Tool to Config');
    fireEvent.click(addToolBtn);

    // Verify tool was added to the config list
    expect(screen.getByText('test_tool')).toBeTruthy();

    // Click Save Config
    const saveMcpBtn = screen.getByText('Save Config');
    fireEvent.click(saveMcpBtn);

    // Verify MCP listed
    await waitFor(() => {
      expect(screen.getByText('test_mcp')).toBeTruthy();
    });
  });

  it('should dynamically include global default and direct provider models in options list', async () => {
    render(React.createElement(OpenRouterWidget));
    
    // Open settings drawer
    const gearBtn = screen.getByTitle(/Session Settings/i);
    fireEvent.click(gearBtn);

    // Open the dropdown
    const modelDropdownButton = screen.getByText('Session Model').parentElement?.querySelector('button') as HTMLButtonElement;
    expect(modelDropdownButton).toBeTruthy();
    fireEvent.click(modelDropdownButton);

    // Verify model options are rendered in the custom list
    expect(screen.getAllByText('Gemini 2.5 Flash').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Claude 3.5 Sonnet')).toBeTruthy();
  });
});
