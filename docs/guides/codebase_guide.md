# VectorHUD Codebase Guide

This document serves as an onboarding guide for developers contributing to VectorHUD. It outlines how the React frontend and Rust backend communicate, how state is structured, how our capture engine functions, and how to create new widgets.

### Documentation References
- [codebase_guide.md](file:///d:/ProgrammingProjects/FrancisGamebar/docs/guides/codebase_guide.md): A complete onboarding guide to building new widgets and understanding state.
- [ai_actions.md](file:///d:/ProgrammingProjects/FrancisGamebar/docs/guides/ai_actions.md): A guide detailing the AI assistant's system capabilities, tool parameters, and prompt examples.
- [journey_and_lessons.md](file:///d:/ProgrammingProjects/FrancisGamebar/docs/guides/journey_and_lessons.md): A deep dive into the architectural battles and bug-fixes we faced during development.
- [Decisions.md](file:///d:/ProgrammingProjects/FrancisGamebar/context/technical/Decisions.md): A historical log of every architectural pivot.

---

## 1. Frontend Architecture (React + Zustand)

VectorHUD's React frontend runs inside the Tauri WebView. The UI is designed to be a transparent HUD overlay that floats over games.

### State Management
State is managed globally using **Zustand** stores located in `src/store/`.
* `widgetStore.ts`: Tracks which widgets are open, pinned, their coordinates, and sizes.
* `settingsStore.ts`: Manages user preferences, font sizes, global theme colors, and hotkeys.
* `recordingStore.ts`: Manages video recording, replay buffer state, and game process detection.
* `shellStore.ts`: Manages overlay visibility and whether the window is currently interactive.

> [!IMPORTANT]
> To prevent high-frequency re-render loops (especially during widget drag/resize events), always use Zustand's `useShallow` hook when subscribing to arrays or objects. Use granular selectors (e.g., `state => state.activeWidgets[id]`) to subscribe only to the state slices you need.

### The "Dumb Container" Pattern
All widgets are wrapped in the `WidgetContainer.tsx` component.
* The container handles all drag, resize, positioning, and pin toggle logic.
* Individual widgets (e.g., `HardwareWidget`, `TimerWidget`) are purely presentational and receive position/size parameters as props.
* Every widget must be wrapped in a React `ErrorBoundary` so a crash in one widget (e.g., from a malformed API payload) does not crash the entire overlay.

---

## 2. Backend Architecture (Rust + Tauri)

The Rust backend handles heavy OS-level interactions, file system tasks, database access, and hardware metrics polling.

### IPC Communication
Communication between React and Rust uses Tauri's IPC bridge:
1. **Frontend-to-Backend (Commands)**:
   React invokes Rust functions using:
   ```typescript
   import { invoke } from "@tauri-apps/api/core";
   const path = await invoke<string>("capture_screenshot");
   ```
   Rust defines commands using `#[tauri::command]` and registers them in `src/lib.rs`.

2. **Backend-to-Frontend (Events)**:
   The backend emits events asynchronously to update the frontend:
   ```rust
   app_handle.emit("hardware-metrics-update", payload).unwrap();
   ```
   React listens for these events using Tauri's `listen` API:
   ```typescript
   import { listen } from "@tauri-apps/api/event";
   useEffect(() => {
     let isMounted = true;
     const setupListener = async () => {
       const unlisten = await listen("hardware-metrics-update", (event) => {
         if (!isMounted) return;
         // update state
       });
       return unlisten;
     };
     const unlistenPromise = setupListener();
     return () => {
       isMounted = false;
       unlistenPromise.then(fn => fn());
     };
   }, []);
   ```

---

## 3. Core Architectural Patterns

### Hybrid Capture Engine
VectorHUD uses a split capture architecture to balance memory footprint against color accuracy:
* **30-second Replay Buffer:** Uses a background `ffmpeg.exe` sidecar. FFmpeg captures the screen and writes encoded HLS segments (`.ts` video slices) to disk, maintaining a rolling 30-second window. This limits memory consumption to ~40MB (compared to >3.6GB for raw in-memory frame buffers).
* **Screenshots & Manual Recording:** Uses our custom native Rust `windows-record` crate wrapping DXGI and Media Foundation. It captures raw linear float16 scRGB data (`DuplicateOutput1` with `DXGI_FORMAT_R16G16B16A16_FLOAT`) to pull HDR signals directly from the GPU, and applies a CPU Reinhard tone mapping + sRGB gamma correction pass to prevent washed-out colors on HDR monitors.

### Secure API Mediation & Redaction
To keep API credentials secure and comply with strict Content Security Policies (CSP):
* Direct fetch calls to external APIs (OpenRouter, Notion) are forbidden in frontend React.
* Instead, React invokes the backend command `call_ai_api` with the encrypted key or payload, and Rust handles network communication.
* All catches inside frontend TypeScript must route error messages through `sanitizeError` (in [logger.ts](file:///d:/ProgrammingProjects/FrancisGamebar/VectorHUD/src/utils/logger.ts)) to automatically redact any API credentials before writing to disk or displaying them in user toasts.

### Mutex Concurrency Safety
To guard against race conditions (such as React StrictMode double-mounting on boot), all critical backend states (voice recorder, hotkey managers, and recording pipelines) are guarded by `std::sync::Mutex`. 
* **Safe Mutex Locking:** Never call `.lock().unwrap()`. If a thread panics while holding the lock, subsequent locks will crash. Always use `.lock().unwrap_or_else(|e| e.into_inner())` to recover the mutex guard safely.

---

## 4. How to Create a New Widget

To add a new widget to the overlay, follow these steps:

### Step 1: Define the Widget ID and Properties
Add a unique identifier for your widget in `src/types.ts` and declare it in the `widgetStore.ts` initial state.

### Step 2: Build the UI Component
Create a new file in `src/components/widgets/` (e.g., `MyNewWidget.tsx`). Wrap the content in an `ErrorBoundary` to isolate potential crashes.

### Step 3: Register in App.tsx
Import your widget in `src/App.tsx` and map its ID to your component inside the active widgets loop.

### Step 4: Add Control in the Dock
Add a toggle button for your new widget in `src/components/Dock.tsx` so users can open/close it.
