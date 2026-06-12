// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { executeTool, AI_TOOLS, getAnthropicTools } from './aiActions';
import { useHardwareStore } from '../store/hardwareStore';
import { useTimerStore } from '../store/timerStore';
import { useNotionStore } from '../store/notionStore';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => {
    mockInvoke(cmd, args);
    if (cmd === 'capture_screenshot') {
      return Promise.resolve("C:\\Users\\Desktop\\screenshot.png");
    }
    return Promise.resolve();
  }
}));

// Mock database helper
const mockDbExecute = vi.fn();
const mockDbSelect = vi.fn().mockResolvedValue([]);
vi.mock('./db', () => ({
  getDb: () => Promise.resolve({
    execute: mockDbExecute,
    select: mockDbSelect
  })
}));

describe('aiActions', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockDbExecute.mockClear();
    // Reset stores
    useHardwareStore.setState({ latestMetrics: null });
    useTimerStore.setState({ cdInput: 60, cdTime: 60, cdIsRunning: false, cdFinished: false });
    useNotionStore.setState({ notes: [] });
  });

  describe('getAnthropicTools', () => {
    it('should convert tools to Anthropic format', () => {
      const anthropicTools = getAnthropicTools();
      expect(anthropicTools.length).toBe(AI_TOOLS.length);
      expect(anthropicTools[0]).toHaveProperty('name');
      expect(anthropicTools[0]).toHaveProperty('description');
      expect(anthropicTools[0]).toHaveProperty('input_schema');
    });
  });

  describe('executeTool', () => {
    it('should set master volume correctly', async () => {
      const res = await executeTool('set_master_volume', { volume_percent: 45 });
      expect(res).toBe('Success: system volume set to 45%.');
      expect(mockInvoke).toHaveBeenCalledWith('set_master_volume', { volume: 0.45 });
    });

    it('should handle invalid volume', async () => {
      const res = await executeTool('set_master_volume', { volume_percent: 150 });
      expect(res).toContain('Error');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should toggle master mute', async () => {
      const res = await executeTool('toggle_master_mute', {});
      expect(res).toBe('Success: toggled master system mute state.');
      expect(mockInvoke).toHaveBeenCalledWith('toggle_master_mute', undefined);
    });

    it('should execute media control play_pause', async () => {
      const res = await executeTool('media_control', { command: 'play_pause' });
      expect(res).toBe("Success: media command 'play_pause' executed.");
      expect(mockInvoke).toHaveBeenCalledWith('media_play_pause', undefined);
    });

    it('should execute media control next', async () => {
      const res = await executeTool('media_control', { command: 'next' });
      expect(res).toBe("Success: media command 'next' executed.");
      expect(mockInvoke).toHaveBeenCalledWith('media_next', undefined);
    });

    it('should execute media control prev', async () => {
      const res = await executeTool('media_control', { command: 'prev' });
      expect(res).toBe("Success: media command 'prev' executed.");
      expect(mockInvoke).toHaveBeenCalledWith('media_prev', undefined);
    });

    it('should handle unsupported media command', async () => {
      const res = await executeTool('media_control', { command: 'invalid' });
      expect(res).toContain('Error: unsupported media command');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('should start countdown timer', async () => {
      const res = await executeTool('start_timer', { duration_seconds: 120 });
      expect(res).toBe('Success: started countdown timer for 120 seconds.');
      expect(useTimerStore.getState().cdInput).toBe(120);
    });

    it('should reset countdown timer', async () => {
      const res = await executeTool('reset_timer', {});
      expect(res).toBe('Success: reset countdown timer.');
    });

    it('should control stopwatch commands', async () => {
      const startSwSpy = vi.fn();
      const pauseSwSpy = vi.fn();
      const resetSwSpy = vi.fn();
      
      useTimerStore.setState({
        startSw: startSwSpy,
        pauseSw: pauseSwSpy,
        resetSw: resetSwSpy
      } as any);

      let res = await executeTool('control_stopwatch', { command: 'start' });
      expect(res).toBe("Success: stopwatch command 'start' executed.");
      expect(startSwSpy).toHaveBeenCalled();

      res = await executeTool('control_stopwatch', { command: 'pause' });
      expect(res).toBe("Success: stopwatch command 'pause' executed.");
      expect(pauseSwSpy).toHaveBeenCalled();

      res = await executeTool('control_stopwatch', { command: 'reset' });
      expect(res).toBe("Success: stopwatch command 'reset' executed.");
      expect(resetSwSpy).toHaveBeenCalled();
    });

    it('should handle unsupported stopwatch command', async () => {
      const res = await executeTool('control_stopwatch', { command: 'invalid' });
      expect(res).toContain('Error: unsupported stopwatch command');
    });

    it('should get hardware metrics when available', async () => {
      const metrics = {
        cpu_usage: 15,
        ram_usage_percent: 50,
        ram_total_gb: 16,
        ram_used_gb: 8,
        gpu_usage: 40,
        vram_usage_percent: 25,
        vram_used_gb: 2,
        fps: 144
      };
      useHardwareStore.setState({ latestMetrics: metrics });
      const res = await executeTool('get_hardware_metrics', {});
      expect(JSON.parse(res)).toEqual(metrics);
    });

    it('should handle unavailable hardware metrics', async () => {
      const res = await executeTool('get_hardware_metrics', {});
      expect(res).toContain('Error: no hardware metrics telemetry available');
    });

    it('should capture screenshot silently', async () => {
      const res = await executeTool('capture_screenshot', {});
      expect(res).toBe('Success: silent screenshot captured and saved to gallery.');
      expect(mockInvoke).toHaveBeenCalledWith('capture_screenshot', undefined);
      expect(mockDbExecute).toHaveBeenCalledWith(
        'INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)',
        ['C:/Users/Desktop/screenshot.png', 'screenshot', 'Desktop']
      );
    });

    it('should search notion tasks matching query', async () => {
      const notes = [
        { id: '1', title: 'Buy milk', description: 'Grocery shopping', status: 'Not started' },
        { id: '2', title: 'Code VectorHUD', description: 'Implement tool calling', status: 'In progress' }
      ];
      useNotionStore.setState({ notes });
      const res = await executeTool('search_notion_tasks', { query: 'vectorhud' });
      const results = JSON.parse(res);
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Code VectorHUD');
    });

    it('should handle notion task search empty notes', async () => {
      const res = await executeTool('search_notion_tasks', { query: 'test' });
      expect(res).toContain('No Notion notes or tasks loaded');
    });

    it('should handle notion task search no matches', async () => {
      const notes = [
        { id: '1', title: 'Buy milk', description: 'Grocery shopping', status: 'Not started' }
      ];
      useNotionStore.setState({ notes });
      const res = await executeTool('search_notion_tasks', { query: 'nonexistent' });
      expect(res).toContain("No Notion notes found matching query 'nonexistent'");
    });

    it('should fill notion draft and merge tasks', async () => {
      useNotionStore.setState({
        draft: {
          title: 'Old Title',
          description: 'Old Desc',
          content: 'Old Content',
          tasks: ['Existing Task 1', 'Existing Task 2']
        },
        activeTab: 'notes'
      });

      const res = await executeTool('fill_notion_draft', {
        title: 'New Title',
        description: 'New Desc',
        content: 'New Content',
        tasks: ['Existing Task 1', 'New Task 3']
      });

      expect(res).toBe('Success: populated Notion draft form and selected draft tab.');
      const state = useNotionStore.getState();
      expect(state.draft.title).toBe('New Title');
      expect(state.draft.description).toBe('New Desc');
      expect(state.draft.content).toBe('New Content');
      expect(state.draft.tasks).toEqual(['Existing Task 1', 'Existing Task 2', 'New Task 3']);
      expect(state.activeTab).toBe('draft');
    });

    it('should list notion tasks with limit', async () => {
      const notes = [
        { id: '1', title: 'Task 1', description: 'Desc 1', status: 'Not started', date: '2026-06-01' },
        { id: '2', title: 'Task 2', description: 'Desc 2', status: 'In progress', date: '2026-06-02' },
        { id: '3', title: 'Task 3', description: 'Desc 3', status: 'Done', date: '2026-06-03' }
      ];
      useNotionStore.setState({ notes });
      const res = await executeTool('list_notion_tasks', { limit: 2 });
      const results = JSON.parse(res);
      expect(results.length).toBe(2);
      expect(results[0].title).toBe('Task 1');
      expect(results[1].title).toBe('Task 2');
    });

    it('should query notion database with filtering and sorting', async () => {
      const notes = [
        { id: '1', title: 'Apple', description: 'Desc A', status: 'In progress', date: '2026-06-01' },
        { id: '2', title: 'Banana', description: 'Desc B', status: 'Done', date: '2026-06-03' },
        { id: '3', title: 'Cherry', description: 'Desc C', status: 'In progress', date: '2026-06-02' }
      ];
      useNotionStore.setState({ notes });

      // Sort by title asc, filtered by status 'in progress'
      let res = await executeTool('query_notion_db', {
        status: 'In progress',
        sort_by: 'title',
        sort_order: 'asc'
      });
      let results = JSON.parse(res);
      expect(results.length).toBe(2);
      expect(results[0].title).toBe('Apple');
      expect(results[1].title).toBe('Cherry');

      // Sort by date desc
      res = await executeTool('query_notion_db', {
        sort_by: 'date',
        sort_order: 'desc'
      });
      results = JSON.parse(res);
      expect(results[0].title).toBe('Banana');
      expect(results[1].title).toBe('Cherry');
      expect(results[2].title).toBe('Apple');
    });

    it('should handle set_master_volume with volume fallback and float scalar', async () => {
      // Test volume fallback
      let res = await executeTool('set_master_volume', { volume: 60 });
      expect(res).toBe('Success: system volume set to 60%.');
      expect(mockInvoke).toHaveBeenLastCalledWith('set_master_volume', { volume: 0.6 });

      // Test float scalar conversion (0.55 -> 55)
      res = await executeTool('set_master_volume', { volume: 0.55 });
      expect(res).toBe('Success: system volume set to 55%.');
      expect(mockInvoke).toHaveBeenLastCalledWith('set_master_volume', { volume: 0.55 });

      // Test invalid volume type
      res = await executeTool('set_master_volume', { volume: 'invalid' });
      expect(res).toContain('Error');
    });
  });
});
