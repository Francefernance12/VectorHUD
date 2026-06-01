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

## Table: `user_credentials` (Planned for Session 6B)
Securely stores encrypted API keys and tokens for external integrations.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER PRIMARY KEY AUTOINCREMENT | Unique record ID |
| `service` | TEXT NOT NULL UNIQUE | The integration service (e.g., 'openrouter', 'notion') |
| `encrypted_token` | TEXT NOT NULL | The API key, encrypted via Rust using the Machine ID |
| `updated_at` | DATETIME DEFAULT CURRENT_TIMESTAMP | When the key was last saved |
