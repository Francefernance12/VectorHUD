# VectorHUD Codebase Guide

This document serves as an onboarding guide for developers contributing to VectorHUD. It outlines how the React frontend and Rust backend communicate, how state is structured, and how to create a new widget.

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
> To prevent high-frequency re-render loops (especially during widget drag/resize events), always use Zustand's `useShallow` hook when subscribing to arrays or objects. Use granular selectors to subscribe only to the state slices you need.

### The "Dumb Container" Pattern
All widgets are wrapped in the `WidgetContainer.tsx` component.
* The container handles all drag, resize, positioning, and pin toggle logic.
* Individual widgets (e.g. `HardwareWidget`, `TimerWidget`) are purely presentational and receive position/size parameters as props.

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
     const unlisten = listen("hardware-metrics-update", (event) => {
       // update state
     });
     return () => { unlisten.then(fn => fn()); };
   }, []);
   ```

---

## 3. How to Create a New Widget

To add a new widget to the overlay, follow these steps:

### Step 1: Define the Widget ID and Properties
Add a unique identifier for your widget in `src/types.ts` and declare it in the `widgetStore.ts` initial state.

### Step 2: Build the UI Component
Create a new file in `src/components/widgets/` (e.g., `MyNewWidget.tsx`). Wrap the content in an `ErrorBoundary` to isolate potential crashes.

### Step 3: Register in App.tsx
Import your widget in `src/App.tsx` and map its ID to your component inside the active widgets loop.

### Step 4: Add Control in the Dock
Add a toggle button for your new widget in `src/components/Dock.tsx` so users can open/close it.
