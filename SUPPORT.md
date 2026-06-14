# Support Guide & Troubleshooting 🛠️

If you run into issues, need help configuring VectorHUD, or want to report bugs, this document outlines how to get assistance and resolve common problems.

---

## 🔍 Common Troubleshooting Steps

### 1. Overlay Focus & Click-Through Issues
* **Problem:** Pinned widgets intercept clicks and prevent playing games, or the taskbar covers the overlay.
* **Workaround:** 
  - When the overlay is dismissed (Dock hidden), pinned widgets enter **Ghost Mode** (passive click-through display). Ensure the overlay is fully closed by clicking the empty background or pressing `Ctrl + Alt + O`.
  - The backend re-asserts the overlay's z-order every 2 seconds. If a fullscreen game forces itself on top, toggle the overlay off and back on using `Ctrl + Alt + O` to refresh z-order.

### 2. CPU Temperature Readings Show `--°C` or Limit Warnings
* **Problem:** AMD or Intel CPU temperature displays `--°C` or warns of missing data.
* **Workaround:** Polling low-level CPU registers on Windows requires Administrator privileges. To resolve this:
  - Close VectorHUD from the System Tray.
  - Right-click the VectorHUD icon/shortcut and select **"Run as Administrator"**.
  - Review the administrative manual built into the in-app **Tutorial & Manual** tab in Settings.

### 3. GPU Temperature Alerts or Missing Telemetry
* **Problem:** GPU usage shows 0% or temperature fails to read.
* **Workaround:** 
  - Ensure NVIDIA graphics card telemetry is accessible via NVIDIA System Management Interface. VectorHUD runs a non-elevated call to `nvidia-smi` to pull GPU metrics, falling back to `sysinfo` if not available.
  - Verify your graphics drivers are up to date.

### 4. Microphone VU Meter or PTT Assistant Failures
* **Problem:** Microphone VU meter shows no activity, or PTT voice transcription fails.
* **Workaround:**
  - Open the in-app **Settings -> Hardware & Styling** tab.
  - Verify that the correct physical device is selected under the audio input dropdown.
  - Ensure the application has microphone access permissions enabled in Windows Privacy Settings.
  - The WebView2 browser instance may prompt for media permissions upon initial boot. Click "Allow" to enable peak signal visualizers.

---

## 🪵 Accessing Diagnostics Logs

All VectorHUD logs are stored locally to protect user privacy. If you experience an unexpected crash or error:
1. Open the **Settings Modal** (via Dock or settings hotkey).
2. Go to the **System Logs** tab to view a rolling monospaced feed of the latest backend trace records.
3. To view or attach the raw daily log file to bug reports, retrieve it from your system folder:
   ```
   C:\Users\<Your_Username>\AppData\Roaming\com.fernando-arias.vectorhud\logs\vectorhud.log
   ```

---

## 💬 Finding Help & Reporting Issues

* **Documentation:** Read our developer documentation in the `docs/` folder (such as `docs/guides/codebase_guide.md` and `docs/guides/ai_actions.md`).
* **Bug Reports:** Open an issue on our **[GitHub Issues](https://github.com/Francefernance12/VectorHUD/issues)** page. Please include:
  - Your Windows OS version.
  - Steps to reproduce the issue.
  - A copy of the relevant logs from the diagnostics directory (with any private API keys redacted, though the logger automatically sanitizes them).
