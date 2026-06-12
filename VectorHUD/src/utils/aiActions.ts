import { invoke } from '@tauri-apps/api/core';
import { useTimerStore } from '../store/timerStore';
import { useHardwareStore } from '../store/hardwareStore';
import { useNotionStore } from '../store/notionStore';
import { useShellStore } from '../store/shellStore';
import { getDb } from './db';
import { logger } from './logger';

export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "set_master_volume",
      description: "Set the system master volume (0 to 100).",
      parameters: {
        type: "object",
        properties: {
          volume_percent: {
            type: "integer",
            description: "The target volume level from 0 (muted) to 100 (maximum).",
            minimum: 0,
            maximum: 100
          }
        },
        required: ["volume_percent"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_master_mute",
      description: "Toggle system master mute state.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "media_control",
      description: "Control media playback (play/pause, next track, or previous track).",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            enum: ["play_pause", "next", "prev"],
            description: "The playback control command to execute."
          }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "start_timer",
      description: "Start a countdown timer with a specific duration.",
      parameters: {
        type: "object",
        properties: {
          duration_seconds: {
            type: "integer",
            description: "The duration of the timer in seconds (e.g. 300 for 5 minutes).",
            minimum: 1
          }
        },
        required: ["duration_seconds"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reset_timer",
      description: "Reset the countdown timer.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_hardware_metrics",
      description: "Retrieve latest system performance metrics (CPU, RAM, GPU, VRAM, and game FPS).",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "capture_screenshot",
      description: "Perform a silent screenshot of the primary monitor.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_notion_tasks",
      description: "Search for specific entries, notes, or tasks in the synced Notion database.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Text query to search titles or descriptions."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "control_stopwatch",
      description: "Control the system stopwatch (start, pause, or reset).",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            enum: ["start", "pause", "reset"],
            description: "The stopwatch control command to execute."
          }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "fill_notion_draft",
      description: "Populate the Notion database draft fields in the local overlay widget. Useful for OCR/vision transcription or form filling.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The title of the note or task."
          },
          description: {
            type: "string",
            description: "A short description or summary."
          },
          content: {
            type: "string",
            description: "The main body content or detailed notes."
          },
          tasks: {
            type: "array",
            items: { type: "string" },
            description: "A checklist of routine tasks/sub-routines."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_notion_tasks",
      description: "List the latest notes or tasks currently loaded in the Notion database.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "integer",
            description: "Maximum number of database rows to return (default: 10).",
            minimum: 1
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_notion_db",
      description: "Advanced querying, filtering, and sorting of the synced Notion database tasks.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional text query to filter by matching titles or descriptions."
          },
          status: {
            type: "string",
            description: "Optional status value to filter by (e.g. 'Not started', 'In progress', 'Done')."
          },
          sort_by: {
            type: "string",
            enum: ["date", "title", "status"],
            description: "Property to sort the results by."
          },
          sort_order: {
            type: "string",
            enum: ["asc", "desc"],
            description: "Direction of sorting (default: 'desc')."
          },
          limit: {
            type: "integer",
            description: "Maximum number of results to return (default: 10).",
            minimum: 1
          }
        }
      }
    }
  }
];

export function getAnthropicTools() {
  return AI_TOOLS.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters
  }));
}

