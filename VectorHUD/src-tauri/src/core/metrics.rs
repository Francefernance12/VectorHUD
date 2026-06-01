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

            let metrics = HardwareMetrics {
                cpu_usage,
                ram_usage_percent: ram_percent,
                ram_total_gb: total_gb,
                ram_used_gb: used_gb,
            };

            // Emit the event to the frontend
            let _ = app.emit("hardware-metrics-update", metrics);

            // Wait 1 second before polling again
            std::thread::sleep(Duration::from_secs(1));
        }
    });
}
