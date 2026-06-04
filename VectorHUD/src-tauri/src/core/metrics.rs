use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
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
    pub hud_cpu_usage: f32,
    pub hud_ram_usage_mb: f32,
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

#[cfg(windows)]
struct GpuMonitor {
    query: isize,
    counter: isize,
}

#[cfg(windows)]
impl GpuMonitor {
    fn new() -> Option<Self> {
        use windows::core::{w, PCWSTR};
        use windows::Win32::System::Performance::*;
        unsafe {
            let mut query: isize = 0;
            if PdhOpenQueryW(PCWSTR::null(), 0, &mut query) != 0 {
                return None;
            }
            let mut counter: isize = 0;
            // Query the generic GPU Engine utilization wildcard
            if PdhAddEnglishCounterW(
                query,
                w!("\\GPU Engine(*)\\Utilization Percentage"),
                0,
                &mut counter,
            ) != 0
            {
                let _ = PdhCloseQuery(query);
                return None;
            }
            PdhCollectQueryData(query);
            Some(Self { query, counter })
        }
    }

    fn get_usage(&self) -> f32 {
        use windows::Win32::System::Performance::*;
        unsafe {
            if PdhCollectQueryData(self.query) != 0 {
                return 0.0;
            }
            let mut buf_size: u32 = 0;
            let mut item_count: u32 = 0;
            let _ = PdhGetFormattedCounterArrayW(
                self.counter,
                PDH_FMT_DOUBLE,
                &mut buf_size,
                &mut item_count,
                None,
            );

            if buf_size > 0 && item_count > 0 {
                let mut buffer = vec![0u8; buf_size as usize];
                if PdhGetFormattedCounterArrayW(
                    self.counter,
                    PDH_FMT_DOUBLE,
                    &mut buf_size,
                    &mut item_count,
                    Some(buffer.as_mut_ptr() as *mut _),
                ) == 0
                {
                    let items = std::slice::from_raw_parts(
                        buffer.as_ptr() as *const PDH_FMT_COUNTERVALUE_ITEM_W,
                        item_count as usize,
                    );
                    let mut sum_usage = 0.0;
                    for item in items {
                        let name_ptr = item.szName.0 as *const u16;
                        let mut len = 0;
                        while *name_ptr.add(len) != 0 {
                            len += 1;
                        }
                        let name_slice = std::slice::from_raw_parts(name_ptr, len);
                        let name = String::from_utf16_lossy(name_slice);

                        if name.contains("engtype_3D") {
                            sum_usage += item.FmtValue.Anonymous.doubleValue as f32;
                        }
                    }
                    // Cap at 100% just in case
                    return sum_usage.min(100.0);
                }
            }
        }
        0.0
    }
}

#[cfg(not(windows))]
struct GpuMonitor;

#[cfg(not(windows))]
impl GpuMonitor {
    fn new() -> Option<Self> {
        None
    }
    fn get_usage(&self) -> f32 {
        0.0
    }
}

#[cfg(windows)]
struct FpsMonitor {
    current_fps: Arc<AtomicU32>,
}

