# VectorHUD 🚀
**The Tactical Gamer's Overlay**

VectorHUD is a hyper-lightweight, transparent, globally-summoned desktop overlay built for PC gamers and developers. Powered by a high-performance Rust backend and a Glassmorphism React frontend, it floats seamlessly over borderless-fullscreen games and applications. It remains completely invisible in the background until invoked, ensuring near-zero performance overhead while you game.

---

## 🎮 For Users

### Key Features
- **Zero-Friction Invocation**: Press `Ctrl + Alt + O` from anywhere, inside any borderless-fullscreen game, to instantly summon or dismiss the Master Dock.
- **Ghost Mode & Pinning**: Drag your favorite widgets anywhere on the screen and pin them. They become permanently visible and click-through, remaining active even when the overlay is dismissed!
- **Zero-Conflict Hardware Metrics**: Real-time CPU, RAM, and true GPU polling powered by native Windows Performance Data Helper (PDH) and NVIDIA SMI kernel bindings. No bloated background scanners!
- **Hybrid Capture Engine**: 
  - **Replay Buffer**: Maintain a rolling 30-second video replay buffer powered by a background `ffmpeg.exe` sidecar process using HTTP Live Streaming (HLS) segmentation to write compressed `.ts` slices to disk, capping RAM usage at a constant ~40MB.
  - **Screenshots & Standard Video**: Snap HDR screenshots and start/stop manual video recordings on-the-fly using native Windows DXGI Desktop Duplication and Media Foundation APIs in our custom `windows-record` integration. Applies a high-quality CPU-based Reinhard tone mapping and sRGB gamma correction to prevent washed-out colors on HDR displays.
- **Audio Hub**: Hook directly into the Core Audio API to manage per-application volume, monitor microphone peak levels with a real-time VU meter, and switch hardware input/output devices.
- **AI Assistant**: Stream responses from OpenRouter, OpenAI, Anthropic, or Groq with support for recursive function-calling (enabling the AI to trigger screenshots, set volume, control media, start timers, and check telemetry). Supports Base64/file path vision parsing of captured frames.
- **Notion Quick-Capture**: Synchronize paragraph notes and interactive floating checkboxes directly to a target Notion database using block-level page body APIs.
- **Privacy First**: All session analytics, API credentials, and settings are stored strictly in local SQLite and JSON files. No cloud sync, no tracking.

### Default Hotkeys
- **`Ctrl + Alt + O`**: Toggle Master Dock Overlay
- **`Ctrl + Alt + S`**: Snap Screenshot (Saves to `Pictures/VectorHUD`)
- **`Ctrl + Alt + R`**: Start/Stop Video Recording (Saves to `Pictures/VectorHUD`)
- **`Ctrl + Alt + B`**: Save Replay Buffer (Last 30 seconds of gameplay)
- **`Ctrl + Alt + T`**: Toggle Countdown Timer
- **`Ctrl + Alt + W`**: Toggle Stopwatch Status
- **`Ctrl + Alt + Y`**: Reset Active Timer/Stopwatch
- **`Ctrl + Alt + V`**: Hold/Release Voice Assistant PTT (Push-To-Talk)
- **`Ctrl + Alt + I`**: Toggle Overlay Interactivity (Mouse click-through mode)

