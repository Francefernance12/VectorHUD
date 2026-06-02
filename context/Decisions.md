# Architectural & Design Decisions

This document tracks all important decisions made throughout the lifecycle of the Tactical Gamer's Overlay (VectorHUD).

## Session 1A: Foundation & Scaffolding

- **Decision:** Shift from standard `.jsx` to strict `.tsx` (TypeScript) to adhere to the project's code standards.
- **Decision:** Adopt Tailwind CSS for styling and Framer Motion for hardware-accelerated transitions.
- **Decision:** Integrate Zustand for lightweight frontend state management.
- **Decision:** Configure Tauri windows to be transparent and undecorated (`decorations: false`, `transparent: true`) to support the HUD overlay requirements.
- **Decision:** Pre-emptively add `tauri-plugin-sql` and `tauri-plugin-store` to the backend to support the defined storage model.
- **Decision:** Implement centralized logging using Rust's `tracing` ecosystem.

## Architecture Decisions

- **Decision:** Decided on SQLite for analytics and JSON for UI state to balance performance with maintainability.
- **Decision:** Decided on an Event-Driven backend pattern to save CPU cycles.

## Session 2B: Shift-Left Workflow Optimization

- **Decision:** Implemented a strict Git `pre-commit` hook via Husky to completely failproof the CI workflow. The hook locally enforces `cargo fmt --check` and `cargo clippy -D warnings` on the Rust backend prior to allowing any commits, eliminating broken GitHub Action pipelines caused by minor styling or linting violations.

## Session 4B (Re-Planned): Unified UI Over OS Windowing

- **Decision:** Abandoned multi-window Tauri spawning (e.g. `WebviewWindow` for a separate Gallery) in favor of inline React components/modals.
- **Reasoning:** Spawning secondary Tauri v2 windows drastically complicates security permissions (`capabilities/default.json` lockdown issues where plugins crash in new windows), introduces multi-monitor tracking bugs (DWM invisible borders), and degrades the single-page seamless experience.
- **Decision:** HUD components must keep all state and display logic encapsulated within the primary React DOM to guarantee cross-platform consistency.
- **Decision:** Explicitly whitelist all SQL commands (`sql:allow-execute`, `sql:allow-select`, etc.) in `capabilities/default.json` and enable `assetProtocol` with a strict scope (`$PICTUREDIR/VectorHUD/**`) in `tauri.conf.json`. Tauri v2's strict default security otherwise blocks DB querying and silently breaks `convertFileSrc` image loading.

## Session 6A: Performance & Enhancements

- **Decision:** Use Zustand's `useShallow` hook for the active widget subscriptions in the `App.tsx` container to prevent 60FPS full-DOM re-renders during widget drag events.
- **Decision:** In `metrics.rs`, avoid `System::new_all()` on boot and instead use `System::new()` followed by specific memory/cpu refresh calls to avoid scanning disks, network adapters, and peripheral devices, drastically cutting down boot time and background CPU usage.
- **Decision:** Implemented global React `ErrorBoundary` wrappers around widgets so an individual widget crashing (e.g. invalid API call) won't take down the entire HUD.

## Session 7: Hotkeys & Interactions

- **Decision:** Pinned widgets will be non-interactable when the main overlay is closed. `set_ignore_cursor_events(true)` must be enforced when the overlay backdrop is hidden to guarantee that underlying games and applications remain clickable.
- **Reasoning:** A transparent full-screen window intercepts all mouse clicks by default. Custom Windows hit-testing (HTTRANSPARENT) is difficult to implement efficiently per-widget on a unified transparent webview without degrading performance. Therefore, the user accepts that pinned widgets act as passive HUD elements unless the overlay is actively summoned via hotkey.
