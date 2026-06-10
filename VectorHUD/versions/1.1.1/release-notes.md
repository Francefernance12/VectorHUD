# VectorHUD v1.1.1 🚀

This patch release addresses critical bugs in timer/stopwatch boot logic, video range request playback in recent captures, and cleans up settings options.

---

## 🔧 Bug Fixes

* **Timer finished toast**: Added boot-time resetting for countdown and stopwatch states, preventing the timer finished toast notification from appearing repeatedly when opening the app/overlay for the first time.
* **Video capture range requests**: Normalized all file paths to use forward slashes (`/`) instead of backslashes (`\`) on Windows when inserting into the database and loading. This fixes a WebView2 issue where range requests (needed for video seeking/loading) failed, resolving broken/unplayable standard video files in the "Recent Captures" gallery modal.
* **Settings cleanup**: Removed the unused "Replay Buffer Resolution" and "Replay Buffer FPS" configurations from the Settings UI.
* **Version bump**: Bounded project version to `1.1.1` in configuration and package files.
