# VectorHUD v1.1.2 🚀

This patch release resolves the issue where video recordings and clips failed to load or play in production builds.

---

## 🔧 Bug Fixes

* **Video Playback in Production**: Added `media-src 'self' asset: http://asset.localhost` to the WebView's Content Security Policy (CSP). This resolves the issue where `<video>` elements were blocked from loading local files served by Tauri's custom asset protocol in production builds.
* **Version Bump**: Bounded project version to `1.1.2` in configuration and package files.
