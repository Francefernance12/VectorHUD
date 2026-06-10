# VectorHUD v1.1.0 🚀

This release introduces major improvements to performance, media capture, hardware monitoring, and productivity tools, highlighting a new hybrid capture engine, per-application audio mixing, and zero-conflict hardware polling.

---

## 🎨 Key Features & Enhancements

### 1. GPU-Accelerated Hybrid Capture Engine
* **HDR Video Recording**: Redesigned video capturing to record raw scRGB linear float16 frames directly on the GPU using DXGI Desktop Duplication v2. Offloaded tone mapping to the GPU via Video Processor MFT (`MFVideoFormat_R16G16B16A16F`), eliminating CPU thread stalls and stabilizing memory usage at a tiny ~40MB footprint.
* **Piecewise Soft-Knee Screenshots**: Custom screenshot tone-mapping operator that keeps standard SDR elements (overlays, desktop windows) at their native brightness and high contrast while smoothly compressing HDR highlights, resolving washed-out/dark screenshots.
* **FFmpeg-Backed 30s Replay Buffer**: Constrained the keyframe GOP interval to exactly 2 seconds to output clean, rolling segments, ensuring the replay clip remains strictly limited to the last 30 seconds of gameplay.

### 2. Advanced Per-Application Audio Mixer
* **Granular Volume Controls**: Custom hooks into the Windows Core Audio API enabling users to adjust volumes on a per-application basis directly from the HUD.
* **Hardware Toggles**: Effortlessly switch audio input/output devices and toggle active microphones on-the-fly.

### 3. Zero-Conflict Hardware & FPS Telemetry
* **PDH GPU Polling**: Uses Windows Performance Data Helper (PDH) kernel bindings to poll GPU utilization, completely bypassing WMI COM conflicts that previously caused WebView2 crashes.
* **PresentMon FPS Tracking**: Headless background parsing of PresentMon64 output to track game framerates with near-zero overhead.

### 4. Notion Sync & AI Vision Chat
* **Interactive checklists**: Parsed block-level child elements in Notion to allow real-time checking/unchecking of floating checklists that sync bidirectionally.
* **OpenRouter Vision Integration**: Directly send screenshots and video frames into your AI chatbot for quick review, advice, or coding help.

### 5. Seamless Auto-Updater
* Signed and secure update binaries with cryptographic signature verification (Ed25519) to support one-click, in-app updates.

---

## 📦 Installer Files
* **NSIS Setup (`vectorhud_1.1.0_x64-setup.exe`)**: Recommeded for most users. Includes a guided installation wizard and auto-updater support.
* **MSI Package (`vectorhud_1.1.0_x64_en-US.msi`)**: Standard Windows installer package.
