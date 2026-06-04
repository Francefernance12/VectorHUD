# Architecture Context

## Stack
| Layer | Technology | Role |
| --- | --- | --- |
| Framework | Tauri 2.0 | Application container and OS bridge. |
| UI | React + TypeScript + Tailwind | Rendering the Tactical/HUD widgets. |
| Backend | Rust | System APIs, logging, and heavy lifting. |
| Database | SQLite (`tauri-plugin-sql`) | Analytics, persistent structured data. |
| Telemetry | PresentMon64 (Sidecar) | Headless background process for game FPS tracing via ETW. |
| Key-Value | `tauri-plugin-store` | Fast UI settings and widget coordinates. |
| Logging | `tracing` (Rust) | Centralized, rolling file logs. |

## System Boundaries
- `src-tauri/src/commands/` — Rust functions exposed to the React frontend.
- `src-tauri/src/core/` — OS-level hooks (audio, hotkeys, capture).
- `src/components/widgets/` — Individual React widget UI components.
- `src/components/layout/` — The "Dumb Container" that handles drag, drop, and pinning physics.
- `src/store/` — Zustand state management for frontend synchronization.

## Storage Model
- **SQLite (.db file)**: Session analytics, historical hardware data, structured developer logs.
- **JSON Store (.json file)**: Widget X/Y coordinates, active/pinned states, user preferences.
- **Secure Enclave**: API Keys (OpenRouter, Notion) stored using OS native credential manager or encrypted store via Tauri.

## Invariants
1. The frontend must never poll the backend heavily; the backend must emit events to the frontend when data changes.
2. All errors in React must be caught and forwarded to the Rust `tracing` logger.
3. No external API calls are made without explicit user opt-in.
4. The overlay must never steal focus from the primary active window when pinned widgets are clicked-through.