export async function executeTool(name: string, args: any): Promise<string> {
  try {
    switch (name) {
      case 'set_master_volume': {
        const volInput = args.volume_percent !== undefined ? args.volume_percent : args.volume;
        let vol = Number(volInput);
        if (isNaN(vol)) {
          return "Error: volume must be a number between 0 and 100.";
        }
        // If LLM passed a float scalar between 0.0 and 1.0 (e.g., 0.5), scale to percentage (50%)
        if (vol > 0 && vol <= 1.0 && !Number.isInteger(vol)) {
          vol = Math.round(vol * 100);
        }
        if (vol < 0 || vol > 100) {
          return "Error: volume must be between 0 and 100.";
        }
        await invoke('set_master_volume', { volume: vol / 100 });
        window.dispatchEvent(new Event('refresh-audio-state'));
        return `Success: system volume set to ${vol}%.`;
      }
      case 'toggle_master_mute': {
        await invoke('toggle_master_mute');
        window.dispatchEvent(new Event('refresh-audio-state'));
        return "Success: toggled master system mute state.";
      }
      case 'media_control': {
        const cmd = args.command;
        if (cmd === 'play_pause') {
          await invoke('media_play_pause');
        } else if (cmd === 'next') {
          await invoke('media_next');
        } else if (cmd === 'prev') {
          await invoke('media_prev');
        } else {
          return `Error: unsupported media command '${cmd}'.`;
        }
        return `Success: media command '${cmd}' executed.`;
      }
      case 'start_timer': {
        const sec = Number(args.duration_seconds);
        if (isNaN(sec) || sec <= 0) {
          return "Error: duration must be greater than 0.";
        }
        useTimerStore.getState().setCdInput(sec);
        useTimerStore.getState().startCd();
        return `Success: started countdown timer for ${sec} seconds.`;
      }
      case 'reset_timer': {
        useTimerStore.getState().resetCd();
        return "Success: reset countdown timer.";
      }
      case 'control_stopwatch': {
        const cmd = args.command;
        if (cmd === 'start') {
          useTimerStore.getState().startSw();
        } else if (cmd === 'pause') {
          useTimerStore.getState().pauseSw();
        } else if (cmd === 'reset') {
          useTimerStore.getState().resetSw();
        } else {
          return `Error: unsupported stopwatch command '${cmd}'.`;
        }
        return `Success: stopwatch command '${cmd}' executed.`;
      }
      case 'get_hardware_metrics': {
        const metrics = useHardwareStore.getState().latestMetrics;
        if (!metrics) {
          return "Error: no hardware metrics telemetry available yet. Ask user to ensure the hardware widget is active or wait a moment.";
        }
        return JSON.stringify(metrics);
      }
      case 'capture_screenshot': {
        try {
          useShellStore.getState().setIgnoreFocusLoss(true);
          const path = await invoke<string>('capture_screenshot');
          const normalizedPath = path.replace(/\\/g, '/');
          const db = await getDb();
          await db.execute(
            'INSERT INTO capture_history (file_path, media_type, game_process) VALUES (?1, ?2, ?3)',
            [normalizedPath, 'screenshot', 'Desktop']
          );
          window.dispatchEvent(new Event('refresh-capture-history'));
        } finally {
          setTimeout(() => {
            useShellStore.getState().setIgnoreFocusLoss(false);
          }, 300);
        }
        return "Success: silent screenshot captured and saved to gallery.";
      }
      case 'search_notion_tasks': {
        const query = String(args.query || '').toLowerCase();
        const notes = await ensureNotionNotesLoaded();
        if (notes.length === 0) {
          return "No Notion notes or tasks loaded in database. Ask user to fetch notes first.";
        }
        const filtered = notes.filter(note => 
          note.title?.toLowerCase().includes(query) || 
          note.description?.toLowerCase().includes(query)
        );
        if (filtered.length === 0) {
          return `No Notion notes found matching query '${query}'.`;
        }
        return JSON.stringify(filtered.map(n => ({ id: n.id, title: n.title, description: n.description, status: n.status })));
      }
      case 'fill_notion_draft': {
        const title = args.title !== undefined ? String(args.title) : "";
        const description = args.description !== undefined ? String(args.description) : "";
        const content = args.content !== undefined ? String(args.content) : "";
        
        let tasks = useNotionStore.getState().draft.tasks;
        if (args.tasks !== undefined) {
          const newTasks = Array.isArray(args.tasks) ? args.tasks.map((t: any) => String(t).trim()).filter(Boolean) : [String(args.tasks).trim()];
          const existingTasks = tasks.map(t => t.trim()).filter(Boolean);
          
          // Merge preserving order, ignoring duplicates case-insensitively
          const merged = [...existingTasks];
          for (const nt of newTasks) {
            if (!merged.some(et => et.toLowerCase() === nt.toLowerCase())) {
              merged.push(nt);
            }
          }
          tasks = merged.length > 0 ? merged : [''];
        }
        
        useNotionStore.getState().updateDraft({ title, description, content, tasks });
        useNotionStore.getState().setActiveTab('draft');
        return "Success: populated Notion draft form and selected draft tab.";
      }
      case 'list_notion_tasks': {
        const limit = Number(args.limit || 10);
        const notes = await ensureNotionNotesLoaded();
        if (notes.length === 0) {
          return "No Notion notes or tasks loaded in database. Ask user to fetch notes first.";
        }
        const limited = notes.slice(0, limit);
        return JSON.stringify(limited.map(n => ({ id: n.id, title: n.title, description: n.description, status: n.status, date: n.date })));
      }
      case 'query_notion_db': {
        const query = String(args.query || '').toLowerCase();
        const status = args.status ? String(args.status).toLowerCase() : null;
        const sort_by = args.sort_by || 'date';
        const sort_order = args.sort_order || 'desc';
        const limit = Number(args.limit || 10);

        let notes = await ensureNotionNotesLoaded();
        if (notes.length === 0) {
          return "No Notion notes or tasks loaded in database. Ask user to fetch notes first.";
        }

        let filtered = notes;
        if (query) {
          filtered = filtered.filter(note => 
            (note.title?.toLowerCase().includes(query)) || 
            (note.description?.toLowerCase().includes(query))
          );
        }
        if (status) {
          filtered = filtered.filter(note => note.status?.toLowerCase() === status);
        }

        filtered.sort((a, b) => {
          let valA: any = '';
          let valB: any = '';

          if (sort_by === 'date') {
            valA = a.date ? new Date(a.date).getTime() : 0;
            valB = b.date ? new Date(b.date).getTime() : 0;
          } else if (sort_by === 'title') {
            valA = (a.title || '').toLowerCase();
            valB = (b.title || '').toLowerCase();
          } else if (sort_by === 'status') {
            valA = (a.status || '').toLowerCase();
            valB = (b.status || '').toLowerCase();
          }

          if (valA < valB) return sort_order === 'asc' ? -1 : 1;
          if (valA > valB) return sort_order === 'asc' ? 1 : -1;
          return 0;
        });

        const limited = filtered.slice(0, limit);
        return JSON.stringify(limited.map(n => ({ id: n.id, title: n.title, description: n.description, status: n.status, date: n.date })));
      }
      default:
        return `Error: unknown tool function '${name}'.`;
    }
  } catch (err: any) {
    return `Error executing tool '${name}': ${err?.message || String(err)}`;
  }
}

async function ensureNotionNotesLoaded(): Promise<any[]> {
  const currentNotes = useNotionStore.getState().notes || [];
  if (currentNotes.length > 0) {
    return currentNotes;
  }

  try {
    const db = await getDb();
    const secretRes = await db.select<{ encrypted_value: string }[]>("SELECT encrypted_value FROM user_credentials WHERE id = 'notion_secret'");
    const dbIdRes = await db.select<{ encrypted_value: string }[]>("SELECT encrypted_value FROM user_credentials WHERE id = 'notion_db_id'");

    if (secretRes.length > 0 && dbIdRes.length > 0) {
      const token = await invoke<string>('decrypt_data', { encoded: secretRes[0].encrypted_value });
      const dbId = await invoke<string>('decrypt_data', { encoded: dbIdRes[0].encrypted_value });
      if (token && dbId) {
        await invoke('ensure_notion_schema', { token, dbId }).catch(() => {});
        const fetchedNotes = await invoke<any[]>('fetch_notion_notes', { token, dbId });
        useNotionStore.getState().setNotes(fetchedNotes);
        return fetchedNotes;
      }
    }
  } catch (err) {
    logger.error(`Failed to auto-fetch Notion database: ${err}`);
  }
  return [];
}
