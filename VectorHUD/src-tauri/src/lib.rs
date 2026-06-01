mod commands;
mod core;

use std::fs;
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, Modifiers, ShortcutState};
use tracing_appender::rolling;
use tracing_subscriber::EnvFilter;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn set_interactive_mode(window: tauri::Window, interactive: bool) {
    // If interactive is true, we DO NOT ignore cursor events.
    // If interactive is false (ghost mode), we DO ignore cursor events.
    let _ = window.set_ignore_cursor_events(!interactive);
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
                    .with_env_filter(
                        EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()),
                    )
                    .with_writer(non_blocking)
                    .with_ansi(false)
                    .init();

                tracing::info!("VectorHUD Rust Backend Initialized");
            } else {
                tracing_subscriber::fmt()
                    .with_env_filter(
                        EnvFilter::from_default_env().add_directive(tracing::Level::INFO.into()),
                    )
                    .init();
                tracing::warn!("Could not resolve AppData directory. Logging to console only.");
            }

            #[cfg(desktop)]
            {
                // Setup System Tray
                let quit_i = tauri::menu::MenuItem::with_id(
                    app,
                    "quit",
                    "Quit VectorHUD",
                    true,
                    None::<&str>,
                )?;
                let menu = tauri::menu::Menu::with_items(app, &[&quit_i])?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .on_menu_event(|app, event| {
                        if event.id.as_ref() == "quit" {
                            app.exit(0);
                        }
                    })
                    .build(app)?;

                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_shortcuts(["ctrl+alt+o"])?
                        .with_handler(|app, shortcut, event| {
                            if event.state == ShortcutState::Pressed
                                && shortcut.matches(Modifiers::CONTROL | Modifiers::ALT, Code::KeyO)
                            {
                                let _ = app.emit("toggle-interactive-mode", ());
                            }
                        })
                        .build(),
                )?;
            }

            // Spawn the hardware telemetry thread
            core::metrics::spawn_metrics_thread(app.handle().clone());

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:vectorhud.db",
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "create_initial_tables",
                            sql: "
                        CREATE TABLE IF NOT EXISTS widget_analytics (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            widget_name TEXT NOT NULL,
                            action TEXT NOT NULL,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                        CREATE TABLE IF NOT EXISTS capture_history (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            file_path TEXT NOT NULL,
                            media_type TEXT NOT NULL,
                            game_process TEXT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                        ",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "create_capture_history",
                            sql: "
                        CREATE TABLE IF NOT EXISTS capture_history (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            file_path TEXT NOT NULL,
                            media_type TEXT NOT NULL,
                            game_process TEXT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                        ",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            set_interactive_mode,
            commands::telemetry::frontend_log,
            commands::api::get_api_keys,
            commands::api::sync_to_notion,
            core::capture::capture_screenshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
