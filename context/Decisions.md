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

## Session 7B: Media Capture Engine

- **Decision:** Shift from external ffmpeg binaries to a custom `windows-record` crate that wraps DXGI Desktop Duplication and Media Foundation.
- **Reasoning:** Allows for in-memory rolling replay buffers without massive disk I/O, integrates seamlessly with Tauri, gives us full control over WASAPI loopback audio capture, and allows us to easily use `SetWindowDisplayAffinity` to exclude the overlay from capture outputs. It also enables setting exact color space matrices (BT.709) for HDR to SDR tone mapping.

## Session 8: Bug Fixes & API Quirks

- **Decision:** When dynamically setting global hotkeys in the backend, we must explicitly call `shortcut_manager.register(shortcut)` *after* binding the handler via `shortcut_manager.on_shortcut(...)`.
- **Reasoning:** The `tauri-plugin-global-shortcut` v2 API separates the closure handler attachment (`on_shortcut`) from the OS-level hook registration (`register`). Simply calling `on_shortcut` without `register` leads to silent failures where hotkeys are ignored by the OS.
- **Decision:** Ignore `already registered` errors from `tauri-plugin-global-shortcut` during global hotkey registration.
- **Reasoning:** React's StrictMode double-renders the application on boot in development. This causes two rapid IPC invocations of `update_hotkeys`. The second invocation attempts to register a hotkey that the first invocation successfully bound to the OS mere milliseconds prior, throwing a harmless "already registered" error.
- **Decision:** Defer GPU utilization metrics to PDH instead of WMI.
- **Reasoning:** WMI crate initialization calls `CoInitializeSecurity` globally, which strictly conflicts with Tauri's WebView2 COM requirements. This conflict caused `vectorhud.exe` to instantly print `Failed to unregister class Chrome_WidgetWin_0. Error = 1412` and crash the WebView renderer layer.
- **Decision:** Use raw DXGI adapters (`QueryVideoMemoryInfo`) to poll VRAM instead of WMI.
- **Reasoning:** WMI requires global security initialization (see above) and relies on outdated performance counters. DXGI provides low-level, instantaneous access to adapter video memory stats which is far more lightweight and accurate for hardware polling.

## Session 9/10: Integrations & Interactivity

- **Decision:** Utilize block-level endpoints (`/v1/blocks/{block_id}/children`) for parsing and managing interactive Notion tasks rather than the page properties endpoint.
- **Reasoning:** Notion page properties only map to top-level database columns. Rich content like paragraph notes and interactive checkboxes reside inside the internal page body block tree, necessitating block-level recursive queries and patches to support real-time to-do list manipulation within the overlay.
- **Decision:** Adopt Zustand's `persist` middleware with `localStorage` for all draft forms (Notion sync drafts, AI chat inputs, and Vision buffer thumbnails).
- **Reasoning:** The HUD overlay constantly toggles visibility (`window.hide()`), and the React environment frequently unmounts nodes when switching into "Ghost Mode" (non-interactive state) to free up memory. Utilizing `persist` guarantees that inputs effortlessly survive these aggressive unmount cycles and full Tauri developer reloads.
