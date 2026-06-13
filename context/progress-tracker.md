# Progress Tracker

Update this file after every meaningful implementation change.

## Current Goal

- Session 17: AI Chat & Models (Fix Markdown wrapping/selection in chat bubble. Decouple history from model switches. Add Groq/Anthropic/OpenAI, custom OpenRouter IDs, and correct Gemini 2.5 Flash logs).

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
- Session 7B: Capture+ (Media - Hybrid Capture Engine. 30s rolling video buffer uses FFmpeg HLS to keep RAM footprint minimal, while screenshots and standard recordings use native DXGI/Media Foundation Windows APIs with CPU HDR tone mapping to prevent washed-out colors).
- Session 8A: Audio Hub (Mixer - Hook Core Audio API for app-specific volume, mic/output switcher, music player).
- Session 8B: Metrics+ (Hardware - GPU, VRAM, and FPS polling; Timer utility) .
- Session 9A: Integrations (AI+Notion - Vision buffer parsing, Notion block-level parsing for floating checklists).
- Session 10A: Architecture & Scaling (Notion interactive status patches, AI context drafts via Zustand persist layer).
- Session 10B: Optimization (Performance & UI/UX, Native GPU PDH, PresentMon FPS, Taskbar z-index fixes, HDR capture tone-mapping tweaks).
- Session 11: Deployment (Tauri build prep, settings endpoints updates).
- Session 12 & 13: Hardening (Code Review Sweeps: Memory leaks, hotkey handling, DB validation, race conditions).
- Session 14: Documentation Pass (Journey Retrospective, Codebase Guide).
- Session 15: Bug Fixes (Resolved compilation errors in capture.rs, expanded assetProtocol scope for OneDrive support, unified replay buffer folder output, and tweaked HDR screenshot tone-mapping values).
- Session 16: HDR Tone Mapping & Replay Buffer Fixes (Quality, Stability & Duration - Replaced xcap screenshots with `windows_record::capture_raw_frame` and utilized `IDXGIOutput5::DuplicateOutput1` to capture linear float16 scRGB data. Implemented a CPU Reinhard tone-mapping and sRGB gamma correction pass for both screenshots and recordings to prevent washed-out HDR colors, and reverted the Media Foundation transfer function hack/FFmpeg `eq` filter. Aligned GDI monitor enumeration with DXGI output indices in the replay buffer to prevent wrong monitor capture, and constrained the video encoder keyframe interval (GOP size) to 2 seconds to fix the 2-minute rolling duration bloat).
- Session 16.2: v1.1.1 Bug Fixes (Resolved countdown timer finished toast repeating on app launch, normalized Windows backslash file paths in database insertions to forward slashes to enable video loading/range requests in WebView2, and removed unused Replay Buffer Resolution/FPS settings from the settings panel).
- Session 17: AI Chat & Models (Added Groq/Anthropic/OpenAI providers and custom OpenRouter models. Implemented layout wrap rules preventing horizontal widget stretching, themed custom Markdown preview components to match HUD style, and built high-performance tokenizer-based multi-language code syntax highlighting).
- Session 17.5: UI, Capture Speed & Windowing Fixes (Disabled OS edge resize cursors, optimized screenshot window hide/show latency, separated silent hotkey from UI screenshot flows, restored interactive state on vision buffer completion, re-asserted topmost z-order once on focus gain, and logged balanced font scaling configurations).
- Session 18: App-Driven AI Actions (Implemented recursive function calling loop on the frontend enabling the chat widget to trigger master volume/mute controls, media commands, countdown timers, silent screenshot captures, Notion note queries, and CPU/GPU telemetry metrics retrieval with HUD toast notifications and database thread serialization. Hardened volume control with parameter fallbacks, decimal scaling, and direct HUD widget audio syncing; resolved elevated application mixer invisibility (Wuthering Waves) by enumerating sessions across all active endpoints and adding a kernel snapshot process name query fallback; fixed Notion draft overwrites by preserving existing title/description/content fields when adding routine tasks; fixed editing saving issues by correcting the title property key from `"Title"` to `"Name"` to align with the database schema and added a loading state to disable the save button to prevent block duplication from double clicks; guarded checklist toggles against concurrent checkbox API requests; implemented the `get_active_media_and_app` tool enabling the overlay AI to fetch the active foreground window/game process name, media playback state, and favorited audio mixer apps; implemented standard recording control (`start_video_recording`, `stop_video_recording`) with optional auto-stop duration scheduling, as well as `save_replay_clip` to save the 30-second rolling replay buffer; pinned the `time` crate dependency to `=0.3.36` in Cargo.toml to resolve the breaking E0119 conflicting implementation error; expanded test suite to 38 tests with database select mocks).
- Session 19: Voice Assistant & Voice PTT (Added microphone speech-to-text (STT) inside the AI chat input. Implemented a global PTT voice assistant triggered by holding/releasing Ctrl+Alt+V with premium listening, transcribing, and thinking overlays, custom brevity prompt injection, and a wireframed floating Voice Response overlay card with progress countdown and auto-dismiss. Resolved the Tokio runtime event-loop panic by switching to runtime handle spawning. Fixed overlay focus loss behaviour so that clicking on a second monitor closes the overlay rather than leaving it visible and non-interactive, and disabled toggling interactivity via hotkey when the overlay is open).

## In Progress

- None

## Next Up

| Session | Unit Name | Focus | Goal |
| :--- | :--- | :--- | :--- |
| **Session 20** | Settings & Mixer Hardening | Hardening | Fix dropdown blinking. Build keybind combo listener. Sync dock glow border themes. Enumerate audio mixer sessions across all endpoints to capture elevated games (Wuthering Waves). Resolve PresentMon64 warning / execution locking issue. Add specific timer start inputs. |
| **Session 21** | Discord Webhook Integration | API | Implement Discord Webhook configuration and gallery share button to upload screenshots/clips directly to Discord. |

## Architecture Decisions

- See [Decisions.md](./Decisions.md) for a comprehensive list of architectural and design decisions.

## Session Notes

- Use the Gemini Antigravity in standard mode for execution, and its planning mode (if available) before starting a new Git branch.
