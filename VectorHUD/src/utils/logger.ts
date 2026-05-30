import { invoke } from "@tauri-apps/api/core";

/**
 * Standardized logger for VectorHUD frontend.
 * Forwards logs directly to the Rust backend to be centralized
 * in a single rotating log file.
 */
export const logger = {
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
    try {
      await invoke("frontend_log", { level: "error", message });
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
