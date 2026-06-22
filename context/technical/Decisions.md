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



## Session 21: Code Optimization & Hardening

- **Decision:** Rely on duration-based trimming for the 30-second rolling replay buffer. Bounding by duration naturally constrains memory usage and avoids continuous GPU/RAM inspection overhead, which is the most optimal approach.
- **Decision:** Shifted transcription API requests to the backend (`transcribe_audio_api`) to keep API keys secure and enforce clean architectural boundaries.
- **Decision:** Standardized on strict types instead of `any`, including typing all caught errors as `unknown` and using a central sanitizing error utility.
- **Decision:** Implemented client-side API key redaction in logging/toasts via `sanitizeError`.
- **Decision:** Clamped Hardware Metrics Polling Rate to a safe `1000`–`10000` ms range.

## Session 21B: UI/UX Enhancements

- **Decision:** Categorized the global keyboard shortcut recorder inputs into logical, border-bounded HUD cards (Overlay System, Media Capture, Timers & Utility, Voice Assistant PTT).
- **Reasoning:** Listing 9 raw inputs in a single list cluttered the Settings tab; grouping them improves cognitive load and visual structure.
- **Decision:** Built a scrolling monospaced Operational Manual tab directly into the Settings modal displaying summon keybinds, widget mechanics, and AMD/Intel CPU temperature administrative workarounds.
- **Reasoning:** Provides new users with built-in onboarding instructions without leaving the offline HUD context.
- **Decision:** Implemented custom mouse-dragging event listeners on `mousemove` and `mouseup` to calculate sidebar resize deltas, binding width directly to styling properties within a strict 160px-400px threshold.
- **Reasoning:** Replacing the fixed 256px class with a dynamic styling property allows custom viewport customization while preserving the main chat flexbox container bounds.

## Session 22: Documentation Refactoring & Community Onboarding

- **Decision:** Consolidated duplicate `README.md` files by merging the `VectorHUD/README.md` detailing developer setup, auto-updater flows, and keybinds into a single root `README.md`.
- **Reasoning:** Maintaining two README files in a single-application repository creates high risk of documentation drift. A single root README simplifies user and developer onboarding.
- **Decision:** Restructured the `docs/` folder by creating `docs/guides/` and `docs/code_reviews/` subdirectories.
- **Reasoning:** Developers were presented with a cluttered root `docs` directory filled with historical review drafts and core reference guides. Grouping them by concern improves scannability.
- **Decision:** Restructured the `context/` folder by creating three subdirectories: `context/project/`, `context/technical/`, and `context/standards/` (Option B).
- **Reasoning:** Grouping the 10 internal context files by category (project planning, technical configuration/decisions, and coding/UI standards) keeps files logically separate and easier to expand, preventing filesystem bloat.
- **Decision:** Added standard open-source community templates (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `SUPPORT.md`) at the repository root.
- **Reasoning:** Establishes professional open-source standards and provides clear paths for users to seek help or report issues.
- **Decision:** Updated developer documentation to accurately reflect the hybrid capture engine (FFmpeg HLS for replays, `windows-record` for manual recordings/screenshots) and backend API mediation (`call_ai_api`).
- **Reasoning:** Ensures that documentation aligns with actual implementations, preventing developer confusion.
- **Decision:** Pinned `alloc-stdlib = "=0.2.2"` and `brotli-decompressor = "=5.0.1"` in `VectorHUD/src-tauri/Cargo.toml`.
- **Reasoning:** Upstream updates to `alloc-stdlib v0.2.3` and `brotli-decompressor v5.0.2` shifted their dependency to `alloc-no-stdlib v3.0.0`. This introduced a type mismatch compilation conflict in `brotli v8.0.3` (used by Tauri for asset compression) which expects the traits from `alloc-no-stdlib v2`. Forcing these transitive dependencies to use the v2-compatible versions resolves the collision and stabilizes builds.

## Session 23: Media Compatibility

