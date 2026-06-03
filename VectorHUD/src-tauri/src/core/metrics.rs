use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use sysinfo::System;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct HardwareMetrics {
    pub cpu_usage: f32,
    pub ram_usage_percent: f32,
    pub ram_total_gb: f32,
    pub ram_used_gb: f32,
    pub gpu_usage: f32,
    pub vram_usage_percent: f32,
    pub vram_used_gb: f32,
    pub fps: u32,
    pub active_app: Option<String>,
    pub is_fullscreen: Option<bool>,
}

#[cfg(windows)]
fn get_foreground_info() -> (Option<String>, Option<bool>) {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetSystemMetrics, GetWindowRect, GetWindowTextW, SM_CXSCREEN,
        SM_CYSCREEN,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return (None, None);
        }

        let mut title: [u16; 512] = [0; 512];
        let len = GetWindowTextW(hwnd, &mut title);
        let active_app = if len > 0 {
            String::from_utf16_lossy(&title[..len as usize])
        } else {
            return (None, None);
        };

        let mut rect = windows::Win32::Foundation::RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };
        let mut is_fs = false;
        if GetWindowRect(hwnd, &mut rect).as_bool() {
            let width = rect.right - rect.left;
            let height = rect.bottom - rect.top;
            let screen_w = GetSystemMetrics(SM_CXSCREEN);
            let screen_h = GetSystemMetrics(SM_CYSCREEN);
            is_fs = width >= screen_w && height >= screen_h;
        }

        (Some(active_app), Some(is_fs))
    }
}

#[cfg(not(windows))]
fn get_foreground_info() -> (Option<String>, Option<bool>) {
    (None, None)
}

#[cfg(windows)]
fn get_vram_info() -> (f32, f32) {
    use windows::core::ComInterface;
    use windows::Win32::Graphics::Dxgi::*;

    unsafe {
        if let Ok(factory) = CreateDXGIFactory1::<IDXGIFactory1>() {
            if let Ok(adapter) = factory.EnumAdapters1(0) {
                if let Ok(adapter3) = adapter.cast::<IDXGIAdapter3>() {
                    let mut memory_info = Default::default();
                    if adapter3
                        .QueryVideoMemoryInfo(0, DXGI_MEMORY_SEGMENT_GROUP_LOCAL, &mut memory_info)
                        .is_ok()
                    {
                        let used = memory_info.CurrentUsage as f32 / 1_073_741_824.0;
                        let budget = memory_info.Budget as f32 / 1_073_741_824.0;
                        let percent = if budget > 0.0 {
                            (used / budget) * 100.0
                        } else {
                            0.0
                        };
                        return (used, percent);
                    }
                }
            }
        }
    }
    (0.0, 0.0)
}

#[cfg(not(windows))]
fn get_vram_info() -> (f32, f32) {
    (0.0, 0.0)
}

/// Spawns a background thread that polls system hardware metrics every 1 second
/// and emits them to the frontend. The thread will cleanly exit when `shutdown`
/// is set to `true` (triggered on application exit).
pub fn spawn_metrics_thread(app: AppHandle, shutdown: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        tracing::info!("Hardware metrics thread started (polling every 1s)");
        let mut sys = System::new();
        // Initial refresh
        sys.refresh_cpu_usage();
        sys.refresh_memory();

        // #[cfg(windows)]
        // let wmi_con = wmi::WMIConnection::new().ok();

        let mut last_valid_app: Option<String> = None;
        let mut last_valid_fs: Option<bool> = None;

        loop {
            // Check if the application has requested shutdown
            if shutdown.load(Ordering::Relaxed) {
                tracing::info!("Hardware metrics thread received shutdown signal — exiting");
                break;
            }

            // Refresh CPU and memory
            sys.refresh_cpu_usage();
            sys.refresh_memory();

            let cpu_usage = sys.global_cpu_usage();

            let total_memory = sys.total_memory(); // bytes
            let used_memory = sys.used_memory(); // bytes

            let total_gb = total_memory as f32 / 1_073_741_824.0;
            let used_gb = used_memory as f32 / 1_073_741_824.0;

            let ram_percent = if total_gb > 0.0 {
                (used_gb / total_gb) * 100.0
            } else {
                0.0
            };

            let gpu_usage = 0.0; // TODO: Implement GPU polling without breaking COM (WMI causes WebView2 crash)

            let (vram_used_gb, vram_usage_percent) = get_vram_info();
            let fps = 0; // TODO: Implement FPS polling

            let (current_app, current_fs) = get_foreground_info();

            // If the active app is our overlay, ignore it and keep the previous app state
            let (active_app, is_fullscreen) = if let Some(ref app_name) = current_app {
                if app_name.contains("VectorHUD") || app_name.to_lowercase().contains("vectorhud") {
                    (last_valid_app.clone(), last_valid_fs)
                } else {
                    last_valid_app = current_app.clone();
                    last_valid_fs = current_fs;
                    (current_app, current_fs)
                }
            } else {
                last_valid_app = None;
                last_valid_fs = None;
                (None, None)
            };

            let metrics = HardwareMetrics {
                cpu_usage,
                ram_usage_percent: ram_percent,
                ram_total_gb: total_gb,
                ram_used_gb: used_gb,
                gpu_usage,
                vram_usage_percent,
                vram_used_gb,
                fps,
                active_app,
                is_fullscreen,
            };

            // Emit the event to the frontend
            let _ = app.emit("hardware-metrics-update", metrics);

            // Wait 1 second before polling again
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}
