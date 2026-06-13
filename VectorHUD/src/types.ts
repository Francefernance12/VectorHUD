/**
 * Shared type definitions for VectorHUD frontend.
 * Centralized here to avoid duplicate interfaces across widgets.
 */

/** API keys returned from the Rust backend `get_api_keys` command. */
export interface ApiKeys {
  openrouter?: string;
  notion_token?: string;
  notion_db_id?: string;
}

/** A single row from the SQLite `capture_history` table. */
export interface CaptureHistory {
  id: number;
  file_path: string;
  media_type: string;
  game_process?: string;
  timestamp: string;
}

import { sanitizeError } from './utils/logger';

/**
 * Extracts a displayable error message from an unknown caught value and sanitizes it.
 * Avoids the need for `catch (err: any)` throughout the codebase.
 */
export function getErrorMessage(error: unknown): string {
  let message = '';
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = String(error);
  }
  return sanitizeError(message);
}
