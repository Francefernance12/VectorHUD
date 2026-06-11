# Progress Tracker

Update this file after every meaningful implementation change.

## Current Goal

- Session 19: Documentation & Verification Audit (Check consistency of all context, README, and agent docs against the codebase).

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
- Session 8B: Metrics+ (Hardware - GPU, VRAM, and FPS polling; Timer utility).
- Session 9A: Integrations (AI+Notion - Vision buffer parsing, Notion block-level parsing for floating checklists).
- Session 10A: Architecture & Scaling (Notion interactive status patches, AI context drafts via Zustand persist layer).
- Session 10B: Optimization (Performance & UI/UX, Native GPU PDH, PresentMon FPS, Taskbar z-index fixes, HDR capture tone-mapping tweaks).
- Session 11: Deployment (Tauri build prep, settings endpoints updates).
- Session 12 & 13: Hardening (Code Review Sweeps: Memory leaks, hotkey handling, DB validation, race conditions).
- Session 14: Documentation Pass (Journey Retrospective, Codebase Guide).
- Session 15: Bug Fixes (Resolved compilation errors in capture.rs, expanded assetProtocol scope for OneDrive support, unified replay buffer folder output, and tweaked HDR screenshot tone-mapping values).
- Session 16: HDR Tone Mapping & Replay Buffer Fixes (Quality, Stability & Duration - Replaced xcap screenshots with `windows_record::capture_raw_frame` and utilized `IDXGIOutput5::DuplicateOutput1` to capture linear float16 scRGB data. Implemented a CPU Reinhard tone-mapping and sRGB gamma correction pass for both screenshots and recordings to prevent washed-out HDR colors, and reverted the Media Foundation transfer function hack/FFmpeg `eq` filter. Aligned GDI monitor enumeration with DXGI output indices in the replay buffer to prevent wrong monitor capture, and constrained the video encoder keyframe interval (GOP size) to 2 seconds to fix the 2-minute rolling duration bloat).
- Session 16.1: Clippy Warnings & CI Fixes (Cleaned up all 6 clippy warnings across audio_capture.rs, capture.rs, ffmpeg_manager.rs, and record.rs. Fixed local target directory locking issues by terminating PresentMon64 background processes before checking. Unblocked CI workflow compilation).
- Session 16.2: v1.1.1 Bug Fixes (Resolved countdown timer finished toast repeating on app launch, normalized Windows backslash file paths in database insertions to forward slashes to enable video loading/range requests in WebView2, and removed unused Replay Buffer Resolution/FPS settings from the settings panel).
- Session 16.3: v1.1.2 Video Playback CSP Fix (Resolved video playback loading issue in production builds by adding the `media-src` directive to the CSP configuration in `tauri.conf.json`, allowing the WebView to play files served via Tauri's custom asset protocol).

## In Progress

- None


## Next Up

| Session | Unit Name | Focus | Goal |
| :--- | :--- | :--- | :--- |
| **Session 20** | AI Chat & Models | AI/UX | Fix Markdown wrapping/selection in chat bubble. Decouple history from model switches. Add Groq/Anthropic/OpenAI, custom OpenRouter IDs, and correct Gemini 2.5 Flash logs. |
| **Session 21** | App-Driven AI Actions | AI/Tools | Implement Function Calling for LLM to interact with widgets (volume, playback, hardware metrics, timer start, Notion DB search, auto capture) under tight token limits. |
| **Session 22** | Voice Assistant & Voice PTT | Voice/UX | Add mic speech-to-text to input. Implement `Ctrl+Alt+V` global Push-to-Talk (PTT) voice assistant that records on hold and transcribes/submits on release with HUD toast popups. |
| **Session 23** | Settings & Mixer Hardening | Hardening | Fix dropdown blinking. Build keybind combo listener. Sync dock glow border themes. Enumerate audio mixer sessions across all endpoints to capture elevated games (Wuthering Waves). Add specific timer start inputs. |
| **Session 24** | Discord Webhook Integration | API | Implement Discord Webhook configuration and gallery share button to upload screenshots/clips directly to Discord. |

## Architecture Decisions

- See [Decisions.md](./Decisions.md) for a comprehensive list of architectural and design decisions.

## Session Notes

- Use the Gemini Antigravity in standard mode for execution, and its planning mode (if available) before starting a new Git branch.
