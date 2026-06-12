# VectorHUD AI Actions & Capabilities 🧠

VectorHUD's built-in AI chat widget (`OpenRouterWidget`) supports **Function Calling (Tool Use)**. This allows the AI model (Gemini, GPT, Claude, or Llama) to interact directly with the Tauri overlay frontend and Rust backend. 

When you ask the AI to perform a system action or query status information, it translates your request into a structured tool call.

---

## 🛠️ List of AI Actions & Skills

The AI has access to the following 13 functional tools:

### 1. Audio Control
* **`set_master_volume`**
  * *Description:* Set the system master volume.
  * *Parameters:* `volume_percent` (integer, 0 to 100).
  * *Prompt Examples:* *"Set volume to 50%"*, *"Turn it down to 10%"*, *"Set volume to 0.7"* (automatically scaled to 70%).

* **`toggle_master_mute`**
  * *Description:* Toggle the system mute state.
  * *Parameters:* None.
  * *Prompt Examples:* *"Mute the audio"*, *"Toggle mute"*, *"Unmute the system"*.

### 2. Media Playback
* **`media_control`**
  * *Description:* Control media playback.
  * *Parameters:* `command` (string: `"play_pause"`, `"next"`, `"prev"`).
  * *Prompt Examples:* *"Pause the music"*, *"Skip to the next song"*, *"Play the music"*, *"Go back a track"*.

* **`get_active_media_and_app`**
  * *Description:* Query details about what application or game is active and what media is currently playing.
  * *Parameters:* None.
  * *Returns:* Active application name, fullscreen state, whether it is favorited, list of favorited audio apps, and the current SMTC media metadata (title, artist, album, is_playing).
  * *Prompt Examples:* *"What game am I playing right now?"*, *"What song is this?"*, *"Check the media widget for status"*.

### 3. Capture & Recording Utility
* **`capture_screenshot`**
  * *Description:* Take a silent screenshot of the primary monitor and save it to the capture gallery.
  * *Parameters:* None.
  * *Prompt Examples:* *"Take a screenshot"*, *"Capture the screen silently"*, *"Snap a screenshot"*.

* **`start_video_recording`**
  * *Description:* Start recording a standard video of the primary monitor. Optionally, set a duration in seconds after which the recording will automatically stop.
  * *Parameters:* `duration_seconds` (integer, optional).
  * *Prompt Examples:* *"Start recording"*, *"Record video for 2 minutes"*, *"Start recording, stop in 30 seconds"*.

* **`stop_video_recording`**
  * *Description:* Stop the current standard video recording and save it to the capture history/gallery.
  * *Parameters:* None.
  * *Prompt Examples:* *"Stop recording"*, *"Stop the video capture"*, *"End standard recording"*.

* **`save_replay_clip`**
  * *Description:* Save a 30-second rolling replay buffer clip to the capture history/gallery (the replay buffer widget must be active).
  * *Parameters:* None.
  * *Prompt Examples:* *"Save replay clip"*, *"Clip that!"*, *"Save the last 30 seconds of gameplay"*.

### 4. Utilities (Timer & Stopwatch)
* **`start_timer`**
  * *Description:* Start a countdown timer.
  * *Parameters:* `duration_seconds` (integer, minimum: 1).
  * *Prompt Examples:* *"Start a 5 minute timer"*, *"Set a timer for 90 seconds"*, *"Timer for 10 minutes"*.

* **`reset_timer`**
  * *Description:* Reset the countdown timer.
  * *Parameters:* None.
  * *Prompt Examples:* *"Reset the timer"*, *"Stop the timer"*.

* **`control_stopwatch`**
  * *Description:* Start, pause, or reset the stopwatch.
  * *Parameters:* `command` (string: `"start"`, `"pause"`, `"reset"`).
  * *Prompt Examples:* *"Start the stopwatch"*, *"Pause stopwatch"*, *"Reset the stopwatch"*.

### 5. System Diagnostics & Telemetry
* **`get_hardware_metrics`**
  * *Description:* Retrieve real-time CPU, RAM, GPU, VRAM, and game FPS telemetry metrics.
  * *Parameters:* None.
  * *Prompt Examples:* *"How is my system doing?"*, *"What is my current FPS and GPU usage?"*, *"Show hardware metrics"*.

### 6. Notion Database Integration
* **`fill_notion_draft`**
  * *Description:* Populate the Notion note draft form fields in the overlay widget. Can also merge/append new task checkboxes to the draft checklist.
  * *Parameters:* `title` (string), `description` (string), `content` (string), `tasks` (array of strings).
  * *Prompt Examples:* *"Fill my Notion draft with Title: 'Patch Notes' and subtasks 'Fix bugs', 'Update version'"*, *"Add a checklist item 'Read logs' to the draft note"*.

* **`list_notion_tasks`**
  * *Description:* List the latest notes or tasks currently loaded in the synced Notion database.
  * *Parameters:* `limit` (integer, default: 10).
  * *Prompt Examples:* *"List my latest 5 Notion tasks"*, *"What are my active Notion notes?"*.

* **`search_notion_tasks`**
  * *Description:* Search for specific entries or tasks in the synced Notion database using a query string.
  * *Parameters:* `query` (string).
  * *Prompt Examples:* *"Search my notes for 'meeting'"*, *"Find tasks containing 'AI'"*.

* **`query_notion_db`**
  * *Description:* Advanced querying, filtering, and sorting of the Notion database.
  * *Parameters:* `query` (string), `status` (string), `sort_by` (string: `"date"`, `"title"`, `"status"`), `sort_order` (string: `"asc"`, `"desc"`), `limit` (integer).
  * *Prompt Examples:* *"Find all 'In progress' tasks sorted by title"*, *"Sort my notes by date in ascending order"*.

---

## 🔒 Security & Privacy

1. **Local Execution**: All tool execution logic resides strictly in the local React app. No external servers or API calls are used to process these functions other than sending the JSON-formatted tool definition to the configured LLM API endpoint (e.g. OpenRouter, OpenAI, Anthropic, or Groq).
2. **Focus Protection**: Capture operations temporarily flag the overlay to ignore window focus loss to prevent DWM borders or z-index demotion bugs.
3. **Draft Preservation**: Notion draft functions are built defensively to merge items instead of overwriting, preventing accidental data loss.
