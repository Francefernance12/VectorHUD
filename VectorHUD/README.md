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

## 📦 Auto-Updater & Release Dataflow

VectorHUD utilizes a fully functional, secure auto-update pipeline built on Tauri's `@tauri-apps/plugin-updater`. 

### How The Update Pipeline Works
1. **The Check**: When the user clicks "Download & Install" in the Settings menu, VectorHUD pings the GitHub Releases endpoint: `https://github.com/Francefernance12/VectorHUD/releases/latest/download/latest.json`.
2. **Version Comparison**: The updater compares the `"version"` field in `latest.json` against the currently installed app version (from `tauri.conf.json`). If `latest.json` is higher, an update is triggered.
3. **Signature Verification**: VectorHUD securely verifies the update file using Ed25519 signatures. The app checks the downloaded executable against the signature provided inside `latest.json`, using the **Public Key** embedded in `tauri.conf.json`.
4. **Execution**: If the signature perfectly matches, the app downloads the `.exe` and automatically spawns the Windows installer wizard to upgrade the user's installation seamlessly.

### Creating a New Release
When creating a new version of VectorHUD, you must follow these precise steps to satisfy the secure signature checks:

1. **Bump Versions**: Update `"version"` in both `tauri.conf.json` and `package.json` to your new version (e.g., `1.0.1`).
2. **Set Private Key Environment Variables**: Before building, you must expose your secret key to Tauri:
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw -Path "updater.key"
   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
   ```
3. **Build the Release**: Run `npm run tauri build`. Tauri will compile the `.exe` and automatically generate a `.sig` file using your private key.
4. **Update `latest.json`**:
   - Open `versions/<version>/latest.json`.
   - Update the `"version"` field to the new version.
   - Update the `"url"` to point to the new `.exe` name in your next GitHub Release.
   - **Crucial**: Copy the exact signature text from your newly generated `.sig` file and paste it into the `"signature"` field in `latest.json`.
5. **Publish to GitHub**: Create a new GitHub Release matching your new version tag. Upload **both** the new `.exe` installer and your updated `latest.json` file.