### Installation
1. Navigate to the **[Releases](https://github.com/Francefernance12/VectorHUD/releases)** page on GitHub.
2. Download the latest `vectorhud_x64-setup.exe` or `.msi` installer.
3. Run the installer. *(Note: Windows SmartScreen may flag it. Click "More Info" -> "Run Anyway".)*
4. VectorHUD will boot silently to your System Tray. Press `Ctrl + Alt + O` to open the overlay!

---

## 💻 For Developers

VectorHUD is an ambitious project pushing the boundaries of what the Tauri 2.0 framework can achieve on Windows. It requires deep synchronization between asynchronous React lifecycles and highly threaded Rust OS hooks.

### Technology Stack
- **Framework:** Tauri v2 (Rust backend container + OS bindings)
- **Frontend:** React + TypeScript + Tailwind CSS + Framer Motion
- **State Management:** Zustand (with `useShallow` for 60FPS drag rendering)
- **Database:** SQLite (`tauri-plugin-sql`) for analytics and history
- **Preferences:** Key-value stores (`tauri-plugin-store`)
- **Telemetry:** PresentMon64 (sidecar), DXGI float16 scRGB duplication, Windows PDH API

### High-Level Architecture
1. **The Dumb Container:** Widgets rely entirely on Zustand for state. Drag, drop, and resizing logic is handled by a unified physics container (`WidgetContainer.tsx`). Individual widgets are purely presentational.
2. **Event-Driven Rust:** The React frontend rarely polls the backend. Instead, Rust runs efficient background threads that `emit` events (like hardware metrics or hotkeys) to the frontend.
3. **Strict Threading & Safety:** OS-level hooks are guarded by `std::sync::Mutex` in Rust to protect against React StrictMode's rapid double-mounting behavior, utilizing `unwrap_or_else` to handle poisoned mutexes gracefully.
4. **Backend API Mediation:** To respect Content Security Policies (CSP) and keep credentials secure, all external API calls (Notion, OpenRouter, Groq, etc.) are routed through the secure backend command `call_ai_api` rather than fetch calls inside React.

### Development Setup

#### Prerequisites
- Node.js (v18+)
- Rust (latest stable)
- Build Tools for Visual Studio 2022 (C++ workload for native Windows crates)

#### Running Locally
```bash
# 1. Clone the repository
git clone https://github.com/Francefernance12/VectorHUD.git
cd VectorHUD/VectorHUD

# 2. Install Node dependencies
npm install

# 3. Start the Vite/Tauri development server
npm run tauri dev
```

*Note: In development mode, the Rust backend logs directly to a rolling file, NOT the console. To view backend logs, inspect `C:\Users\<User>\AppData\Roaming\com.fernando-arias.vectorhud\logs\vectorhud.log` or open Settings -> Diagnostics inside the app.*

#### Building for Production
To package the final `.exe` and `.msi` installers:
```bash
npm run tauri build
```
Compiled installers will be located in `src-tauri/target/release/bundle/`.

---

## 📦 Auto-Updater & Release Dataflow

VectorHUD utilizes a fully functional, secure auto-update pipeline built on Tauri's `@tauri-apps/plugin-updater`.

### How The Update Pipeline Works
1. **The Check**: When the user clicks "Download & Install" in the Settings menu, VectorHUD pings the GitHub Releases endpoint: `https://github.com/Francefernance12/VectorHUD/releases/latest/download/latest.json`.
2. **Version Comparison**: The updater compares the `"version"` field in `latest.json` against the currently installed app version (from `tauri.conf.json`). If `latest.json` is higher, an update is triggered.
3. **Signature Verification**: VectorHUD securely verifies the update file using Ed25519 signatures. The app checks the downloaded executable against the signature provided inside `latest.json`, using the **Public Key** embedded in `tauri.conf.json`.
4. **Execution**: If the signature perfectly matches, the app downloads the `.exe` and automatically spawns the Windows installer wizard to upgrade the user's installation seamlessly.

### Creating a New Release
When creating a new version of VectorHUD, you must follow these precise steps to satisfy the secure signature checks:

1. **Bump Versions**: Update `"version"` in both `tauri.conf.json` and `package.json` to your new version (e.g., `1.2.0`).
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

---

## 📁 Repository Structure

For a complete understanding of the system logic, decisions, and codebase workflows:
- `docs/guides/codebase_guide.md`: A complete onboarding guide to building new widgets and understanding state.
- `docs/guides/ai_actions.md`: A guide detailing the AI assistant's system capabilities, tool parameters, and prompt examples.
- `docs/guides/journey_and_lessons.md`: A deep dive into the architectural battles and bug-fixes we faced during development.
- `docs/code_reviews/`: Contains comprehensive code reviews and health sweep audits.
- `context/project/`: Files managing project overview, progress tracker, and future implementation backlog.
- `context/technical/`: Files defining architecture structures, DB schemas, telemetry data flows, and design decisions.
- `context/standards/`: Files enforcing code standards, development workflows, and UI styling context parameters.

---
*Developed with an AI-Driven Spec Methodology.*
