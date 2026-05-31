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
