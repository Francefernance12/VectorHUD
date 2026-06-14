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
* **Solutions & Tradeoffs**:
  * **Option A (Max-Width + Scroll)**: Apply a strict `max-w-full` constraint on chat bubbles with `word-break: break-word` and `white-space: pre-wrap`. For code blocks (`pre`, `code`), wrap them in a container with `overflow-x: auto` to enable horizontal scrolling.
    * *Pros*: Keeps the overall chat box compact, looks professional, easy to read.
    * *Cons*: User has to scroll horizontally to read long lines of code.
  * **Option B (Auto-Wrapping Code)**: Force all code blocks to wrap text.
    * *Pros*: No horizontal scrolling required.
    * *Cons*: Breaks code formatting/indentation, making it hard to copy-paste cleanly.
  * *Selection*: **Option A** is the most flexible and standard approach.
* **Styling & Text Selection**:
  * Style the markdown box to look like a terminal window with dark translucent code block headers and a "Copy Code" button.
  * Enforce `user-select: text` inside the chat messages to allow users to highlight and copy partial text.
* **Situational Example**: A developer asks the AI: *"Write a PowerShell script to clean up temp files."* The code block is rendered with a dark background, syntax highlighting, and a scrollbar, preventing it from blowing up the width of the game overlay. The developer can highlight just the specific `Remove-Item` line to copy, or copy the entire script using the button.

### AI Widget Interactivity (App-Driven Actions)
* **The Problem**: How to let the AI interact with other HUD widgets (e.g., setting a timer, playing music) efficiently without incurring massive token costs.
* **Solution**: Use OpenRouter's support for **Function Calling / Tools**. We define a strict JSON schema of available system commands. Instead of sending the entire codebase, we construct the prompt on-demand.
* **Supported Actions**:
  1. **Media Playback**: `control_media(action: 'play' | 'pause' | 'next' | 'prev' | 'volume_up' | 'volume_down' | 'favorite')`.
  2. **Notion Notes Sync**: `create_notion_note(title, description, content, tasks: string[])`.
     * *Async Note Search*: `search_notion_notes(query)`. Since database queries take time, we implement an async wait pattern where React displays a "Searching Notion..." bubble while awaiting the backend IPC, preventing LLM timeouts.
  3. **Hardware telemetry**: `get_hardware_specs() -> (CPU, GPU, RAM, VRAM, active game)`.
  4. **Timer/Stopwatch control**: `setup_timer(minutes, seconds, auto_start: bool)`.
  5. **Auto Capture**: `trigger_capture(type: 'screenshot' | 'video', duration_seconds: Option<u32>)`.
* **Pros & Cons**:
  * *Pros*: Extremely interactive, makes the overlay feel alive, automates multi-step processes via voice/chat.
  * *Cons*: Increases API call latency slightly; requires robust error handling on the backend.
* **Situational Example**: While in the middle of a raid, the player says: *"Set a timer for 5 minutes and record a clip."* The AI executes the tool calls. The timer widget immediately starts counting down from 05:00 on the HUD, and the video recording starts, saving the clip automatically without the player opening settings.

### Resilient Chat Persistence
* **The Problem**: Toggling the HUD overlay hides the window. If the React tree unmounts or state resets, ongoing LLM stream requests are aborted or lost.
* **Solution**: Manage the active chat session state and ongoing fetch promises in the global Zustand store (`openRouterStore.ts`). When the window loses focus or is dismissed via hotkey, the WebView remains active in the background. The stream continues to write to Zustand, allowing the response to be fully present when the user summons the overlay again.
* **Situational Example**: The user asks the AI a complex question and immediately closes the overlay with `Ctrl+Alt+O` to resume their game. When they reopen it a minute later, the complete answer is loaded and ready, rather than showing a broken connection error.

