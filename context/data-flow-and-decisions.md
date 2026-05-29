# Data Flow & Decisions Document

## The Communication Bridge
Tauri uses an asynchronous Inter-Process Communication (IPC) bridge.
- **Frontend to Backend:** React calls `invoke('command_name', { payload })`.
- **Backend to Frontend:** Rust uses `app_handle.emit_all("event_name", payload)` to push data.

## Metrics Data Flow
1. Rust background thread wakes up every 1000ms.
2. Rust polls the OS for CPU/GPU data.
3. Rust checks if the new data differs significantly from the last poll.
4. If changed, Rust emits a `hardware-metrics-update` event.
5. Zustand store in React listens for this event and updates its state.
6. The active Widget re-renders with the new data.

## Logging Data Flow
1. An error occurs in a React component.
2. The React Error Boundary catches it.
3. React invokes the Rust command `log_frontend_error(message, stack_trace)`.
4. Rust receives the payload and writes it to `overlay-daily.log` via the `tracing-appender` crate.

## Database Flow
1. At the end of a session, Zustand packages the session analytics.
2. React invokes `save_session_analytics(data)`.
3. Rust securely opens the local SQLite connection and executes an `INSERT` statement.