# Code Standards

## General
- Build the "Dumb Container" pattern. Widgets only receive props; they do not handle their own drag/resize logic.
- Follow Test-Driven Development (TDD) where applicable. Write the test, watch it fail, implement the fix.
- Log explicitly. Every backend command must log its invocation and result.
- **Context Updating Principle (CRITICAL):** At the end of every development session, before moving to the next session, you MUST update all relevant context files (`progress-tracker.md`, `Decisions.md`, `database-schema.md`). This ensures the AI's internal model of the architecture never drifts from reality.

## TypeScript & React
- Strict mode is required.
- Do not use `any`. Use strict interfaces for all widget props and state slices.
- Use Framer Motion for smooth, hardware-accelerated transitions.
- **State Management & Rendering:** Prevent 60FPS re-render loops. When subscribing to Zustand arrays or objects for rendering lists, ALWAYS use `useShallow` from `zustand/react/shallow`. Widgets must use granular selectors (`state => state.activeWidgets[id]`) rather than destructuring the entire store.
- **Error Boundaries:** Every widget must be wrapped in a React `ErrorBoundary` to prevent individual widget crashes (e.g. from invalid API responses) from unmounting the entire HUD.

## Rust & Tauri Backend
- Use `Result<T, E>` for all commands exposed to the frontend.
- Never use `.unwrap()` in production code. Handle errors gracefully and log them via `tracing`.
- Keep the main thread unblocked. Offload media encoding and metrics polling to asynchronous background tasks using `tokio`.
- **Tauri v2 Capabilities & Permissions**: Tauri v2 is strictly locked down by default.
  - If spawning multiple windows, you must meticulously whitelist the window label (e.g. `"*"`) in `src-tauri/capabilities/default.json` and manually assign every required plugin capability.
  - **SQL Plugins**: Simply adding `sql:default` is NOT enough to execute queries. You must explicitly whitelist `"sql:allow-execute"`, `"sql:allow-select"`, and `"sql:allow-load"` if your frontend needs to insert or read from the DB.
  - **Filesystem & Assets**: If you want the frontend to read files from the local disk (e.g., using `convertFileSrc`), you MUST explicitly enable `assetProtocol` in `tauri.conf.json` and define a strict `scope` (like `["$PICTUREDIR/VectorHUD/**"]`). Missing scopes will cause images to render broken without throwing obvious frontend errors.
  - **Content Security Policy (CSP)**: To make external API calls (e.g. OpenRouter, Notion) from the frontend, you must explicitly whitelist the target domains in `tauri.conf.json` under `security.csp` using the `connect-src` directive (e.g., `connect-src 'self' https://openrouter.ai https://api.notion.com`).

## Styling (Tactical / HUD)
- Primary fonts: Monospace (JetBrains Mono or Fira Code).
- Colors: Deep charcoal/black backgrounds with amber or terminal green accents.
- Borders: Wireframe styling, sharp or slightly rounded corners (e.g., `rounded-sm`).
- Glassmorphism: Heavy use of `backdrop-blur` for unpinned overlay states.

## Testing
- Rust logic must have unit tests inside the module (`#[cfg(test)]`).
- React components must have unit tests using Vitest verifying render and state updates.