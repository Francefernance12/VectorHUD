# VectorHUD v1.2.1 🚀

This release introduces layout fixes to prevent clipping and squishing, along with a comprehensive mock testing suite for cross-platform robustness.

## Key Features & Enhancements

### 1. App Mixer Layout Polish
- Removed fixed height constraints from the App Mixer session list in `AudioHubWidget` to allow it to dynamically expand and utilize the widget's native scrollbar.

### 2. Hardware Widget Tooltip
- Repositioned the CPU temperature help tooltip to be relative to the outer CPU section container rather than an inline text span, preventing layout clipping and obscuring of the helper.

### 3. Hotkey Settings Cards Re-layout
- Converted hotkey record containers to a vertical stack so keybind text displays and record/cancel buttons scale cleanly without squishing when the global font size is increased.

### 4. Cross-Platform Automated Testing
- Created a new suite of 15 unit tests covering the core UI components without native Windows dependencies, ensuring all widgets compile and execute successfully on any OS.
