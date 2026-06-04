# Future Implementations

## UI / UX Themes and Dock Polishing

During Session 14, we recognized that while the glassmorphism UI is functional, it could be extended.
1. Add a **Theme Engine** allowing users to switch the widget backdrop between Light Mode, Dark Mode, and True Black.
2. Refine the **Dock animations** so that hovering over the master dock creates a macOS-like icon scale effect using Framer Motion.

## Mouse Cursor Capture in Video Recording

Currently, the `windows-record` crate captures the raw DXGI Output, which does not naturally contain the hardware mouse cursor. 
To implement this in the future:
1. We must periodically query the cursor position using `GetCursorInfo`.
2. Extract the cursor icon (often via `GetIconInfo`) and convert it to a texture or draw it directly onto the D3D11 staging texture.
3. Handle cursor state changes (hidden, custom game cursors, resizing).
This was delayed to avoid introducing new bugs during the Session 7 backend integration phase.

## Discord Webhook Integration (Social Sharing)

To enhance the social gaming experience, we will add a Discord Webhook integration.
1. Add a setting for the user to input a Discord Channel Webhook URL.
2. Add a "Share to Discord" button in the Media Capture widget.
3. Upon clicking, the Rust backend will automatically package the screenshot or replay video and execute a POST request directly to the Discord Webhook.
This allows the user to instantly share clips and highlights with their friends without ever needing to Alt-Tab out of their game to open the Discord desktop app.
