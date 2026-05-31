# Progress Tracker

Update this file after every meaningful implementation change.

## Current Phase
- Core Logic & Widget Physics.

## Current Goal
- Rust background thread for CPU/GPU polling events (Session 4A).

## Completed
- Session 1A: Project scaffolding and framework initialization.
- Session 1B: Telemetry, Logging.
- Session 1C: Persistence, Data.
- Session 2A: Shell (UX/Windowing - Transparent Ghost window + Global Hotkey).
- Session 2B: The Dock (Widget Menu UI).
- Session 3A: Core Logic (Drag/Resize - Implement the "Dumb Container" for widget physics).
- Session 3B: Pinning (State - Implement seamless, click-through overlay pinning logic).

## In Progress
- Session 4A: System Metrics (Hardware - Rust background thread for CPU/GPU polling events).

## Next Up
| Session | Unit Name | Focus | Goal |
| :--- | :--- | :--- | :--- |
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