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
1. User interacts with an AI or Notion widget (e.g., sends a chat message, syncs notes).
2. React invokes the corresponding backend command (such as `call_ai_api` or `fetch_notion_notes`) via Tauri's IPC bridge.
3. The Rust backend receives the request, retrieves secure credentials from SQLite, and forwards the HTTP request to the external API (OpenRouter, OpenAI, Anthropic, Groq, or Notion) using `reqwest`.
4. Rust receives the response, parses the data (e.g. token usage and text for LLM calls, or block schemas for Notion), and returns it to the React frontend.
5. The Zustand store in React receives the parsed payload, updates the state, and the widget re-renders.


## Database Flow
1. At the end of a session, Zustand packages the session analytics.
2. React invokes `save_session_analytics(data)`.
3. Rust securely opens the local SQLite connection and executes an `INSERT` statement.