#[cfg(windows)]
impl FpsMonitor {
    fn new(shutdown: Arc<AtomicBool>) -> Self {
        let current_fps = Arc::new(AtomicU32::new(0));
        let fps_clone = current_fps.clone();

        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            use std::os::windows::process::CommandExt;
            use std::process::{Command, Stdio};

            // Wait a moment for app to start
            std::thread::sleep(std::time::Duration::from_secs(2));

            let mut present_mon_path = std::path::PathBuf::from("PresentMon64.exe");
            if !present_mon_path.exists() {
                let exe_path = std::env::current_exe().unwrap_or_default();
                present_mon_path = exe_path
                    .parent()
                    .unwrap_or_else(|| std::path::Path::new("."))
                    .to_path_buf();
                present_mon_path.push("PresentMon64.exe");
            }

            // Launch PresentMon hidden
            let mut child = match Command::new(present_mon_path)
                .args([
                    "--output_stdout",
                    "--stop_existing_session",
                    "--session_name",
                    "VectorHUD",
                ])
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .creation_flags(0x08000000) // CREATE_NO_WINDOW
                .spawn()
            {
                Ok(c) => c,
                Err(e) => {
                    tracing::error!("Failed to start PresentMon64.exe: {}", e);
                    return;
                }
            };

            let stdout = match child.stdout.take() {
                Some(s) => s,
                None => {
                    tracing::error!("PresentMon64 stdout not available");
                    let _ = child.kill();
                    return;
                }
            };
            let reader = BufReader::new(stdout);

            let mut last_update = std::time::Instant::now();
            let mut frame_times: Vec<f32> = Vec::new();
            let mut current_pid = 0;

            for line in reader.lines() {
                if shutdown.load(Ordering::Relaxed) {
                    let _ = child.kill();
                    break;
                }
                if let Ok(line) = line {
                    if line.starts_with("Application") {
                        continue;
                    }

                    let parts: Vec<&str> = line.split(',').collect();
                    if parts.len() > 10 {
                        if let Ok(pid) = parts[1].parse::<u32>() {
                            if last_update.elapsed().as_secs() >= 1 {
                                current_pid = get_foreground_pid();
                                last_update = std::time::Instant::now();

                                if !frame_times.is_empty() {
                                    let avg_ms: f32 =
                                        frame_times.iter().sum::<f32>() / frame_times.len() as f32;
                                    if avg_ms > 0.0 {
                                        fps_clone.store(
                                            (1000.0 / avg_ms).round() as u32,
                                            Ordering::Relaxed,
                                        );
                                    } else {
                                        fps_clone.store(0, Ordering::Relaxed);
                                    }
                                    frame_times.clear();
                                }
                            }

                            // If this row belongs to the active window, track its frame time
                            if pid == current_pid {
                                if let Ok(ms) = parts[10].parse::<f32>() {
                                    if ms > 0.0 && ms < 1000.0 {
                                        frame_times.push(ms);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            let _ = child.kill();
        });

        Self { current_fps }
    }

    fn get_fps(&self) -> u32 {
        self.current_fps.load(Ordering::Relaxed)
    }
}

#[cfg(windows)]
fn get_foreground_pid() -> u32 {
    use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return 0;
        }
        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        pid
    }
}

#[cfg(not(windows))]
struct FpsMonitor;

#[cfg(not(windows))]
impl FpsMonitor {
    fn new(_: Arc<AtomicBool>) -> Self {
        Self
    }
    fn get_fps(&self) -> u32 {
        0
    }
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

        let gpu_monitor = GpuMonitor::new();
        let fps_monitor = FpsMonitor::new(shutdown.clone());

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

            let gpu_usage = if let Some(ref monitor) = gpu_monitor {
                monitor.get_usage()
            } else {
                0.0
            };

            let (vram_used_gb, vram_usage_percent) = get_vram_info();
            let fps = fps_monitor.get_fps();

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

            let mut hud_cpu_usage = 0.0;
            let mut hud_ram_usage_mb = 0.0;

            // Get current process ID
            if let Ok(pid) = sysinfo::get_current_pid() {
                sys.refresh_processes_specifics(
                    sysinfo::ProcessesToUpdate::Some(&[pid]),
                    true,
                    sysinfo::ProcessRefreshKind::nothing()
                        .with_cpu()
                        .with_memory(),
                );
                if let Some(proc) = sys.process(pid) {
                    hud_cpu_usage = proc.cpu_usage();
                    hud_ram_usage_mb = proc.memory() as f32 / 1_048_576.0;
                }
            }

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
                hud_cpu_usage,
                hud_ram_usage_mb,
            };

            // Emit the event to the frontend
            let _ = app.emit("hardware-metrics-update", metrics);

            // Wait 1 second before polling again
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}