### Dynamic AI Providers & Custom Models
* **The Problem**: Switching LLM models previously cleared the chat history. Additionally, some models (like Google's Gemini 2.5 Flash on OpenRouter) are **not** free, despite previous assumptions.
* **Solution**:
  * Decouple the chat message log history from the active model selection so threads survive model toggles.
  * Add support for multiple AI providers (OpenAI, Anthropic, Groq) with dynamic system prompt generation tailored to each provider's formatting/token needs.
  * Add a settings option allowing users to input their own custom OpenRouter model IDs.
* **Situational Example**: A developer switches from a lightweight fast model to a reasoning model to analyze a bug. The chat history stays intact, letting the new model see the full context of the discussion.

### Chat Sidebar & Search
* Add a search bar to filter chat history by title or content.
* Make the chat session list sidebar horizontally resizable (draggable edge) to prevent long thread titles from being squished.
* **Situational Example**: A user has dozens of past sessions and wants to find the one where they brainstormed game specs. They search for "specs" in the sidebar and quickly locate the chat.

### Push-to-Talk Global Voice Assistant (Voice PTT)
* **Mechanism**: Bind a global hotkey (e.g., `Ctrl + Alt + V`).
  * *Press and Hold*: Activates microphone recording and displays a recording overlay.
  * *Release*: Stops recording, transcribes the audio, submits it directly to the AI, and closes the overlay.
  * *Response*: The AI's response is displayed as a transient HUD toast message at the top of the screen that automatically fades away after 5-8 seconds.
* **Pros & Cons**:
  * *Pros*: Ultimate hands-free control, zero screen pollution, extremely immersive.
  * *Cons*: Requires background audio recording permissions; requires clear speech in noisy game environments.
* **Situational Example**: The player is in borderless mode and wants to know their CPU temperature. They hold `Ctrl+Alt+V`, say *"Check my specs"*, and release. A small toast appears at the top: *"GPU at 68°C, CPU at 54°C (Normal)"*, then disappears, leaving the screen clean.

---

## 2. Settings Widget Polish

### Dropdown Blink Fix
* **The Problem**: The settings dropdown menu for choosing LLM models sometimes blinks (instantly opens and closes) when clicked.
* **Solution**: Resolve the race condition in the React event loop by preventing the click handler from bubbling up and triggering the document-level "click-outside-to-close" listener.

### Keybind Recorder
* **The Problem**: Users currently have to type out hotkey strings manually (e.g., `ctrl+alt+o`).
* **Solution**: Implement a visual Keybind Recorder input. When clicked, it listens to the browser `keydown` events, captures the pressed combination (modifiers like Ctrl/Alt/Shift + key), and automatically formats and binds it.
* **Situational Example**: Instead of typing `"ctrl+shift+a"`, the user clicks the hotkey box, presses `Ctrl+Shift+A` on their keyboard, and the field is instantly bound and updated.

### Color Theme Dock Outlines
* **The Problem**: SVG outlines and glow borders on the main dock container occasionally fail to update when changing themes.
* **Solution**: Bind the SVG stroke/filter properties directly to the dynamic Tailwind CSS variables (`var(--accent-green)`) and use state-driven CSS classes rather than hardcoded inline values.

### Balanced Font and Widget Scaling Slider
* **The Problem**: Font size configuration currently scales the entire widget typography (including buttons, headers, inputs) uniformly. Increasing the font size to make the chat responses readable makes the buttons and inputs feel excessively large and ruins widget spacing.
* **Solution**: Implement a dedicated "Chat Font Size" slider (independent of the global HUD scaling) or a balanced widget layout scaling system in settings. This will allow scaling the readable chat body text while keeping functional elements (like buttons, title bars, and inputs) at a compact, usable size.

---

## 3. Audio Mixer Hardening

### Enumerate All Endpoints (Wuthering Waves Fix)
* **The Problem**: Elevated games (running as Admin, like Wuthering Waves) or games playing on non-default audio devices do not show up in the audio mixer list.
* **Solution**:
  * Instead of only querying the default audio endpoint (`IMMDeviceEnumerator::GetDefaultAudioEndpoint`), enumerate sessions across **all active render endpoints**.
  * **Elevation Bypass**: When a game runs as Administrator, opening its process to query the process name fails under UAC, returning "Unknown". We will implement a fallback that queries process metadata from Windows system process lists by matching the PID, ensuring elevated games are correctly named.
* **Pros & Cons**:
  * *Pros*: Resolves missing app controls, captures every game volume slider, behaves exactly like Xbox Game Bar.
  * *Cons*: Enumerating all endpoints takes more cycles; must be cached/debounced.
* **Situational Example**: The player is running Wuthering Waves as Administrator and playing Spotify on their headset. Both show up in the Audio Hub with correct names, allowing the user to turn down the game volume while keeping music loud.

---

## 4. Timer / Stopwatch Enhancements

### Specific Start Times
* **The Problem**: The timer can only be started from general presets.
* **Solution**: Add direct numeric input fields (or sliders) in the Timer widget to allow the user to input precise minutes and seconds for a custom countdown duration.
* **Situational Example**: A player wants a timer for exactly `2:45` to time an in-game item spawn. They type `2` in minutes and `45` in seconds, and click start.

---

## 5. Discord Webhook Integration (Social Sharing)

* **Features**:
  1. Add a setting for the user to input a Discord Channel Webhook URL.
  2. Add a "Share to Discord" button in the Media Capture widget.
  3. Upon clicking, the Rust backend will automatically package the screenshot or replay video and execute a POST request directly to the Discord Webhook.
* **Pros & Cons**:
  * *Pros*: Zero gameplay interruption, instant sharing, no need to Alt-Tab.
  * *Cons*: Requires active internet connection, webhook rate limits.
* **Situational Example**: A player hits a crazy clip. They open the gallery, click "Share to Discord", and the clip is uploaded straight to their group server in seconds.

---

## 6. Suggested Additions (Backlog Recommendations)

These features would complement the roadmap and improve performance and UX:

### Context Window Summarization (Token Efficiency)
* **The Concept**: As the AI reads telemetry, Notion databases, and system specs, the chat context window will grow rapidly, increasing API token costs.
* **Implementation**: Implement a background summarizer that compresses historical chat turns older than 5 messages into a brief paragraph summary, discarding raw telemetry logs from the history before sending the payload.

### Audio-Reactive HUD Outlines
* **The Concept**: Add a toggle in settings to make the dock and active widget borders pulse in brightness or scale in sync with active system audio levels.
* **Implementation**: Hook the master audio endpoint's peak meter (`IAudioMeterInformation`) in Rust and emit peak values to update SVG glow filters in React.

### Local Speech-to-Text Offline Mode
* **The Concept**: For players who value complete offline privacy or have poor internet latency, support speech-to-text without API calls.
* **Implementation**: Bundle a small Whisper GGML model and run transcription locally inside the Rust backend process.
