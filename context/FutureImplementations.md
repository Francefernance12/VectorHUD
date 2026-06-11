# Future Implementations

---

## ~~UI / UX Themes and Dock Polishing~~
* ~~During Session 14, we recognized that while the glassmorphism UI is functional, it could be extended.~~
* ~~1. Add a **Theme Engine** allowing users to switch the widget backdrop between Light Mode, Dark Mode, and True Black.~~
* ~~2. Refine the **Dock animations** so that hovering over the master dock creates a macOS-like icon scale effect using Framer Motion.~~

---

## ~~Mouse Cursor Capture in Video Recording~~
* ~~Currently, the `windows-record` crate captures the raw DXGI Output, which does not naturally contain the hardware mouse cursor.~~
* ~~To implement this in the future:~~
  * ~~1. We must periodically query the cursor position using `GetCursorInfo`.~~
  * ~~2. Extract the cursor icon (often via `GetIconInfo`) and convert it to a texture or draw it directly onto the D3D11 staging texture.~~
  * ~~3. Handle cursor state changes (hidden, custom game cursors, resizing).~~
  * ~~This was delayed to avoid introducing new bugs during the Session 7 backend integration phase.~~

---

## 1. AI Vision & Chat Widget Improvements

### Markdown Formatting & Layout Overflow
* **The Problem**: When the LLM outputs long Markdown blocks (e.g., code fences, tables, blockquotes), the chat bubble overflows horizontally. This squishes other UI elements and stretches the layout, pushing action buttons out of boundaries.
* **Solution**: 
  * Apply a strict `max-w-full` constraint on chat bubbles with `word-break: break-word` and `white-space: pre-wrap` for normal text.
  * For code blocks (`pre`, `code`), wrap them in a container with `overflow-x: auto` to enable horizontal scrolling for long code lines without stretching the parent bubble.
  * Use `react-markdown` with specific renderers to format headings, bullet lists, and tables with clean HUD wireframe styling.
* **Styling & Text Selection**:
  * Style the markdown box to look like a terminal window with dark translucent code block headers and a "Copy Code" button.
  * Enforce `user-select: text` inside the chat messages to allow users to highlight and copy partial text (currently, the global click-through/drag overrides sometimes block selection).

### AI Widget Interactivity (App-Driven Actions)
* **The Problem**: How to let the AI interact with other HUD widgets (e.g., setting a timer, playing music) efficiently without incurring massive token costs.
* **Solution**: Use OpenRouter's support for **Function Calling / Tools**. We define a strict schema of available system commands. Instead of sending the entire codebase or constantly streaming state, we only send context when relevant (on-demand prompt construction).
* **Supported Actions**:
  1. **Media Playback**: `control_media(action: 'play' | 'pause' | 'next' | 'prev' | 'volume_up' | 'volume_down' | 'favorite')`.
  2. **Notion Sync**: `create_notion_note(title, description, content, tasks: string[])`.
     * *Async Note Search*: `search_notion_notes(query)`. Since database queries take time, we implement an async wait pattern where React displays a "Searching Notion..." bubble while awaiting the backend IPC, preventing LLM timeouts.
  3. **Hardware telemetry**: `get_hardware_specs() -> (CPU, GPU, RAM, VRAM, active game)`.
  4. **Timer/Stopwatch control**: `setup_timer(minutes, seconds, auto_start: bool)`.
  5. **Auto Capture**: `trigger_capture(type: 'screenshot' | 'video', duration_seconds: Option<u32>)` (e.g. "record the next 15 seconds").

### Resilient Chat Persistence
* **The Problem**: Toggling the HUD overlay hides the window. If the React tree unmounts or state resets, ongoing LLM stream requests are aborted or lost.
* **Solution**: Manage the active chat session state and ongoing fetch promises in the global Zustand store (`openRouterStore.ts`). When the window loses focus or is dismissed via hotkey, the WebView remains active in the background. The stream continues to write to Zustand, allowing the response to be fully present when the user summons the overlay again.

### Dynamic AI Providers & Custom Models
* **The Problem**: Switching LLM models previously cleared the chat history. Additionally, some models (like Google's Gemini 2.5 Flash on OpenRouter) are **not** free, despite previous assumptions.
* **Solution**:
  * Decouple the chat message log history from the active model selection so threads survive model toggles.
  * Add support for multiple AI providers (OpenAI, Anthropic, Groq) with dynamic system prompt generation tailored to each provider's formatting/token needs.
  * Add a settings option allowing users to input their own custom OpenRouter model IDs.

### Chat Sidebar & Search
* Add a search bar to filter chat history by title or content.
* Make the chat session list sidebar horizontally resizable (draggable edge) to prevent long thread titles from being squished.

### Push-to-Talk Global Voice Assistant
* **Mechanism**: Bind a global hotkey (e.g., `Ctrl + Alt + V`).
  * *Press and Hold*: Activates microphone recording and displays a recording overlay.
  * *Release*: Stops recording, transcribes the audio (via lightweight local Whisper bindings or OpenRouter transcribing), submits it directly to the AI, and closes the overlay.
  * *Response*: The AI's response is displayed as a transient HUD toast message at the top of the screen that automatically fades away after 5-8 seconds.

---

## 2. Settings Widget Polish

### Dropdown Blink Fix
* **The Problem**: The settings dropdown menu for choosing LLM models sometimes blinks (instantly opens and closes) when clicked.
* **Solution**: Resolve the race condition in the React event loop by preventing the click handler from bubbling up and triggering the document-level "click-outside-to-close" listener.

### Keybind Recorder
* **The Problem**: Users currently have to type out hotkey strings manually (e.g., `ctrl+alt+o`).
* **Solution**: Implement a visual Keybind Recorder input. When clicked, it listens to the browser `keydown` events, captures the pressed combination (modifiers like Ctrl/Alt/Shift + key), and automatically formats and binds it.

### Color Theme Dock Outlines
* **The Problem**: SVG outlines and glow borders on the main dock container occasionally fail to update when changing themes.
* **Solution**: Bind the SVG stroke/filter properties directly to the dynamic Tailwind CSS variables (`var(--accent-green)`) and use state-driven CSS classes rather than hardcoded inline values.

---

## 3. Audio Mixer Hardening

### Enumerate All Endpoints (Wuthering Waves Fix)
* **The Problem**: Elevated games (running as Admin, like Wuthering Waves) or games playing on non-default audio devices do not show up in the audio mixer list.
* **Solution**:
  * Instead of only querying the default audio endpoint (`IMMDeviceEnumerator::GetDefaultAudioEndpoint`), enumerate sessions across **all active render endpoints**.
  * **Elevation Bypass**: When a game runs as Administrator, opening its process to query the process name fails under UAC, returning "Unknown". We will implement a fallback that queries process metadata from Windows system process lists by matching the PID, ensuring elevated games are correctly named.

---

## 4. Timer / Stopwatch Enhancements

### Specific Start Times
* **The Problem**: The timer can only be started from general presets.
* **Solution**: Add direct numeric input fields (or sliders) in the Timer widget to allow the user to input precise minutes and seconds for a custom countdown duration.

---

## 5. Discord Webhook Integration (Social Sharing)

* **Features**:
  1. Add a setting for the user to input a Discord Channel Webhook URL.
  2. Add a "Share to Discord" button in the Media Capture widget.
  3. Upon clicking, the Rust backend will automatically package the screenshot or replay video and execute a POST request directly to the Discord Webhook.
  * *Pros*: Zero gameplay interruption, instant sharing, no need to Alt-Tab.
  * *Cons*: Requires active internet connection, webhook rate limits.