- **Decision:** Implemented a silent GDI-based screen capture fallback (`capture_raw_frame_gdi` using Win32 GDI `BitBlt` and cursor overlay) when DXGI Desktop Duplication fails (e.g. with `DXGI_ERROR_UNSUPPORTED` `0x887A0004` on dual-GPU laptops or virtualized drivers).
- **Reasoning:** DXGI Desktop Duplication fails on certain laptops or hardware configurations. Providing a GDI fallback ensures screenshots can still be taken seamlessly without crashing the UI.
- **Decision:** Exposed **Capture Mode** (Auto vs Software/GDI) and **Video Encoder** (NVIDIA NVENC, AMD AMF, Intel QSV, Software libx264) selections in the Media Capture tab inside Settings.
- **Reasoning:** Standardizing on NVIDIA encoders breaks compatibility on laptops with integrated Intel/AMD GPUs. Exposing these settings gives users direct control over their capture pipeline.
- **Decision:** Supported standard video recording fallback to FFmpeg `gdigrab` on DXGI/hardware encoder failure, utilizing fragmented MP4 `-movflags frag_keyframe+empty_moov` to prevent file corruption.
- **Reasoning:** Keeps standard recording robust on hardware where the native Media Foundation pipeline is unsupported.
- **Decision:** Downgrade the SMTC "success but no data" warnings in `media_control.rs` from `WARN` to `DEBUG`.
- **Reasoning:** Minimizes log pollution during periods when no active SMTC media session is transmitting valid metadata.
- **Decision:** Probe DXGI support on application boot. If unsupported, automatically configure settings to Software/GDI mode & CPU encoder and toast alert the user.
- **Reasoning:** Ensures immediate out-of-the-box compatibility on non-DXGI-supporting laptops.
- **Decision:** Removed the nested `max-h-[180px]` scroll area from `AudioHubWidget`'s App Mixer session list in favor of utilizing the parent widget's scrollbar.
- **Reasoning:** Having dual/nested scrollbars degrades user experience and clips sessions unnecessarily. Allowing layout reflow within the parent container simplifies interaction.
- **Decision:** Repositioned the `HardwareWidget` CPU temp tooltip to be relative to the outer CPU section wrapper rather than the inline help text span, and expanded its width.
- **Reasoning:** Inline absolute tooltips get clipped by the parent widget's `overflow-hidden` bounds. Aligning it to the full-width parent row allows the tooltip to float downwards without clipping.
- **Decision:** Converted `SettingsModal` hotkey display and recording fields to stack vertically (`flex-col`) rather than horizontally.
- **Reasoning:** Stacking prevents the Record and Clear buttons from squishing the keybind display when global typography is scaled to large sizes.
- **Decision:** Developed a frontend unit test suite utilizing Vitest and `@testing-library/react` to mock Tauri's IPC triggers (`invoke` and `listen`).
- **Reasoning:** Allows full UI component testing (Hardware, Audio, Timer, Dummy widgets) in non-Windows environments and CI pipelines without native API dependencies.
- **Decision:** Bumped version to `1.2.2` (via v1.2.1 and v1.2.2 test releases) to release layout fixes, automated test suite, and verify key rotation auto-updater compatibility.

## Session 24: Controller & Bluetooth Management Widget

- **Decision:** Used `hidapi` for raw HID device polling rather than the Gamepad API or DirectInput.
- **Reasoning:** The browser Gamepad API only sees controllers already visible to the OS. When HidHide is active, it hides the physical device from all processes except those whitelisted. `hidapi` can be whitelisted by HidHide and read the raw HID reports directly, enabling us to perform the mapping ourselves rather than relying on DirectInput's built-in (and often wrong) mapping.
- **Decision:** Used `vigem-client` (Rust wrapper over ViGEmBus) to create virtual Xbox 360 gamepads rather than virtual DualShock or other types.
- **Reasoning:** Xbox 360 gamepad emulation via ViGEmBus is the most broadly compatible virtual controller type. Steam, all major games, and xinput.dll all prefer XInput (Xbox) controllers natively. Creating a virtual DS4 or Switch controller would require additional game-specific configuration.
- **Decision:** Used `HidHideCLI.exe` (command-line interface) rather than the `Nefarius.Drivers.HidHide` .NET managed library.
- **Reasoning:** The .NET managed library requires a .NET runtime that is not bundled with VectorHUD. `HidHideCLI.exe` is already distributed by the HidHide installer and is always present if HidHide is installed, keeping our integration dependency-free.
- **Decision:** Implemented the Failproof Reconnect cycle as: HidHide device hide → cloak refresh → `pnputil /restart-device` (PnP restart) → 500ms sleep → virtual re-plug signal.
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



## Session 21: Code Optimization & Hardening

