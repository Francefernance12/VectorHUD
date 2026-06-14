# Dimension Checklists

Detailed question lists for each review dimension. Use these to guide your inspection of target code.

---

## Architecture Compliance

**Goal**: Ensure code respects system boundaries, maintains invariants, and follows the storage model.

**Reference**: `context/architecture.md`

### System Boundaries

- [ ] Command boundary: Does code route through `src-tauri/src/commands/` or does frontend make direct system calls?
- [ ] Core boundary: Are OS-level hooks (audio, hotkeys, capture) isolated in `src-tauri/src/core/`?
- [ ] Widget boundary: Do widgets in `src/components/widgets/` accept props only, or do they handle their own drag/resize?
- [ ] Layout boundary: Is drag/drop/pinning physics centralized in the "Dumb Container" or scattered?

### Invariants

- [ ] **Frontend polling**: Does frontend poll backend heavily? (Should emit events instead)
- [ ] **Error forwarding**: Are React errors caught and logged to Rust tracing logger?
- [ ] **User opt-in**: Do external APIs (OpenRouter, Notion) require explicit user consent?
- [ ] **Focus theft**: When pinned widgets are clicked, do they steal focus from the primary game window?

### Storage Model

- [ ] **SQLite usage**: Are session analytics and historical data persisted in SQLite?
- [ ] **JSON store**: Are widget coordinates, active/pinned states, preferences stored in JSON store?
- [ ] **Credentials**: Are API keys (OpenRouter, Notion) stored securely (OS credential manager or encrypted)?
- [ ] **Logs**: Are both frontend and backend logs written to centralized `tracing` logs?

---

## Performance & Scalability

**Goal**: Prevent render loops, polling overhead, memory leaks, and unblocked threads.

**Reference**: `context/code-standards.md` (State Management & Rendering section)

### React Performance

- [ ] **Render loops**: Are there 60FPS re-render loops due to store subscriptions?
- [ ] **useShallow**: Are list/array subscriptions using `useShallow` to prevent excessive re-renders?
- [ ] **Selectors**: Do components use granular selectors (`state => state.activeWidgets[id]`) vs. destructuring?
- [ ] **Dependencies**: Are useEffect dependencies clean (no stale closures)?

### Rust Performance

- [ ] **Async tasks**: Are heavy operations (media encoding, metrics polling) in background tokio tasks?
- [ ] **Main thread**: Is the main thread ever blocked by I/O or long computations?
- [ ] **Polling overhead**: Are backend metrics queries throttled to reasonable intervals?
- [ ] **Memory leaks**: Are resources (handles, file descriptors) properly closed?

### System Overhead

- [ ] **Hotkey listener**: Is the global hotkey listener lightweight and non-blocking?
- [ ] **Overlay rendering**: Does the overlay maintain near-zero overhead when pinned?
- [ ] **Sidecar processes**: Are PresentMon64 and PDH processes properly managed?

---

## Error Handling & Resilience

**Goal**: Catch failures gracefully, log explicitly, and prevent cascading crashes.

**Reference**: `context/code-standards.md` (Error Boundaries & Logging)

### Frontend Error Handling

- [ ] **Error Boundaries**: Is every widget wrapped in React ErrorBoundary?
- [ ] **Error recovery**: Do widgets gracefully degrade if API calls fail?
- [ ] **Logging**: Are errors forwarded to Rust tracing logger via `logger.ts`?
- [ ] **User feedback**: Do errors surface to users in toast notifications or status bars?

### Backend Error Handling

- [ ] **Result types**: Are all exposed commands returning `Result<T, E>`?
- [ ] **Unwrap**: Is `.unwrap()` avoided in production code?
- [ ] **Error logging**: Are errors logged before returning Err?
- [ ] **Graceful degradation**: Can the system continue if non-critical operations fail?

### Fallbacks & Recovery

- [ ] **Credential failures**: If API key is missing, does the app gracefully disable that widget?
- [ ] **Hardware unavailable**: If GPU data unavailable, does Hardware widget show N/A instead of crashing?
- [ ] **Database unavailable**: Can the app continue if SQLite is temporarily locked?

---

## Security

**Goal**: Prevent unauthorized system access, API abuse, and credential leaks.

**Reference**: `context/code-standards.md` (Tauri v2 Capabilities & Permissions section)

### Tauri Capabilities

- [ ] **Whitelist**: Are window labels and plugin capabilities explicitly whitelisted in `default.json`?
- [ ] **SQL scope**: If using SQL, are `allow-execute`, `allow-select`, `allow-load` explicitly granted?
- [ ] **Filesystem scope**: If reading files, is `assetProtocol` enabled with strict `scope` (e.g., `$PICTUREDIR/**`)?
- [ ] **Minimum principle**: Is each capability granted only to commands that need it?

### API Security

- [ ] **CSP policy**: Are external API domains whitelisted in `tauri.conf.json` CSP `connect-src`?
- [ ] **User consent**: Are external API keys required before making calls?
- [ ] **Credential storage**: Are API keys stored securely (not in plaintext JSON)?
- [ ] **No hardcoding**: Are secrets absent from source code?

### Data Protection

