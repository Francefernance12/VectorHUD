# CLAUDE.md — AI Context for VectorHUD

## Application Building Context

Read the following files **in order** before implementing
or making any architectural decision:

1. `context/project-overview.md` — product definition, goals, features, and scope
2. `context/architecture.md` — system structure, boundaries, storage model, and invariants
3. `context/ui-context.md` — theme, colors, typography, and component conventions
4. `context/code-standards.md` — implementation rules and conventions
5. `context/ai-workflow-rules.md` — development workflow, scoping rules, and delivery approach
6. `context/progress-tracker.md` — current phase, completed work, open questions, and next steps
7. `context/Decisions.md` — architectural and design decisions log
8. `context/database-schema.md` — SQLite table definitions

Update `context/progress-tracker.md` after each meaningful implementation change.

If implementation changes the architecture, scope, or standards documented in the context
files, update the relevant file **before** continuing.

---

## Project State Summary

**VectorHUD** is a Tauri 2.0 (React + Rust) transparent overlay for PC gamers. It floats
over borderless-fullscreen games, summoned via `Ctrl+Alt+O`. Widgets are draggable,
pinnable (click-through), and persist their layout to a local JSON store.

### Completed Sessions (all merged to main)
| Session | Branch | What it did |
|---------|--------|-------------|
| 1A | `Session-1A-Foundation` | Tauri scaffold, React, Tailwind, Zustand, plugin wiring |
| 1B | `Session-1B-Telemetry` | Rust `tracing` + rotating log files |
| 1C | `Session-1C-Persistence` | SQLite via `tauri-plugin-sql`, JSON via `tauri-plugin-store` |
| 2A | `Session-2A-Shell` | Transparent ghost window + `Ctrl+Alt+O` global hotkey |
| 2B | `Session-2B-Dock` | Widget Menu (Dock) UI + Husky pre-commit hooks |
| 3A | `Session-3A-Physics` | Drag/resize "Dumb Container" for widgets |
| 3B | `Session-3B-Pinning` | Pinning (click-through), widget state persistence, Vitest tests |
| 4A | `Session-4A-Metrics` | HardwareWidget with live CPU/RAM via `sysinfo` crate on a background thread |

### Current Branch: `Session-4B-Capture` (uncommitted changes)
Media Capture widget with screenshot functionality. The Rust backend (`capture.rs`)
works — screenshots save to `~/Pictures/VectorHUD/`. But the **SQLite integration is
broken** and **has never worked in this session** due to two compounding bugs (see below).

---

## Active Bugs (MUST FIX BEFORE ANYTHING ELSE)

### Bug 1: `tauri-plugin-sql` missing the `sqlite` feature flag
**Evidence** (from `vectorhud.log.2026-05-31`):
```
Frontend: Failed to load SQLite database: invalid connection url: sqlite:vectorhud.db - No database driver enabled!
```
**Root cause**: `Cargo.toml` has `tauri-plugin-sql = "2"` but **does not enable the `sqlite`
feature**. The plugin ships with zero drivers by default. It must be:
```toml
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```
**Impact**: Every call to `Database.load("sqlite:vectorhud.db")` from the frontend fails.
This means `getDb()` in `db.ts` throws on every invocation. The capture history never saves,
never loads, and the `verifyPersistence()` in `App.tsx` also fails (though it catches the
error gracefully).

**Why this was missed**: The previous AI agent added the dependency as `tauri-plugin-sql = "2"`
during Session 1C. It apparently worked at some point (persistence was "verified" in Session
1C logs), which suggests this may have regressed when `Cargo.toml` was rewritten or the feature
was accidentally dropped during a later edit. Regardless, the current `Cargo.toml` is missing it.

### Bug 2: `capabilities/default.json` has stale permissions from abandoned multi-window approach
The capabilities file currently grants permissions for window creation/manipulation that are
no longer needed (`core:webview:allow-create-webview-window`, `core:window:allow-set-position`,
etc.). These should be cleaned up. The `sql:default` and `store:default` permissions that were
added are actually correct and should be kept — they were missing from the original config.

---

## Known Pitfalls (Learned from Previous Failures)

### 1. Tauri v2 Capabilities System & Permissions
Tauri v2 uses a strict capability-based permission model. Every plugin action the frontend
invokes must be explicitly whitelisted in `src-tauri/capabilities/default.json`. 
- **SQL:** Simply declaring `"sql:default"` is not enough; you must explicitly whitelist `"sql:allow-execute"`, `"sql:allow-select"`, and `"sql:allow-load"`.
- **Filesystem / Assets:** To load local files via `convertFileSrc`, you must enable `assetProtocol` in `tauri.conf.json` and set a strict scope (e.g., `["$PICTUREDIR/VectorHUD/**"]`). Missing scopes cause broken images without throwing obvious errors.
If capabilities or scopes are missing, the plugin call **silently fails** on the frontend with a cryptic error or broken functionality. Always check permissions.

