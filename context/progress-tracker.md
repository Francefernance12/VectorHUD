# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase
- The Dock & Widget Menu.

## Current Goal
- Build the persistent, non-dismissible Widget Menu UI (Session 2B).

## Completed
- Session 1A: Project scaffolding and framework initialization (TypeScript, Tailwind, Framer Motion, Zustand, and Tauri Plugins).
- Session 1B: Telemetry, Logging (Implement tracing and unified Frontend/Backend logs)
- Session 1C: Persistence, Data (Configure SQLite and local settings store).
- Session 2A: Shell (UX/Windowing - Implement transparent, "Ghost" window + Global Hotkey).

## In Progress
- Session 2B: The Dock (Widget Menu - Build the persistent, non-dismissible Widget Menu UI).

## Next Up
| Session | Unit Name | Focus | Goal |
| :--- | :--- | :--- | :--- |
| 3A | Core Logic | Drag/Resize | Implement the "Dumb Container" for widget physics. |
| 3B | Pinning | State | Implement seamless, click-through overlay pinning logic. |
| 4A | System Metrics | Hardware | Rust background thread for CPU/GPU polling events. |
| 4B | Media Capture | Capture | Screenshot/Recording buffer logic + Local file storage. |
| 5A | Integration | API/AI | OpenRouter/Notion connectivity + Secure credential storage. |
| 6A | Optimization | Cleanup | Performance audit, bug squashing, and final build. |

## Open Questions
- What specific OCR library will we use for the developer quick-capture widget?
- Do we want to implement custom window shadows, or rely on the OS compositor?

## Architecture Decisions
- See [Decisions.md](./Decisions.md) for a comprehensive list of architectural and design decisions.

## Session Notes
- Use the Gemini Antigravity in standard mode for execution, and its planning mode (if available) before starting a new Git branch.