# Future Implementations

## Secure Credential Storage

For the initial alpha build, the VectorHUD overlay reads sensitive credentials (OpenRouter API keys, Notion tokens) from a local `.env` file for ease of development. However, for a consumer-facing release, we will transition to a secure, in-app credential manager.

### The Problem with Master Passwords
Using tools like `tauri-plugin-stronghold` typically requires a master password to unlock the secure enclave. For an overlay designed to be entirely frictionless and invisible until invoked, prompting the user for a password on boot ruins the UX.

### Proposed Architecture (Session 5B+)
To balance security with UX, we will:
1. Build a **Settings Modal UI** inside the React frontend where users can paste their API keys.
2. Implement **Windows Machine ID Encryption** (via the `machine-uid` crate) on the Rust backend.
3. When the user saves an API key, Rust encrypts it using the Machine ID as the master key and saves it to the SQLite `vectorhud.db`.
4. On boot, the Rust backend automatically fetches the Machine ID, decrypts the tokens, and stores them in memory for active sessions.

This ensures that even if the `vectorhud.db` file is stolen or copied to another PC, the API keys remain encrypted and inaccessible, while providing a zero-interaction boot process for the legitimate user.

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
