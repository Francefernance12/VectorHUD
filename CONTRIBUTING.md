# Contributing to VectorHUD 🎮

Thank you for your interest in contributing to VectorHUD! We welcome all contributions, from bug reports and feature suggestions to documentation and code changes.

Please read through this guide to understand our development workflow and codebase standards.

---

## 🚀 Getting Started

### Prerequisites
To build and run VectorHUD locally, you will need:
- **Node.js** (v18 or higher)
- **Rust** (latest stable toolchain)
- **C++ Build Tools** for Visual Studio 2022 (with "Desktop development with C++" workload installed)
- **Windows 10 or 11** (required for native capturing and desktop duplication APIs)

### Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/Francefernance12/VectorHUD.git
   cd VectorHUD/VectorHUD
   ```
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the application in development mode:
   ```bash
   npm run dev
   # Or run via Tauri CLI
   npm run tauri dev
   ```

---

## 🌿 Git Workflow & Branching

We enforce a strict **Session-Based / Spec-Driven branching strategy** to track development units and AI executions cleanly.

### Branch Naming Conventions
- For new features: `Session-<Number><Letter>-<FeatureName>` (e.g., `Session-22-Docs-Organization`)
- For bug fixes: `fix/<IssueName>` or `Session-<Number>-Fix-<Name>`
- **`main`** is our stable branch and should always compile, pass all tests, and run cleanly.

### Pre-commit Hooks & Formatting
We use **Husky** and **lint-staged** to run formatting and linting checks prior to allowing any commit.
- **Do not bypass hooks** (avoid `git commit --no-verify`) as it prevents broken builds on remote pipelines.
- Code style is automatically enforced on the Rust backend:
  - `npm run format:rust` (runs `cargo fmt`)
  - `npm run lint:rust` (runs `cargo clippy -D warnings` to enforce warning-free compilations)
- Frontend files should be clean of lint errors and follow standard TypeScript style.

---

## 🧪 Testing Guidelines

Before committing your changes, you must verify that all automated tests compile and pass.

### Frontend Tests (Vitest)
Verify the React/TypeScript components and Zustand store logic:
```bash
npm run test
```

### Backend Tests (Cargo)
Verify Rust telemetry, audio mixers, and recorder logic:
```bash
cargo test
```

Ensure all tests pass successfully before pushing or opening a Pull Request.

---

## 📜 Code Standards

When writing code, keep these rules in mind:
- **Strict Typing:** Never use `any` in TypeScript. Catch blocks should use `catch (err: unknown)` and sanitize/format errors.
- **Mutex Safety:** Never use `.unwrap()` on Mutexes. Use `.unwrap_or_else(|e| e.into_inner())` to recover gracefully if a thread panics.
- **API Boundaries:** Frontend code should not directly query external networks. Instead, route API calls through backend Rust commands (using Tauri `invoke`) to secure credentials and manage CSP bounds.
- **Centralized Logging:** Catch frontend errors and forward them to the backend tracing logs using the `frontend_log` commands.

---

## 🤝 Submitting a Pull Request

1. Fork the repository and create your branch from `main`.
2. Implement your changes, ensuring new logic includes unit tests where appropriate.
3. Keep your commits atomic, well-formatted, and write clear descriptions.
4. Run all local tests and lints (`npm run check:all` and `npm run test`).
5. Open a Pull Request against our `main` branch.

Thank you for helping make VectorHUD better!
