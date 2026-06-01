# VectorHUD (Tactical Gamer's Overlay)

VectorHUD is a lightweight, transparent, globally-summoned desktop overlay built for PC gamers and developers. It features a hyper-modular, glassmorphism UI with draggable, pinnable widgets that float seamlessly over borderless-fullscreen games, remaining completely hidden in the background until invoked via a custom hotkey.

## Core Features
- **Seamless Overlay:** Boots silently in the system tray and appears instantly via a global hotkey (e.g., Alt+O) without minimizing active games.
- **Pin & Play:** Widgets can be pinned to remain visible and click-through even after dismissing the overlay menu.
- **Hardware Metrics:** Real-time polling of CPU, RAM, and GPU statistics.
- **Media Capture:** Integrated screenshot capabilities and a rolling video buffer.
- **AI Integrations:** OpenRouter vision chat and Notion Quick-Capture syncing built right into the HUD.
- **Zero Telemetry to Cloud:** All session analytics, preferences, and keys are stored strictly in local SQLite and JSON files.

## Technology Stack
- **Frontend:** React + TypeScript + Tailwind CSS + Framer Motion (for physics and animations).
- **Backend:** Rust (via Tauri v2) for OS-level hotkey hooks, hardware polling, and filesystem operations.
- **Storage:** SQLite (`tauri-plugin-sql`) and Key-Value (`tauri-plugin-store`).

## Development Setup
### Prerequisites
- Node.js (v18+)
- Rust (latest stable)
- Tauri CLI (`npm install -g @tauri-apps/cli`)

### Running Locally
```bash
# Install dependencies
cd VectorHUD
npm install

# Start the dev environment
npm run tauri dev
```

## Architecture & Code Standards
The architecture of this project is strictly documented to ensure the codebase remains scalable and highly performant. 
For a complete understanding of the system logic, please review the files inside the `context/` directory.

### Key Highlights:
1. **Dumb Containers:** Widgets rely entirely on Zustand for state. Drag, drop, and resizing logic is handled by a unified physics container.
2. **Event-Driven Rust:** The React frontend rarely polls the backend. Instead, Rust runs efficient background threads that `emit` events (like hardware metrics) to the frontend.
3. **Strict CSP & Security:** VectorHUD utilizes Tauri v2's locked-down security model. All SQL queries, filesystem access, and external API integrations require explicit whitelist capabilities in `capabilities/default.json` and `tauri.conf.json`.

---
*Developed with an AI-Driven Spec Methodology.*
