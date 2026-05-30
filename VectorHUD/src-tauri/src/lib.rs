mod commands;

use tauri::Manager;
use tracing_subscriber::EnvFilter;
use tracing_appender::rolling;
use std::fs;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Ok(app_data_dir) = app.path().app_data_dir() {
                let log_dir = app_data_dir.join("logs");
                if !log_dir.exists() {
                    let _ = fs::create_dir_all(&log_dir);
                }
                
                let file_appender = rolling::daily(log_dir, "vectorhud.log");
                // Note: keeping the guard in a static or app state is ideal to prevent dropping, 
                // but for simple cases this is fine since it's the main thread
                let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);
                
                // It's important to leak the guard here or keep it in App state so background 
                // threads writing to logs aren't abruptly stopped when setup finishes.
                Box::leak(Box::new(_guard));

                tracing_subscriber::fmt()
                    .with_env_filter(EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
                    .with_writer(non_blocking)
                    .with_ansi(false)
                    .init();
                
                tracing::info!("VectorHUD Rust Backend Initialized");
            } else {
                tracing_subscriber::fmt()
                    .with_env_filter(EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()))
                    .init();
                tracing::warn!("Could not resolve AppData directory. Logging to console only.");
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::telemetry::frontend_log
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
