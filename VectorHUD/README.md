# VectorHUD 🚀

**VectorHUD** is an ultra-lightweight, click-through desktop overlay designed for PC gamers and developers. It uses a high-performance Rust backend to stay completely invisible in the background with near-zero performance overhead, only revealing its beautiful Glassmorphism React UI when summoned.

## ✨ Key Features

- **Instant Global Invocation**: Summon and dismiss the overlay instantly without minimizing your active borderless-fullscreen games.
- **"Ghost Mode" Pinning**: Drag and drop your favorite widgets anywhere on the screen and pin them. They become permanently click-through, remaining visible even when the main overlay is closed!
- **Zero-Conflict Hardware Metrics**: Real-time CPU, RAM, and true GPU polling powered by native C++ PDH kernel bindings—completely bypassing standard WMI COM conflicts.
- **Built-in Capture Engine**: Snap screenshots or maintain a rolling 30-second video replay buffer using our custom `windows-record` integration.
- **Productivity & AI Integrations**: Seamlessly draft Notion to-do lists and interface with OpenRouter AI directly from the overlay.
- **Silent Boot & Centralized Logging**: Boots silently to the system tray and tracks all internal diagnostics locally via SQLite and centralized rolling log files.
- **Auto-Updater**: Features an automated release system that fetches the latest version directly from GitHub releases via Tauri's Updater plugin.

## ⌨️ Default Hotkeys

- **`Ctrl + Alt + O`**: Toggle Master Dock Overlay
- **`Ctrl + Alt + Shift + C`**: Toggle Click-Through (Ghost Mode) for all active widgets
- **`Ctrl + Alt + P`**: Snap Screenshot (Saves to `Videos/Captures`)
- **`Ctrl + Alt + R`**: Save Replay Buffer (Last 30 seconds of gameplay)

## 🛠️ Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- Windows 10/11 (Required for Desktop Duplication API capture features)

### Running Locally
```bash
# Install dependencies
npm install

# Run the app in development mode
npm run tauri dev
```

### Building for Production
```bash
npm run tauri build
```
*Note: Building requires configuring your `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in your environment variables if the updater is enabled.*

## 📦 Release Workflow

VectorHUD utilizes a manual GitHub Release system combined with a `latest.json` endpoint to deliver updates to users via Tauri's `@tauri-apps/plugin-updater`.
When creating a new release, make sure to bump the version in `tauri.conf.json` and `package.json`, build the project, and upload the resulting `.msi` and `.sig` along with an updated `latest.json` to the GitHub release.