### 2. SQLite Migrations Are Immutable
`tauri-plugin-sql` migrations are run once per version number. If `version: 1` has already
executed, modifying its SQL does nothing. Always create a new migration with a bumped version
number. The current codebase has a redundant `version: 2` migration that re-creates
`capture_history` — this is harmless but should be noted.

### 3. Multi-Window Spawning is Fragile on Windows
Spawning secondary `WebviewWindow` instances from the frontend introduces:
- Plugin permission inheritance issues (new windows don't inherit capabilities)
- DWM invisible border artifacts when manually positioning windows
- Focus/blur event timing races

**Decision**: All UI should be rendered within the single main window using React state
and portals. No secondary Tauri windows for UI sub-components.

### 4. `fullscreen: true` vs `maximized: true` on Windows
`fullscreen: true` in `tauri.conf.json` triggers exclusive fullscreen mode on Windows,
which can cause white-line rendering artifacts and compositor conflicts with transparent
windows. Use `maximized: true` instead — it fills the screen while respecting the window
compositor pipeline.

### 5. Windows DWM Resize Borders
A borderless Tauri window with `resizable: true` (default) still gets an invisible 7-pixel
resize grip from Windows DWM. If precise pixel positioning matters, set `resizable: false`
in `tauri.conf.json`. However, this prevents window resizing entirely.

### 6. `cargo fmt` Must Pass Before Commits
The project has a Husky pre-commit hook that runs `cargo fmt --check` and `cargo clippy -D warnings`.
Always run `cargo fmt` after editing Rust files. Commits will be rejected otherwise.

### 7. Screenshot Overlay Exclusion
The `capture_screenshot` command hides the window before capturing (`window.hide()`, sleep 150ms,
capture, `window.show()`). This works but causes a visible flicker. The 150ms delay is necessary
for the Windows compositor to fully remove the window from the screen buffer.

---

## Git Workflow Rules

- Branch naming: `Session-{N}{A/B}-{Name}` (e.g., `Session-4B-Capture`)
- **Always specify the target branch** in implementation plans
- **Commit and push** ONLY when the user explicitly instructs you to "push the changes" in the current message. Do NOT assume a general instruction from a previous session applies automatically. When in doubt, commit but ask for permission to push.
- Run `cargo fmt` before every commit
- Check `context/` files at the start of every session and after every meaningful change

---

## File Map (Key Files)

### Rust Backend (`src-tauri/src/`)
- `lib.rs` — App setup: logging, system tray, global shortcut, plugin registration, migrations
- `core/metrics.rs` — Background `sysinfo` thread emitting CPU/RAM events
- `core/capture.rs` — Screenshot command using `xcap` crate
- `commands/telemetry.rs` — `frontend_log` bridge for React → Rust logging

### React Frontend (`src/`)
- `App.tsx` — Root: shell state, widget rendering, persistence hydration
- `store/shellStore.ts` — Zustand store for interactive/ghost mode
- `store/widgetStore.ts` — Zustand store for widget positions/active state
- `utils/db.ts` — SQLite connection singleton
- `utils/store.ts` — JSON key-value store wrapper
- `utils/logger.ts` — Frontend → Rust log bridge
- `components/Dock.tsx` — Bottom widget menu
- `components/WidgetContainer.tsx` — "Dumb Container" with drag/resize/pin
- `components/widgets/HardwareWidget.tsx` — Live CPU/RAM display
- `components/widgets/MediaCaptureWidget.tsx` — Screenshot + gallery (broken DB)

### Config
- `src-tauri/tauri.conf.json` — Window config (transparent, maximized, decorations: false)
- `src-tauri/capabilities/default.json` — Tauri v2 security permissions
- `src-tauri/Cargo.toml` — Rust dependencies (⚠️ missing sqlite feature!)

---

## User Preferences

- **Dummy-first**: Create React widget UI with dummy data first, then wire the Rust backend.
- **Modular**: Never modify existing working widget logic to accommodate a new widget.
- **Pinning aesthetic**: Pinned widgets use `bg-black/60 backdrop-blur-md` for readability.
- **Screenshots**: Saved to `~/Pictures/VectorHUD/` (note: may resolve to OneDrive path).
- **Video recording**: Placeholder only — future implementation.
- **GPU/VRAM/FPS**: Future widgets, not in current scope.
- **System tray**: Added in current branch (tray-icon feature in Cargo.toml). Quit menu item.
- **Line endings**: Git may warn about LF→CRLF. This is cosmetic on Windows and harmless.
