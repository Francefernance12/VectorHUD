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

## Session 10B: Performance & UI/UX Polish

- **Decision:** Use native Windows Performance Data Helper (PDH) C++ bindings to poll `\GPU Engine(*)\Utilization Percentage` instead of `sysinfo` or WMI.
- **Reasoning:** WMI inherently requires `CoInitializeSecurity` globally, which strictly breaks Tauri WebView2's COM threading model and crashes the app. Sysinfo lacks GPU telemetry entirely. PDH allows us to query the `engtype_3D` utilization directly from the kernel reliably and safely without breaking COM apartments.
- **Decision:** Spawn Intel's `PresentMon64.exe` as a headless background child process and parse its CSV stdout for game FPS rather than hooking ETW natively in Rust.
- **Reasoning:** Hooking Event Tracing for Windows (ETW) manually in Rust requires heavy, complex event loop subscriptions and manifest parsing. PresentMon already does this flawlessly. Piping its stdout is cheap and bypasses the need for DLL injection which triggers Anti-Cheat software.
- **Decision:** Replace Tauri's native `window.set_fullscreen(true)` API with explicit bounds calculation (`window.set_size` and `window.set_position`) using the primary monitor's geometry.
- **Reasoning:** Setting `fullscreen` on Windows 11 often causes DWM to draw the standard white titlebar overlapping the overlay, or causes the taskbar to occasionally sit on top of the overlay z-index. Explicitly sizing a borderless window (`decorations: false`) to the exact screen coordinates perfectly forces true borderless windowed mode without the DWM bugs.
- **Decision:** Shift generic hardware colors to Tailwind's global dynamic CSS variable system (`bg-accent-green`) instead of hardcoded strings like `cyan` or `rose`.
- **Reasoning:** Hardcoded string concatenation for colors in React components breaks Tailwind's JIT purging. Dynamic theme colors guarantee that hardware widget bars accurately reflect the user's selected global overlay color theme.
- **Decision:** Automatically manage the 30s replay buffer state when starting a standard manual recording.
- **Reasoning:** The `windows-record` engine uses DXGI Desktop Duplication and Media Foundation. Attempting to start two simultaneous Sink Writers on the same DXGI loop without resource sharing causes concurrency deadlocks. Pausing the replay buffer prior to standard recording prevents access violations.
- **Decision:** Apply `MFVideoTransFunc_709` transfer curve to Desktop Duplication Media Foundation input specifically for HDR screens, rather than `MFVideoTransFunc_sRGB`.
- **Reasoning:** DWM automatically tone-maps HDR desktops into SDR signals via Windows' `SDR content brightness` slider, which naturally produces overly bright and washed out frames. Telling the Video Processor MFT that the image uses a steep BT.709 curve instead of sRGB forces the encoder to pull down the shadows and midtones, safely counteracting DWM's bright SDR washout. *Note: The video may still appear slightly bright and stubborn depending on HDR peaks, and will need more advanced raw `DXGI_FORMAT_R16G16B16A16_FLOAT` pass-throughs in future implementations.*
- **Decision:** Use `sysinfo::get_current_pid()` instead of general system scans to poll VectorHUD's own hardware footprint.
- **Reasoning:** Tracking `vectorhud.exe` specifically ensures we can stream accurate `hud_cpu_usage` and `hud_ram_usage` to the frontend without polling overhead, aiding in performance debugging.

## Session 12/13: Hardening & Bug Fixes

