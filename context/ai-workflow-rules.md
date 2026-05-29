# AI Workflow Rules & Git Strategy

## Approach
Implement this project using a strict Spec-Driven, step-by-step methodology. Verify functionality and pass tests before moving to the next component.

## Git Branching Strategy
Use a session-based branching model to track AI iterations clearly.
- `main` — Stable, working code.
- `Session-1A-Foundation` — Initial project setup, Tauri init, dependencies.
- `Session-1B-Logging` — Implementing the `tracing` layer.
- `Session-2A-UI-Dock` — Building the master widget menu.
Merge into `main` only when the unit is complete, tested, and verified.

## Step-by-Step Implementation Process
For every task, follow this loop:
1. **Plan:** Read the relevant context. Define the specific boundaries of the current Session branch.
2. **Test:** Write the failing unit tests (Rust `cargo test` or frontend `Vitest`).
3. **Build:** Write the minimal code required to pass the test and satisfy the spec.
4. **Log:** Ensure the new feature integrates with the centralized logging system.
5. **Verify:** Run tests and ensure the build completes successfully. Update `progress-tracker.md`.

## Scoping Rules
- Do not combine UI creation with heavy backend Rust logic in a single prompt.
- Create dummy data for React widgets first to verify UI, then connect the Rust backend in a separate step.
- Never modify existing, working widget logic to accommodate a new widget; use modular interfaces.