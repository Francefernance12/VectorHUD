# Data Flow & Decisions Document

## The Communication Bridge
Tauri uses an asynchronous Inter-Process Communication (IPC) bridge.
- **Frontend to Backend:** React calls `invoke('command_name', { payload })`.
- **Backend to Frontend:** Rust uses `app_handle.emit("event_name", payload)` to push data.

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

## External Integration Flow (OpenRouter / Notion)
1. User interacts with an AI widget (e.g. types a chat message).
2. The React component sets a loading state and calls the external API directly using `fetch`.
3. Due to Tauri v2 defaults, this fetch will fail unless the domain is whitelisted in `tauri.conf.json` under the `security.csp` `connect-src` directive.
4. The response streams back to React, updating the component's state iteratively.

## Database Flow
1. At the end of a session, Zustand packages the session analytics.
2. React invokes `save_session_analytics(data)`.
3. Rust securely opens the local SQLite connection and executes an `INSERT` statement.