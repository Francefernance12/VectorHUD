# Code Standards

## General
- Build the "Dumb Container" pattern. Widgets only receive props; they do not handle their own drag/resize logic.
- Follow Test-Driven Development (TDD) where applicable. Write the test, watch it fail, implement the fix.
- Log explicitly. Every backend command must log its invocation and result.

## TypeScript & React
- Strict mode is required.
- Do not use `any`. Use strict interfaces for all widget props and state slices.
- Use Framer Motion for smooth, hardware-accelerated transitions.

## Rust
- Use `Result<T, E>` for all commands exposed to the frontend.
- Never use `.unwrap()` in production code. Handle errors gracefully and log them via `tracing`.
- Keep the main thread unblocked. Offload media encoding and metrics polling to asynchronous background tasks using `tokio`.

## Styling (Tactical / HUD)
- Primary fonts: Monospace (JetBrains Mono or Fira Code).
- Colors: Deep charcoal/black backgrounds with amber or terminal green accents.
- Borders: Wireframe styling, sharp or slightly rounded corners (e.g., `rounded-sm`).
- Glassmorphism: Heavy use of `backdrop-blur` for unpinned overlay states.

## Testing
- Rust logic must have unit tests inside the module (`#[cfg(test)]`).
- React components must have unit tests using Vitest verifying render and state updates.