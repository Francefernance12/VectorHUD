import { invoke } from "@tauri-apps/api/core";

const ERROR_BACKLOG_KEY = 'vectorhud_crash_backlog';

/**
 * Standardized logger for VectorHUD frontend.
 * Forwards logs directly to the Rust backend to be centralized
 * in a single rotating log file.
 */
export const logger = {
  flushCrashBacklog: async () => {
    const backlog = localStorage.getItem(ERROR_BACKLOG_KEY);
    if (backlog) {
      try {
        const errors: string[] = JSON.parse(backlog);
        if (errors.length > 0) {
          console.warn("Flushing lingering crash logs from previous session...");
          for (const err of errors) {
            await invoke("frontend_log", { level: "error", message: `[CRASH RECOVERY] ${err}` });
          }
        }
        localStorage.removeItem(ERROR_BACKLOG_KEY);
      } catch (e) {
        console.error("Failed to parse error backlog", e);
        localStorage.removeItem(ERROR_BACKLOG_KEY);
      }
    }
  },

  info: async (message: string) => {
    console.info(message);
    try {
      await invoke("frontend_log", { level: "info", message });
    } catch (e) {
      console.error("Failed to forward log to backend", e);
    }
  },
  warn: async (message: string) => {
    console.warn(message);
    try {
      await invoke("frontend_log", { level: "warn", message });
    } catch (e) {
      console.error("Failed to forward log to backend", e);
    }
  },
  error: async (message: string) => {
    console.error(message);
    
    // Synchronous write to guarantee we don't lose the error if the window immediately dies
    try {
      const current = localStorage.getItem(ERROR_BACKLOG_KEY);
      const queue = current ? JSON.parse(current) : [];
      queue.push(message);
      localStorage.setItem(ERROR_BACKLOG_KEY, JSON.stringify(queue));
    } catch (e) {
      // Ignore local storage errors if quota is full
    }

    try {
      await invoke("frontend_log", { level: "error", message });
      
      // If it succeeded, we can clear this specific message from the queue
      try {
        const current = localStorage.getItem(ERROR_BACKLOG_KEY);
        if (current) {
          let queue: string[] = JSON.parse(current);
          queue = queue.filter(m => m !== message);
          if (queue.length === 0) {
            localStorage.removeItem(ERROR_BACKLOG_KEY);
          } else {
            localStorage.setItem(ERROR_BACKLOG_KEY, JSON.stringify(queue));
          }
        }
      } catch (e) {}
    } catch (e) {
      console.error("Failed to forward log to backend", e);
    }
  },
  debug: async (message: string) => {
    console.debug(message);
    try {
      await invoke("frontend_log", { level: "debug", message });
    } catch (e) {
      console.error("Failed to forward log to backend", e);
    }
  },
};

