# VectorHUD 🚀
**The Tactical Gamer's Overlay**

VectorHUD is a hyper-lightweight, transparent, globally-summoned desktop overlay built for PC gamers and developers. Powered by a high-performance Rust backend and a Glassmorphism React frontend, it floats seamlessly over borderless-fullscreen games and applications. It remains completely invisible in the background until invoked, ensuring near-zero performance overhead while you game.

---

## 🎮 For Users

### Key Features
- **Zero-Friction Invocation**: Press `Ctrl + Alt + O` from anywhere, inside any borderless-fullscreen game, to instantly summon or dismiss the Master Dock.
- **Ghost Mode & Pinning**: Drag your favorite widgets anywhere on the screen and pin them. They become permanently visible and click-through, remaining active even when the overlay is dismissed!
- **Zero-Conflict Hardware Metrics**: Real-time CPU, RAM, and true GPU polling powered by native Windows Kernel PDH bindings. No bloated background scanners!
- **Built-in Capture Engine**: Snap screenshots or maintain a rolling 30-second video replay buffer using our custom `windows-record` integration (powered by DXGI Desktop Duplication & Media Foundation).
- **Audio Hub**: Hook directly into the Core Audio API to manage per-application volume and easily switch input/output devices without Alt-Tabbing.
- **AI Integrations**: Seamlessly draft Notion to-do lists and interface with OpenRouter AI directly from the HUD.
- **Privacy First**: All session analytics, API keys, and preferences are stored strictly in your local SQLite and JSON files. No cloud sync, no tracking.

### Installation
1. Navigate to the **[Releases](https://github.com/Francefernance12/VectorHUD/releases)** page on GitHub.
2. Download the latest `vectorhud_x64-setup.exe` or `.msi` installer.
3. Run the installer. *(Note: Windows SmartScreen may flag it. Click "More Info" -> "Run Anyway".)*
4. VectorHUD will boot silently to your System Tray. Press `Ctrl + Alt + O` to open the overlay!

---

## 💻 For Developers

VectorHUD is an ambitious project pushing the boundaries of what the Tauri 2.0 framework can achieve on Windows. It requires deep synchronization between asynchronous React lifecycles and highly threaded Rust OS hooks.

### Technology Stack
- **Framework:** Tauri v2
- **Frontend:** React + TypeScript + Tailwind CSS + Framer Motion
- **State Management:** Zustand (with `useShallow` for 60FPS drag rendering)
- **Backend:** Rust
- **Storage:** SQLite (`tauri-plugin-sql`) and Key-Value (`tauri-plugin-store`)
- **Telemetry:** PresentMon64 (Sidecar), DXGI, Windows PDH

### High-Level Architecture
1. **The Dumb Container:** Widgets rely entirely on Zustand for state. Drag, drop, and resizing logic is handled by a unified physics container (`WidgetContainer.tsx`). Individual widgets are purely presentational.
2. **Event-Driven Rust:** The React frontend rarely polls the backend. Instead, Rust runs efficient background threads that `emit` events (like hardware metrics or hotkeys) to the frontend.
3. **Strict Threading:** OS-level hooks (like `tauri-plugin-global-shortcut`) are strictly guarded by `std::sync::Mutex` in Rust to protect against React StrictMode's rapid double-mounting behavior.

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

*Note: In development mode, the Rust backend logs directly to a rolling file, NOT the console. To view backend errors, inspect `C:\Users\<user>\AppData\Roaming\com.fernando-arias.vectorhud\logs\vectorhud.log.*`.*

#### Building for Production
To package the final `.exe` and `.msi` installers:
```bash
npm run tauri build
```
Compiled installers will be located in `src-tauri/target/release/bundle/`.

### Documentation
For a complete understanding of the system logic, decisions, and codebase workflows, please read the documentation located in the `docs/` and `context/` directories.
- `docs/codebase_guide.md`: A complete onboarding guide to building new widgets and understanding state.
- `docs/journey_and_lessons.md`: A deep dive into the architectural battles and bug-fixes we faced during development.
- `context/Decisions.md`: A historical log of every architectural pivot.

---
*Developed with an AI-Driven Spec Methodology.*
