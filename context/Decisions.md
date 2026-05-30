# Architectural & Design Decisions

This document tracks all important decisions made throughout the lifecycle of the Tactical Gamer's Overlay (VectorHUD).

## Session 1A: Foundation & Scaffolding
- **Decision:** Shift from standard `.jsx` to strict `.tsx` (TypeScript) to adhere to the project's code standards.
- **Decision:** Adopt Tailwind CSS for styling and Framer Motion for hardware-accelerated transitions.
- **Decision:** Integrate Zustand for lightweight frontend state management.
- **Decision:** Configure Tauri windows to be transparent and undecorated (`decorations: false`, `transparent: true`) to support the HUD overlay requirements.
- **Decision:** Pre-emptively add `tauri-plugin-sql` and `tauri-plugin-store` to the backend to support the defined storage model.
- **Decision:** Implement centralized logging using Rust's `tracing` ecosystem.
