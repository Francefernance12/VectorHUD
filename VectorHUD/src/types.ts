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

/**
 * Extracts a displayable error message from an unknown caught value.
 * Avoids the need for `catch (err: any)` throughout the codebase.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}