- **Decision:** Wrap `shortcut_manager.unregister_all()` and hotkey registration inside a Rust `std::sync::Mutex`.
- **Reasoning:** React StrictMode triggers double mounting in development, sending two rapid IPC calls to update hotkeys. The `unregister_all()` call from Thread B was executing exactly as Thread A asked Windows to bind the hotkeys, randomly deleting hooks. The mutex serializes hotkey changes, preventing this race condition.
- **Decision:** Remove `shortcut_manager.register()` calls that follow `shortcut_manager.on_shortcut()`.
- **Reasoning:** In `tauri-plugin-global-shortcut` v2, calling `on_shortcut` automatically registers the hook with the OS and attaches the closure. Calling `register()` immediately after overwrites the OS hook *without* the closure, causing hotkeys to fire but do nothing in our application.
- **Decision:** Strictly guard every async Tauri `listen()` call in React `useEffect` loops with a synchronous `if (!isMounted) return;` check.
- **Reasoning:** Async listener IPC calls resolve independently of React's lifecycle. If the component unmounts before the IPC resolves, a "zombie" listener is bound to the DOM with stale closure scope.
- **Decision:** Hard-fail the application boot sequence if the SQLite database is missing its core initialized schema tables (e.g., `widget_analytics`).
- **Reasoning:** We encountered an issue where a hallucinated table name in the validation query caused silent boot failure, preventing the hydration sequence and hotkey registration. Hard-failing and enforcing an exact table count ensures the DB is healthy before React begins its lifecycle.

## Session 16: Bug Fixes & Stability

- **Decision:** Utilize a background `tokio::time::sleep` loop to periodically invoke `SetWindowPos(HWND_TOPMOST, SWP_NOACTIVATE)` instead of relying on a single initialization call.
- **Reasoning:** Windows Shell (DWM) silently demotes topmost windows when certain applications (like Opera GX) take focus, causing the taskbar to overlap the overlay. Continuously re-asserting z-order guarantees the overlay stays on top without stealing focus.
- **Decision:** Decouple `force-interactive` emissions from backend screenshot operations, handling the overlay visibility state purely in the frontend widget where context is known.
- **Reasoning:** Originally, capturing a screenshot forcefully opened the overlay for all trigger paths, which ruined the UX of the silent global screenshot hotkey. Emitting a passive "screenshot-done" path allows the frontend to decide whether to open the gallery based on the trigger origin.
- **Decision:** Replace unbounded `Vec` in `windows-record`'s `ReplayBuffer` with a `VecDeque` enforcing a strict `MAX_FRAMES` limit based on configured duration and FPS.
- **Reasoning:** An unbounded buffer causes RAM usage to match the raw frame sizes of the game being captured, resulting in severe RAM spikes (3GB+). A bounded ring buffer ensures a strict memory ceiling after the initial warmup period.
- **Decision:** Defer committing React hotkey strings until the `onKeyUp` event of a non-modifier key, enforcing a modifier presence guard.
- **Reasoning:** Committing on `onKeyDown` immediately bound the hotkey before the user finished pressing the combination, leading to accidental partial binds (e.g., binding "A" when attempting "Ctrl+A").

## Session 16.5: Architectural Shift - Media Engine

- **Decision:** Replaced the custom `windows-record` crate with a bundled, pre-compiled static `ffmpeg.exe` sidecar process.
- **Reasoning:** The `windows-record` crate (which wrapped DXGI Desktop Duplication and Media Foundation) was causing massive memory spikes (3.6GB+) due to unoptimized circular buffers and missing frames. Offloading the replay buffer to `ffmpeg` utilizing its HLS segmentation muxer natively resolves all RAM issues. Furthermore, FFmpeg provides perfect HDR-to-SDR tone-mapping via `zscale` and Hable curve filters, resolving washed-out HDR screenshots that `windows-record` couldn't properly handle.

## Session 17: Hybrid Capture Engine Architecture

- **Decision:** Shifted to a Hybrid Capture Engine: standard video recording and screenshot capture use the native Windows APIs (DXGI / Media Foundation via `windows-record` crate), while the 30-second Replay Buffer remains powered by FFmpeg HLS segmentation.
- **Reasoning:** Storing uncompressed frames in memory for the 30-second replay buffer in `windows-record` caused severe RAM spikes (3GB+). Retaining FFmpeg HLS segmentation for the replay buffer writes compressed segments to disk on-the-fly, capping memory usage at ~40MB. Conversely, screenshots and standard recordings do not require memory accumulation (standard recordings encode and stream directly to disk on-the-fly), so they can use native Windows APIs with mathematically perfect HDR-to-SDR tone-mapping, resolving color washout and brightness issues.

## Session 18: HDR scRGB CPU Reinhard Tone-Mapping

