# VectorHUD Journey & Lessons Learned

This document records the architectural evolutions, key engineering battles, and technical solutions developed during the development of VectorHUD.

---

## 1. The Replay Buffer Memory Battle (Session 16.5 & 17)

### The Problem
Our initial implementation of the 30-second rolling replay buffer was built entirely inside our custom Rust `windows-record` crate. It captured frames from the DXGI Desktop Duplication API and kept them in a circular buffer in memory. Because raw frame textures are massive, this caused RAM usage to spike past **3.6GB** within minutes, introducing system lag and compositor stalls.

### The Solution: Hybrid Capture Engine
We shifted to a Hybrid Capture Engine:
* **Screenshots & Standard Video**: Continued using the native Windows APIs (DXGI and Media Foundation in the `windows-record` crate) because standard recordings encode and stream frames to disk on-the-fly, and screenshots are single frames. This keeps their memory footprint near zero.
* **30-second Replay Buffer**: Offloaded to a sidecar `ffmpeg.exe` process utilizing its HTTP Live Streaming (HLS) segmentation muxer. FFmpeg writes compressed `.ts` video slices to a temporary directory on the disk and maintains a rolling 15-segment (30 seconds total) playlist. This capped the replay buffer's RAM footprint at a constant **~40MB**.

---

## 2. HDR Washout and CPU Reinhard Tone-Mapping (Session 16 & 18)

### The Problem
When capturing frames on HDR-enabled displays on Windows, the resulting screenshots and videos appeared extremely washed out, dark, or overexposed. This is because Windows' Desktop Window Manager (DWM) automatically applies SDR content brightness curves to tone-map the desktop output, and simple color space casts lost the high-dynamic-range detail.

### The Solution: Raw scRGB DuplicateOutput1
We modified the capture logic to request linear float16 scRGB data from DXGI:
1. Replaced the standard DXGI duplication with `IDXGIOutput5::DuplicateOutput1` requesting the `DXGI_FORMAT_R16G16B16A16_FLOAT` format.
2. We pull the raw HDR signal directly from the GPU.
3. Created a fast CPU-based Reinhard tone-mapping and sRGB gamma correction pass inside `dxgi.rs` to compress HDR colors back to SDR range before encoding or saving:
   * **Linear range (`v <= 0.8`)** is kept linear, maintaining perfect brightness for standard desktop windows and overlays.
   * **Highlight range (`v > 0.8`)** is compressed using a soft-knee curve: `0.8 + 0.2 * ((v - 0.8) / (0.2 + (v - 0.8)))`.
This resulted in bright, vibrant, color-accurate screenshots and recordings.

---

## 3. WebView2 range requests and path normalization (v1.1.1)

### The Problem
In the unified gallery modal, recorded video clips and replay clips failed to load or seek. Opening the WebView2 developer tools revealed range request errors (`HTTP 404 / 416` or protocol block) when loading `asset://` URLs.

### The Solution: Forward Slashes on Windows
Tauri's custom `asset` protocol serves local files into the WebView. While Windows natively accepts backslashes (`\`) for file system operations, WebView2 strictly requires forward slashes (`/`) for URLs and range requests. We normalized all file paths by replacing backslashes with forward slashes (`path.replace(/\\/g, '/')`) before inserting records into SQLite and loading them. This allowed WebView2 to successfully handle range requests for streaming video files.

---

## 4. WebView2 Content Security Policy (v1.1.2)

### The Problem
Even after path normalization, video clips worked perfectly in the `tauri dev` server environment, but broke completely when packaged in the production installer. 

### The Solution: media-src whitelisting
In production, Tauri strictly enforces the Content Security Policy (CSP). The CSP in `tauri.conf.json` had:
```
img-src 'self' asset: http://asset.localhost data:
```
which allowed screenshots to load via `<img>` tags. However, `<video>` tags are governed by `media-src`. Because `media-src` was undefined, it fell back to the restrictive `default-src 'self'` directive, blocking the custom asset protocol.
Adding `media-src 'self' asset: http://asset.localhost;` to the CSP resolved all production video loading issues.
