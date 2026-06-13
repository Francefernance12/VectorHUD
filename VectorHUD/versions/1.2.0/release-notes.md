# VectorHUD v1.2.0 🚀

This release introduces major UI/UX improvements, full-stack optimizations, and security updates:

## Key Features & Enhancements

### 1. Settings Hotkey Categorization
- Organized all global keyboard shortcut settings into 4 logically grouped HUD-style cards: *Core Overlay & System*, *Media Capture*, *Timers & Utility*, and *Voice Assistant PTT*.

### 2. Operational Manual Tab
- Added a new **Tutorial & Guide** tab in settings showing summon shortcuts, detailed widget descriptions, and tips (such as running as Administrator for CPU temperatures).

### 3. Resizable AI Chat Sessions Sidebar
- Swapped the fixed sidebar for a mouse-draggable resizable layout. You can drag the vertical separator strip to dynamically size the session sidebar between 160px and 400px.

### 4. Code Health, Safety & Performance
- Replaced Rust `.unwrap()` invocations on Mutex locks with safe lock recovery (`.unwrap_or_else`) to prevent crash loops from poisoned threads.
- Shifted speech-to-text transcription requests from React to a secure backend API (`transcribe_audio_api`) to keep credentials safe from browser exposure.
- Standardized TypeScript with strict types and catch-unknown blocks, removing trailing `any` interfaces.
- Added automatic API key token redaction from errors written to daily log files or shown in UI notifications.
- Clamped telemetry polling intervals to prevent CPU hogging.
- Updated the update verification `pubkey` in `tauri.conf.json` to match the local signing key, resolving build warnings.
