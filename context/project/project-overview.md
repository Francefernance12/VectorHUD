# Tactical Gamer's Overlay

## Overview
A lightweight, transparent, globally-summoned desktop overlay built for PC gamers and developers. It features a hyper-modular, glassmorphism UI with draggable, pinnable widgets that float seamlessly over borderless-fullscreen games. It remains completely hidden in the background until invoked via a custom hotkey.

## Goals
1. Maintain near-zero performance overhead to ensure game framerates are unaffected.
2. Provide a hyper-modular widget system where users control exactly what is on screen.
3. Establish a secure, completely local storage environment for user data and API keys.

## Core User Flow
1. Application boots silently on Windows startup via system tray.
2. User presses custom hotkey (e.g., Alt + O).
3. The screen slightly darkens, revealing the active widgets and the primary Widget Menu.
4. User toggles, drags, resizes, or pins desired widgets.
5. User clicks the empty background or presses the hotkey to dismiss the overlay.
6. Pinned widgets remain visible and click-through over the active game.

## Features
### Core Framework
- Global custom hotkey listener.
- Transparent, click-through window management.
- Master Widget Menu (Dock) for toggling available widgets.

### System Widgets
- Hardware Metrics (CPU, GPU, RAM polling).
- Media Capture (Screenshots, rolling 30-second video buffers, Gallery view).
- Advanced Audio Mixer (Per-application volume, hardware input/output toggles).
- OpenRouter AI Vision Chat.
- Notion Quick-Capture Notes.

### Integration Widgets (Future)
- CI/CD & Local Server Monitors.

## Scope
### In Scope
- Windows 10/11 compatibility.
- Local SQLite database and JSON store.
- Centralized rotating log files for both frontend and backend.

### Out of Scope
- DirectX/Vulkan game hooking (Anti-cheat safe by relying on borderless window modes).
- Cloud syncing (all data remains local).
- Google Messages or automated Discord DM features (TOS compliance).

## Success Criteria
1. The overlay can be summoned and dismissed instantly without minimizing the active game.
2. Widgets can be pinned, remaining visible and click-through after overlay dismissal.
3. Logs from both Rust and React are written to a single local file.