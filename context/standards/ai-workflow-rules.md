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

## Pre-commit Hooks & CI
- A Husky pre-commit hook is configured to enforce `npm run check:format` (running `cargo fmt --check`) and `npm run lint:rust` (running `cargo clippy -D warnings`).
- **Never bypass the pre-commit hooks** with `--no-verify` unless absolutely critical. We rely on this strict local enforcement to prevent broken GitHub Action pipelines.

## Step-by-Step Implementation Process
For every task, follow this loop:
1. **Plan:** Read the relevant context. Define the specific boundaries of the current Session branch.
2. **Test:** Write the failing unit tests (Rust `cargo test` or frontend `Vitest`).
3. **Build:** Write the minimal code required to pass the test and satisfy the spec.
4. **Log:** Ensure the new feature integrates with the centralized logging system.
5. **Document:** **CRITICAL:** Update ALL relevant context files dynamically. Do not just rely on `progress-tracker.md`. 
    - If you made architectural choices or encountered gotchas, update `Decisions.md`.
    - If you modified the DB schema, update `database-schema.md`.
    - If you skipped a feature or found a non-critical bug, add it to `FutureImplementations.md`.
6. **Verify:** Run tests and ensure the build completes successfully. Update `progress-tracker.md`.

## Bug Fixing Protocol
When assigned a bug fix, you must adhere to the following strict process to prioritize system stability and prevent regressions:
1. **Analyze Dependencies:** Before writing any code, identify every function, variable, or system component in the provided file/context that interacts with or depends on the code being changed.
2. **Impact Assessment:** Briefly document what could break if the fix is implemented carelessly.
3. **The Fix:** Provide the corrected code.
4. **Validation:** Explicitly state why this specific fix will not disrupt the rest of the file system or adjacent logic.

## Scoping Rules
- Do not combine UI creation with heavy backend Rust logic in a single prompt.
- Create dummy data for React widgets first to verify UI, then connect the Rust backend in a separate step.
- Never modify existing, working widget logic to accommodate a new widget; use modular interfaces.

## Communication & Debugging Principles
- **Avoid Overconfidence:** Do not use phrases like "I know exactly what the problem is" or "I see exactly what is going on." Prove your understanding by referencing logs or documentation.
- **Log Verification:** Make it a habit to check the backend (`vectorhud.log`) and frontend console logs when an error is reported. Rely on concrete error output rather than assumptions.
- **Document Fixes:** When making security or database permission changes, always document the required whitelist/capability additions.
- **Terminal Execution:** The user's system runs PowerShell. Do NOT use `&&` to chain terminal commands, as this will fail. Use `;` instead, or run commands sequentially in separate calls.
- **Library Documentation (Context7):** Always use the Context7 MCP to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service. This includes API syntax, configuration, version migration, and library-specific debugging. Never rely solely on training data for third-party tools (e.g., Tauri v2 plugins).