- **Decision:** Shifted HDR capture to use `IDXGIOutput5::DuplicateOutput1` with `DXGI_FORMAT_R16G16B16A16_FLOAT` and apply CPU Reinhard tone-mapping + sRGB gamma correction, reverting previous transfer function hacks.
- **Reasoning:** DXGI Desktop Duplication v1 (`DuplicateOutput1` with `DXGI_FORMAT_B8G8R8A8_UNORM`) forces DWM to perform its own SDR tone-mapping before passing pixels to our application, which corrupts color spaces based on the user's display whites. By requesting linear float16 scRGB data, we receive the raw HDR signal and can perform a mathematically correct CPU-based Reinhard tone-mapping to compress HDR -> SDR and apply sRGB gamma. This ensures screenshots and recordings look perfectly color-accurate without washout.

## Session 17: AI Chat Layout, Markdown HUD Theming & Enhanced Syntax Highlighting

- **Decision:** Prevent horizontal stretching of the AI Chat widget by adding flex layout boundaries (`min-w-0 w-fit max-w-[90%]`) on the chat bubble wrapper and `overflow-x-hidden` on the message scroll container.
- **Decision:** Implemented a custom lexical tokenizer for syntax highlighting instead of sequential regex string replacements.
- **Reasoning:** Sequential regex replacements on already-escaped HTML text are prone to collisions (e.g. matching operators inside HTML entities like `&lt;` or `&gt;`). A structured lexical tokenizer scans the code from left to right using anchored regexes first, producing a token stream. This allows for safe, collision-free syntax highlighting of operators and keywords across multiple languages (JS, TS, Python, C#, Rust, JSON, HTML, CSS, SQL, Bash).
- **Decision:** Custom-styled Markdown components (strong, em, blockquote, lists, tables) to act as visual elements of a tactical HUD, adding pulsing status dots, terminal brackets, and dashed borders.

## Session 20: Settings Customization & Accessibility Expansion

- **Decision:** Sized up the System Settings modal container to a spacious widescreen grid (`w-[920px] h-[680px]`) to accommodate an expanding suite of accessibility and customization parameters.
- **Decision:** Integrated a live, monospaced diagnostics logs panel inside the Settings modal. It invokes the Rust backend to read the tail end of the daily rolling trace file (`vectorhud.log`), keeping debugging completely local and transparent.
- **Decision:** Implemented an interactive search bar at the top of the sidebar. When active, it filters and aggregates matching options across all tabs into a unified, interactive search results list, allowing quick adjustments without navigating submenus.
- **Decision:** Built an interactive keyboard shortcut recorder. It captures `keydown` events, validates that the combo contains at least one modifier key (Ctrl, Alt, Shift, Win) or is a function key (F1-F12), and formats standard Tauri-compatible strings, protecting the user from disabling standard keys.
- **Decision:** Bound the startup toggle directly to `@tauri-apps/plugin-autostart` on the frontend, dynamically managing the Windows startup registry entries to boot VectorHUD silently on user login.

## Session 20.2: Typography, Visual Customizations & Audio Devices

- **Decision:** Implemented five granular visual appearance sliders (Border Width, Corner Radius, Border Opacity, Glow Size, and Glow Opacity) and bound them to live document CSS root variables (`document.documentElement.style.setProperty`).
- **Reasoning:** Inlining styling settings directly into CSS custom properties allows all widget frames to update dynamically in real-time as the user adjusts sliders, avoiding complex multi-component re-renders.
- **Decision:** Exposed physical audio input/output hardware device selectors, microphone volume, and muting adjustments with real-time VU meter peak signal visualizers.
- **Reasoning:** Integrating volume/mute commands directly into Tauri's backend enables high-precision controls of the system's hardware audio capture and render endpoints.
- **Decision:** Scaled up all sub-12px text labels, secondary descriptions, helper tips, and telemetry readings (previously `text-[9px]` or `text-[10px]`) to `text-xs` (12px) or `text-[11px]`.
- **Reasoning:** Extremely small font sizes degrade visual accessibility under different screen resolutions. Aligning to a minimum `text-xs` baseline ensures the Tactical Gamer's HUD remains highly readable while preserving its technical, clean appearance.


