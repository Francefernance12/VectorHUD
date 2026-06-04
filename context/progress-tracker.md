# Progress Tracker

Update this file after every meaningful implementation change.

## Current Goal

- Develop Session 11: Polish (Stability & Final UI Polish)

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
- Session 6B: Settings (UI & Auth) - Building a settings modal and secure Rust-based credential storage.
- Session 7A: UI Polish (Expandable dock, pin toggles (interactable), custom scrollbars).
- Session 7B: Capture+ (Media - 30s rolling video buffer, standard recording, mic toggling, windows-record forked to fix focus tracking limitations, fixed HDR washout and sound mixing deadlocks).
- Session 8A: Audio Hub (Mixer - Hook Core Audio API for app-specific volume, mic/output switcher, music player).
- Session 8B: Metrics+ (Hardware - GPU, VRAM, and FPS polling; Timer utility).
- Session 9A: Integrations (AI+Notion - Vision buffer parsing, Notion block-level parsing for floating checklists).
- Session 10A: Architecture & Scaling (Notion interactive status patches, AI context drafts via Zustand persist layer).
- Session 10B: Optimization (Performance & UI/UX, Native GPU PDH, PresentMon FPS, Taskbar z-index fixes, HDR capture tone-mapping tweaks).
- Session 11: Deployment (Tauri build prep, settings endpoints updates).
- Session 12 & 13: Hardening (Code Review Sweeps: Memory leaks, hotkey handling, DB validation, race conditions).
- Session 14: Documentation Pass (Journey Retrospective, Codebase Guide).

## In Progress

- Session 15: Deployment & Installer Creation (WiX / NSIS).

## Next Up

| Session | Unit Name | Focus     | Goal                                                             |
| :------ | :-------- | :-------- | :--------------------------------------------------------------- |
| 15 | Deployment | Setup | Finalize Tauri `.msi` and `.exe` build flags and create installer. |

## Architecture Decisions

- See [Decisions.md](./Decisions.md) for a comprehensive list of architectural and design decisions.

## Session Notes

- Use the Gemini Antigravity in standard mode for execution, and its planning mode (if available) before starting a new Git branch.