- **Decision:** Rely on duration-based trimming for the 30-second rolling replay buffer. Bounding by duration naturally constrains memory usage and avoids continuous GPU/RAM inspection overhead, which is the most optimal approach.
- **Decision:** Shifted transcription API requests to the backend (`transcribe_audio_api`) to keep API keys secure and enforce clean architectural boundaries.
- **Decision:** Standardized on strict types instead of `any`, including typing all caught errors as `unknown` and using a central sanitizing error utility.
- **Decision:** Implemented client-side API key redaction in logging/toasts via `sanitizeError`.
- **Decision:** Clamped Hardware Metrics Polling Rate to a safe `1000`–`10000` ms range.

## Session 21B: UI/UX Enhancements

- **Decision:** Categorized the global keyboard shortcut recorder inputs into logical, border-bounded HUD cards (Overlay System, Media Capture, Timers & Utility, Voice Assistant PTT).
- **Reasoning:** Listing 9 raw inputs in a single list cluttered the Settings tab; grouping them improves cognitive load and visual structure.
- **Decision:** Built a scrolling monospaced Operational Manual tab directly into the Settings modal displaying summon keybinds, widget mechanics, and AMD/Intel CPU temperature administrative workarounds.
- **Reasoning:** Provides new users with built-in onboarding instructions without leaving the offline HUD context.
- **Decision:** Implemented custom mouse-dragging event listeners on `mousemove` and `mouseup` to calculate sidebar resize deltas, binding width directly to styling properties within a strict 160px-400px threshold.
- **Reasoning:** Replacing the fixed 256px class with a dynamic styling property allows custom viewport customization while preserving the main chat flexbox container bounds.

## Session 22: Documentation Refactoring & Community Onboarding

