# Database Schema

This document dynamically tracks the SQLite database schema (`vectorhud.db`) used for the Tactical Gamer's Overlay.
The database is managed locally via `tauri-plugin-sql` and handles persistent analytics, logs, and capture history.

## Table: `widget_analytics`
Tracks usage data for different widgets to understand which tools are used most frequently.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Unique record ID |
| `widget_name` | TEXT NOT NULL | The name/ID of the widget (e.g., 'cpu_monitor', 'quick_notes') |
| `action` | TEXT NOT NULL | What happened (e.g., 'pinned', 'unpinned', 'opened') |
| `timestamp` | DATETIME DEFAULT CURRENT_TIMESTAMP | When the action occurred |

## Table: `capture_history`
Stores metadata about screenshots and rolling buffer captures.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Unique record ID |
| `file_path` | TEXT NOT NULL | Absolute path to the media file |
| `media_type` | TEXT NOT NULL | 'image' or 'video' |
| `game_process` | TEXT | Optional: name of the game process focused during capture |
| `timestamp` | DATETIME DEFAULT CURRENT_TIMESTAMP | When the capture was saved |

## Table: `user_credentials`
Securely stores encrypted API keys and tokens for external integrations.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT PRIMARY KEY | The integration service (e.g., 'openrouter', 'notion') |
| `encrypted_value` | TEXT NOT NULL | The API key, encrypted via Rust |
| `updated_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | When the key was last saved |

## Table: `known_games`
Tracks applications that the user has explicitly flagged as games for auto-recording purposes.

| Column | Type | Description |
| :--- | :--- | :--- |
| `process_name` | TEXT PRIMARY KEY | The name of the game executable or window |
| `timestamp` | DATETIME DEFAULT CURRENT_TIMESTAMP | When the game was flagged |
