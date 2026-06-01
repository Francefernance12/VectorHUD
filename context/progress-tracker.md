# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase
- Hardening, Security, and Settings (Session 6).

## Current Goal
- Ready for Session 6B (Settings Menu & API Configuration UI).

## Completed
- Session 1A: Project scaffolding and framework initialization.
- Session 1B: Telemetry, Logging.
- Session 1C: Persistence, Data.
- Session 2A: Shell (UX/Windowing - Transparent Ghost window + Global Hotkey).
- Session 2B: The Dock (Widget Menu UI).
- Session 3A: Core Logic (Drag/Resize - Implement the "Dumb Container" for widget physics).
- Session 3B: Pinning (State - Implement seamless, click-through overlay pinning logic).
- Session 4A: System Metrics (Hardware - Rust background thread for CPU/GPU polling events).
- Session 4B: Media Capture (Capture - Screenshot logic + Local file storage + Unified Inline Gallery + SQLite capability fixes).
- Session 5A: Integration (API/AI - OpenRouter connectivity, Notion syncing, credential handling logic).
- Session 6A: Enhancement (Performance - Zustand `useShallow` re-render fix, `sysinfo` targeted booting, React Error boundaries, Autostart).

## In Progress
- N/A

## Next Up
| Session | Unit Name | Focus | Goal |
| :--- | :--- | :--- | :--- |
| 6B | Settings | UI & Auth | Build a settings modal to input API keys and store them securely via Rust. |

## Open Questions
- What specific OCR library will we use for the developer quick-capture widget?
- Do we want to implement custom window shadows, or rely on the OS compositor?

## Architecture Decisions
- See [Decisions.md](./Decisions.md) for a comprehensive list of architectural and design decisions.

## Session Notes
- Use the Gemini Antigravity in standard mode for execution, and its planning mode (if available) before starting a new Git branch.