- **Decision:** Consolidated duplicate `README.md` files by merging the `VectorHUD/README.md` detailing developer setup, auto-updater flows, and keybinds into a single root `README.md`.
- **Reasoning:** Maintaining two README files in a single-application repository creates high risk of documentation drift. A single root README simplifies user and developer onboarding.
- **Decision:** Restructured the `docs/` folder by creating `docs/guides/` and `docs/code_reviews/` subdirectories.
- **Reasoning:** Developers were presented with a cluttered root `docs` directory filled with historical review drafts and core reference guides. Grouping them by concern improves scannability.
- **Decision:** Restructured the `context/` folder by creating three subdirectories: `context/project/`, `context/technical/`, and `context/standards/` (Option B).
- **Reasoning:** Grouping the 10 internal context files by category (project planning, technical configuration/decisions, and coding/UI standards) keeps files logically separate and easier to expand, preventing filesystem bloat.
- **Decision:** Added standard open-source community templates (`CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `SUPPORT.md`) at the repository root.
- **Reasoning:** Establishes professional open-source standards and provides clear paths for users to seek help or report issues.
- **Decision:** Updated developer documentation to accurately reflect the hybrid capture engine (FFmpeg HLS for replays, `windows-record` for manual recordings/screenshots) and backend API mediation (`call_ai_api`).
- **Reasoning:** Ensures that documentation aligns with actual implementations, preventing developer confusion.
- **Decision:** Pinned `alloc-stdlib = "=0.2.2"` and `brotli-decompressor = "=5.0.1"` in `VectorHUD/src-tauri/Cargo.toml`.
- **Reasoning:** Upstream updates to `alloc-stdlib v0.2.3` and `brotli-decompressor v5.0.2` shifted their dependency to `alloc-no-stdlib v3.0.0`. This introduced a type mismatch compilation conflict in `brotli v8.0.3` (used by Tauri for asset compression) which expects the traits from `alloc-no-stdlib v2`. Forcing these transitive dependencies to use the v2-compatible versions resolves the collision and stabilizes builds.

## Session 23: Media Compatibility

- **Decision:** Implemented a silent GDI-based screen capture fallback (`capture_raw_frame_gdi` using Win32 GDI `BitBlt` and cursor overlay) when DXGI Desktop Duplication fails (e.g. with `DXGI_ERROR_UNSUPPORTED` `0x887A0004` on dual-GPU laptops or virtualized drivers).
- **Reasoning:** DXGI Desktop Duplication fails on certain laptops or hardware configurations. Providing a GDI fallback ensures screenshots can still be taken seamlessly without crashing the UI.
- **Decision:** Exposed **Capture Mode** (Auto vs Software/GDI) and **Video Encoder** (NVIDIA NVENC, AMD AMF, Intel QSV, Software libx264) selections in the Media Capture tab inside Settings.
- **Reasoning:** Standardizing on NVIDIA encoders breaks compatibility on laptops with integrated Intel/AMD GPUs. Exposing these settings gives users direct control over their capture pipeline.
- **Decision:** Supported standard video recording fallback to FFmpeg `gdigrab` on DXGI/hardware encoder failure, utilizing fragmented MP4 `-movflags frag_keyframe+empty_moov` to prevent file corruption.
- **Reasoning:** Keeps standard recording robust on hardware where the native Media Foundation pipeline is unsupported.
- **Decision:** Downgrade the SMTC "success but no data" warnings in `media_control.rs` from `WARN` to `DEBUG`.
- **Reasoning:** Minimizes log pollution during periods when no active SMTC media session is transmitting valid metadata.
- **Decision:** Probe DXGI support on application boot. If unsupported, automatically configure settings to Software/GDI mode & CPU encoder and toast alert the user.
- **Reasoning:** Ensures immediate out-of-the-box compatibility on non-DXGI-supporting laptops.
- **Decision:** Removed the nested `max-h-[180px]` scroll area from `AudioHubWidget`'s App Mixer session list in favor of utilizing the parent widget's scrollbar.
- **Reasoning:** Having dual/nested scrollbars degrades user experience and clips sessions unnecessarily. Allowing layout reflow within the parent container simplifies interaction.
- **Decision:** Repositioned the `HardwareWidget` CPU temp tooltip to be relative to the outer CPU section wrapper rather than the inline help text span, and expanded its width.
- **Reasoning:** Inline absolute tooltips get clipped by the parent widget's `overflow-hidden` bounds. Aligning it to the full-width parent row allows the tooltip to float downwards without clipping.
- **Decision:** Converted `SettingsModal` hotkey display and recording fields to stack vertically (`flex-col`) rather than horizontally.
- **Reasoning:** Stacking prevents the Record and Clear buttons from squishing the keybind display when global typography is scaled to large sizes.
- **Decision:** Developed a frontend unit test suite utilizing Vitest and `@testing-library/react` to mock Tauri's IPC triggers (`invoke` and `listen`).
- **Reasoning:** Allows full UI component testing (Hardware, Audio, Timer, Dummy widgets) in non-Windows environments and CI pipelines without native API dependencies.
- **Decision:** Bumped version to `1.2.2` (via v1.2.1 and v1.2.2 test releases) to release layout fixes, automated test suite, and verify key rotation auto-updater compatibility.

## Session 24: Controller & Bluetooth Management Widget

- **Decision:** Used `hidapi` for raw HID device polling rather than the Gamepad API or DirectInput.
- **Reasoning:** The browser Gamepad API only sees controllers already visible to the OS. When HidHide is active, it hides the physical device from all processes except those whitelisted. `hidapi` can be whitelisted by HidHide and read the raw HID reports directly, enabling us to perform the mapping ourselves rather than relying on DirectInput's built-in (and often wrong) mapping.
- **Decision:** Used `vigem-client` (Rust wrapper over ViGEmBus) to create virtual Xbox 360 gamepads rather than virtual DualShock or other types.
- **Reasoning:** Xbox 360 gamepad emulation via ViGEmBus is the most broadly compatible virtual controller type. Steam, all major games, and xinput.dll all prefer XInput (Xbox) controllers natively. Creating a virtual DS4 or Switch controller would require additional game-specific configuration.
- **Decision:** Used `HidHideCLI.exe` (command-line interface) rather than the `Nefarius.Drivers.HidHide` .NET managed library.
- **Reasoning:** The .NET managed library requires a .NET runtime that is not bundled with VectorHUD. `HidHideCLI.exe` is already distributed by the HidHide installer and is always present if HidHide is installed, keeping our integration dependency-free.
- **Decision:** Implemented the Failproof Reconnect cycle as: HidHide device hide → cloak refresh → `pnputil /restart-device` (PnP restart) → 500ms sleep → virtual re-plug signal.
- **Reasoning:** Bluetooth reconnects assign new Device Instance IDs. Without a PnP restart, Steam and games hold stale uncloaked handles from the previous session. `pnputil /restart-device` forces Windows to revoke all open handles to that device path and re-enumerate it cleanly behind HidHide, eliminating the double-input scenario.
- **Decision:** Exposed both an automatic reconnect watcher (background loop) and a manual "Fix Double Input" button on the frontend.
- **Reasoning:** The auto-watcher handles the common case, but edge cases (e.g., controller was connected before VectorHUD launched, or pnputil elevation failed silently) benefit from a manual trigger the user can press at any time without restarting anything.
- **Decision:** Used `btleplug` for BLE scanning and GATT battery reads, and limited battery reporting to BLE devices in v1 (Classic BT devices are listed but shown without battery).
- **Reasoning:** Classic Bluetooth battery levels require per-device vendor-specific HFP/HSP profile commands or Win32 `SetupDiGetDeviceProperty` with `DEVPKEY_Device_BatteryLevel`, which is not universally available across all device classes. BLE's standard GATT Battery Service (0x180F / 0x2A19) is universally readable and provides accurate battery data without device-specific protocol handling.
- **Decision:** Used `HidApi::new()` once per polling iteration (instead of `HidApi::refresh_devices()`) to get a fresh device enumeration.
- **Reasoning:** The `hidapi` crate's `HidApi` struct does not implement `Clone`, and its `refresh_devices()` method is only available in some versions. Creating a fresh instance each 500ms poll is cheap compared to the I/O involved in refreshing and guarantees a completely up-to-date device list.
- **Decision:** Enumerated Classic Bluetooth devices by invoking `pnputil /enum-devices /class Bluetooth /connected` and parsing parent device nodes (IDs starting with `BTHENUM\Dev_`).
- **Reasoning:** Avoids loading heavy, complex Win32/COM platform APIs or additional external dependencies, ensuring a highly performant and secure query that integrates cleanly with our merged BLE/Classic list.
- **Decision:** Switched Classic Bluetooth scanning to run a custom piped PowerShell query querying `DEVPKEY_Device_DevNodeStatus` and filtering out devices containing the `DN_DEVICE_DISCONNECTED` (`0x02000000`) flag.
- **Reasoning:** Paired-but-offline classic devices remain registered in Windows PnP tree as connected, which caused `pnputil` connected query to list them as active. Inspecting the bitmask of the DevNodeStatus property provides accurate real-time active link status.
- **Decision:** Programmatic HID interface path parsing to Device Instance IDs via `hid_path_to_instance_id`.
- **Reasoning:** `HidHideCLI.exe` does not accept raw interface paths (`\\?\hid#...`). Converting them to standard Device Instance IDs (`HID\VID_...`) allows programmatically whitelisting/cloaking controllers accurately.
- **Decision:** Enable both manual hiding toggling and automatic hiding upon Xbox Emulation activation.
- **Reasoning:** Hiding the physical controller prevents double-input issues. Automating hiding on emulation activation streamlines user UX, while manual toggling provides an explicit workaround option if needed.
- **Decision:** Correct controller button offsets (Stadia Y button, LB/RB swap, DualShock 4 face buttons Triangle/Cross/Circle/Square) and invert thumbstick Y-axes.
- **Reasoning:** Standard gamepads utilize different offsets and orientations than XInput standard; correcting these mappings ensures controllers act correctly and consistently.

- **Decision:** Execute the PowerShell device query script via direct CLI argument (`-Command "<script>"`) instead of piping stdin (`-Command -`).
  - **Reasoning:** Stdin piping (`-Command -`) intermittently fails under Tauri's subprocess environment on Windows, resulting in empty stdout and silent scanning failures. Direct string command arguments are evaluated reliably by the OS.
- **Decision:** Filter classic Bluetooth parent devices by restricting the PowerShell query to instance IDs matching `BTHLE\DEV_*` and `BTHENUM\DEV_*`.
  - **Reasoning:** A general `*Dev_*` query captures various GATT profile sub-records, polluting the device list. Restricting to these patterns accurately isolates only the parent physical Bluetooth devices.
- **Decision:** Propagate HidHide CLI command execution errors (`Result<(), String>`) back to the Tauri commands and frontend instead of ignoring them.
  - **Reasoning:** Programmatic HidHide commands require Administrator privileges to read/write the HidHide driver configuration. When the app runs without elevation, the command fails with `Access is denied (0x0005)`. Returning the CLI error allows the frontend to show a descriptive toast warning (asking the user to run VectorHUD as Administrator) and prevents the "Hide Physical" toggle from silently flipping back off.
- **Decision:** Swap the Stadia report Options and Home button mappings, map the R3 stick click to its correct bitmask location in `buttons_byte1`, and map stick Y-axes using non-inverting `map_u8_axis_to_i16`.
  - **Reasoning:** Fixes wrong Guide/Back button assignments, enables the right stick click, and resolves inverted stick directions (where moving up went down).
- **Decision:** Dynamically render the Stadia Assistant (`AST`) and Capture (`CAP`) buttons in the SVG visualizer based on active controller support, and render them as dashed wireframe placeholders when offline.
  - **Reasoning:** Prevents displaying unsupported buttons on controllers that don't have them (like DualShock 4) while preserving their technical, clean HUD aesthetic as design placeholders when no controller is connected.

## Session 24.2: Controller Bug Fixes & UX Polish

- **Decision:** Canonicalize HidHide instance ID comparison using a new `canonicalize_hid_id` helper mapping all paths and instance IDs before comparison.
  - **Reasoning:** HidHideCLI output and raw HID device paths are formatted differently (e.g. `\\?\HID#...` vs `HID\VID_...`). Performing string comparisons directly led to mismatches where active hidden devices were not detected, causing the "Hide Physical" toggle in the frontend to tick back off immediately despite the device being successfully hidden in the driver.
- **Decision:** Implement a 5-attempt retry loop on physical HID device path opening within the background emulation loop.
  - **Reasoning:** When the HidHide cloak is toggled, the filter driver restarts or refreshes target device configurations, which causes a brief period (100-300ms) of transient access conflicts or blocking. Adding a retry loop allows the driver cloak to settle, preventing first-time emulation initiation failures and ensuring that the emulation toggle remains persistent and robust.
- **Decision:** Auto-upgrade saved widget dimensions to the new defaults inside `setInitialState` in `widgetStore.ts`.
  - **Reasoning:** Sizing up the Controller widget default dimensions to 380x580 to accommodate the expanded telemetry Tester UI would otherwise be ignored for existing users because the saved JSON store state overrides definitions. Upgrading smaller dimensions automatically on boot ensures everyone gets the layout improvements.
- **Decision:** Translate "Access is denied" / `0x0005` errors into user-friendly diagnostic messages on the frontend.
  - **Reasoning:** Tells the user exactly how to resolve the error (by closing conflicting HidHide GUI tools or running VectorHUD as Administrator) rather than showing a generic error code.

## Session 24.5: Controller Test Inputs & Focus Fixes

- **Decision:** Implement direct Windows XInput API polling (via the native `windows` crate `Win32_UI_Input_XboxController` API) in the background `spawn_gilrs_watcher` loop.
  - **Reasoning:** On Windows, `gilrs` relies on RawInput (`WM_INPUT`) messages sent to its hidden window. Since the background thread has no focused GUI window, OS raw input events are intercepted/routed to the main thread's WebView2 window, causing `gilrs` to receive no events for Xbox controllers. XInput bypasses window message pumps completely and allows direct, lightweight querying of Xbox controllers on any thread regardless of focus.
- **Decision:** Add `vendor_id` and `product_id` to `ControllerTestState` in both backend (Rust) and frontend (TypeScript) and match them on the frontend `activeController` using VID/PID.
  - **Reasoning:** When a gamepad is enumerated by both `hidapi` (under its Windows instance ID path) and `gilrs` (under a generic index like `gilrs-0`), the backend merges them and de-duplicates by VID/PID, keeping only the `hidapi` version. This causes the test event's `"gilrs-0"` ID to not match the `hidapi` ID in the frontend. Adding VID/PID fields allows the frontend to correctly map test inputs to the active controller entry.
- **Decision:** Ignore virtual controller events in the frontend's `controller-test-state` listener by checking if `hasActiveEmulation` is true and only accepting events whose `controller_id` matches the physical emulating controller's `id` or `path`.
  - **Reasoning:** Since `gilrs` runs in the background and does not have direct access to the actual hardware VID/PID of virtual XInput devices under XInput, it can report the virtual controller's vendor and product ID as `0` or `None`, which bypasses the previous vendor ID based check (`0x045E`/`0x028E`). Checking that the event is from the active physical emulating controller completely filters out all mirrored virtual/XInput events, preventing the Tester tab title label from rapidly switching/flickering.

## Session 25: UI/UX, Technical and Documentation Enhancements

- **Decision:** Implemented a collapsible and expandable Dock with Framer Motion and a grid-layout Widget Library popover.
  - **Reasoning:** As the number of widgets increases, a fixed-size dock takes up too much screen real estate and makes layout positioning cramped. Transitioning to a collapsible dock with a popover widget library allows the overlay to stay clean and extensible.
- **Decision:** Implemented active monitor tracking for Toast Notifications and coordinate positioning relative to the cursor position.
  - **Reasoning:** A transparent overlay spanning multiple monitors coordinates relative to the absolute virtual screen space. By fetching the monitor containing the cursor physical coordinates, we can position the Dock, Voice assistant PTT cards, and Toasts dynamically on the screen the user is actively interacting with, keeping notifications visible.
- **Decision:** Redesigned the Settings Hotkey Recorder to show modifier keys (`Ctrl`, `Alt`, `Shift`, `Win`) in real-time, show the "Current" hotkey in a badge next to the label, and allow cancelling with the `Escape` key.
  - **Reasoning:** The previous hotkey settings had limited horizontal space and showed `...` for longer key combinations. Moving the recorded inputs to a full-width vertical layout and using visual badges makes keyboard mapping intuitive and prevents layout squishing.
- **Decision:** Added color-coded diagnostics logging and a "Copy Logs" button in the Settings Diagnostics panel.
  - **Reasoning:** Color-coding log severities (Red for errors, Yellow for warnings, Green for successes, Blue/Cyan for telemetry) makes logs easily scannable, and copying the log contents to the clipboard simplifies community support and troubleshooting.
- **Decision:** Added global shortcut mute slots (`Ctrl+Alt+1` through `Ctrl+Alt+0`) mapping to active audio mixer sessions dynamically.
  - **Reasoning:** Instead of static hardcoded app volume toggles, tracking the sorted volume sessions in real-time allows users to mute and unmute active audio streams using slot numbers shown next to each session.

## Session 26: Optimization & Offline Compatibility

- **Decision:** Demote high-frequency `Gilrs watcher event` logs from `INFO` to `TRACE` and `Gilrs watcher loop alive` checks to `DEBUG`.
  - **Reasoning:** Analog stick movements poll every 10ms and generated over 200,000 log lines a day (~43MB per day), causing excessive disk writes and diagnostic logs clutter. Demoting them ensures they are ignored under the default `INFO` logging filter, reducing log size to less than 1MB.
- **Decision:** Isolate the `btleplug` BLE scanner loop into a dedicated MTA OS thread initialized with `COINIT_MULTITHREADED`, communicating results via a `tokio::sync::oneshot` channel.
  - **Reasoning:** Windows Runtime Bluetooth APIs require COM MTA. Spawning them on worker threads from Tauri's async runtime resulted in thread mode collisions (`0x80010106` "Cannot change thread mode after it is set") because those threads had already been initialized in single-threaded apartment (STA) mode. Spawning a fresh dedicated OS thread avoids COM apartment conflicts and guarantees BLE battery scanning functions correctly.
- **Decision:** Track network state (`online`/`offline`) dynamically in the frontend and guard all network-dependent commands (OpenRouter AI and Notion Sync) with `navigator.onLine` checks.
  - **Reasoning:** Disconnecting the internet previously triggered unhandled network promise rejections or Edge WebView2 connection failed error frames. Blocking these actions and displaying clean offline status badges prevents WebView failures.
- **Decision:** Redesign the Notion widget to automatically disable `INITIATE_SYNC` and transform the `Save Local` button into a full-width `SAVE_LOCAL_ONLY` primary button when offline.
  - **Reasoning:** Encourages the user to save notes locally without showing frustrating network error prompts, returning to a normal sync flow once connection is restored.
- **Decision:** Guard the Tauri silent update check `check()` to run only when `navigator.onLine` is true.
  - **Reasoning:** Prevents logging false-alarm network connection timeout errors in the local roll-log database on boot when the device is simply offline.
- **Decision:** Implement thread-safe caching and serialization locks on Bluetooth scans (caching for 10 seconds), and execute classic Bluetooth PowerShell scans asynchronously using `tokio::process::Command` wrapped in a 10-second `tokio::time::timeout`.
  - **Reasoning:** In Windows, executing shell commands synchronously blocks tokio threads. If the frontend triggers scans repeatedly (e.g. on mount/unmount or during refreshes), it could spawn multiple concurrent PowerShell processes, leading to process duplication, window focus issues (the powershell command windows popping up or duplicating), and CPU/memory overhead. Implementing a 10-second cache and using an async tokio command with a timeout guarantees that only one scan runs at a time and any hanging process is automatically killed without blocking the system or duplicating processes.