- [ ] **Local storage**: Is all user data (transcripts, images) stored locally, not transmitted?
- [ ] **Encryption**: Are sensitive fields in SQLite encrypted at rest?
- [ ] **TLS/HTTPS**: Are external API calls made over HTTPS only?

---

## UI/UX & Styling

**Goal**: Maintain visual consistency, accessibility, and responsiveness.

**Reference**: `context/ui-context.md`

### Visual Consistency

- [ ] **Glassmorphism**: Do unpinned overlays use `backdrop-blur` consistently?
- [ ] **Colors**: Do components use deep charcoal/black backgrounds with amber/terminal-green accents?
- [ ] **Fonts**: Are monospace fonts (JetBrains Mono, Fira Code) used consistently?
- [ ] **Borders**: Are borders wireframe style with sharp or slightly rounded corners (`rounded-sm`)?

### Responsiveness

- [ ] **Scaling**: Do widgets scale correctly for 1080p, 1440p, 4K displays?
- [ ] **Overflow**: Is text truncated or wrapped correctly when space is tight?
- [ ] **Touch**: Are interactive elements sized for keyboard/mouse + future touch support?

### Accessibility

- [ ] **Contrast**: Do text and backgrounds meet WCAG AA standards?
- [ ] **Keyboard nav**: Can widgets be navigated via keyboard?
- [ ] **Labels**: Do interactive elements have descriptive labels/tooltips?
- [ ] **Focus states**: Is focus indicator visible?

### Widget Interactions

- [ ] **Drag & drop**: Do widgets provide visual feedback while dragging?
- [ ] **Pinning**: Is the pinned state visually distinct?
- [ ] **Hover states**: Do buttons and interactive elements have hover feedback?
- [ ] **Animations**: Are Framer Motion transitions smooth and hardware-accelerated?

---

## Code Quality & Standards

**Goal**: Ensure code follows conventions, is testable, and uses strict typing.

**Reference**: `context/code-standards.md` (General, TypeScript & React, Rust & Tauri sections)

### TypeScript Compliance

- [ ] **Strict mode**: Are files compiled with `strict: true` in `tsconfig.json`?
- [ ] **No any**: Are types defined explicitly (no `any` escapes)?
- [ ] **Interfaces**: Do widgets have strict interfaces for props and state slices?
- [ ] **Type inference**: Does code rely on TS inference where appropriate, or are types explicit?

### React Conventions

- [ ] **Component structure**: Are components functional with hooks (not class components)?
- [ ] **Props drilling**: Is props drilling minimized (or is Zustand used appropriately)?
- [ ] **Naming**: Do component names follow PascalCase? Hooks follow useX pattern?
- [ ] **Exports**: Are exports named (not default) for better IDE support?

### Rust Conventions

- [ ] **Naming**: Do functions use snake_case, types use PascalCase?
- [ ] **Module organization**: Are related functions grouped in modules?
- [ ] **Comments**: Are non-obvious logic explained with comments?
- [ ] **Clippy**: Does code pass `cargo clippy` without warnings?

### Testing

- [ ] **Unit tests**: Do Rust modules have `#[cfg(test)]` tests?
- [ ] **Component tests**: Do React components have Vitest tests for render + state?
- [ ] **Coverage**: Is critical logic (stores, commands) covered by tests?
- [ ] **Edge cases**: Do tests cover error paths, boundary conditions?

---

## Maintainability

**Goal**: Keep code DRY, well-documented, and easy to change.

**Reference**: `context/code-standards.md` (Context Updating Principle)

### State Management (Zustand)

- [ ] **Isolation**: Does each store handle one responsibility?
- [ ] **Subscriptions**: Are store subscriptions clean and minimal?
- [ ] **Selectors**: Are selectors used to avoid unnecessary re-renders?
- [ ] **No nested mutations**: Does code use immutable patterns?

### Documentation

- [ ] **Inline comments**: Are complex algorithms explained?
- [ ] **Store documentation**: Do Zustand stores have JSDoc comments for slices?
- [ ] **Command docs**: Do Rust commands have doc comments explaining purpose?
- [ ] **README updates**: Are significant features documented in relevant READMEs?

### Code Organization

- [ ] **Modularity**: Are components small, focused, and reusable?
- [ ] **No duplication**: Is similar logic extracted to utilities?
- [ ] **Folder structure**: Does the codebase follow expected patterns?
- [ ] **Naming clarity**: Are function/variable names self-documenting?

### Context Maintenance

- [ ] **Progress tracker**: Is `context/progress-tracker.md` updated after sessions?
- [ ] **Decisions log**: Are significant decisions recorded in `Decisions.md`?
- [ ] **Architecture drift**: Has code diverged from `context/architecture.md`?
- [ ] **Standards compliance**: Are deviations from `code-standards.md` documented?

---

## Tips for Effective Reviews

1. **Use file search**: `grep` for patterns (e.g., `.unwrap()`, `any`, `useEffect`) to spot issues quickly
2. **Cross-reference**: Compare findings against `context/` files to validate
3. **Ask "why"**: If code violates a standard, understand the reason before flagging
4. **Prioritize**: Focus on Critical/High severity issues first
5. **Provide context**: When recommending fixes, include a code example if possible
