mod commands;
mod core;

use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, RunEvent};
use tracing_appender::rolling;
use tracing_subscriber::EnvFilter;

#[tauri::command]
#[allow(unused_variables)]
fn set_interactive_mode(window: tauri::Window, interactive: bool, interactable_pins: bool) {
    if interactive {
        let _ = window.set_ignore_cursor_events(false);
    } else {
        // Force ignore events when dismissed to not block underlying game interactions
        let _ = window.set_ignore_cursor_events(true);
    }
}

#[tauri::command]
fn update_hotkeys(
    app: tauri::AppHandle,
    overlay_hotkey: String,
    screenshot_hotkey: String,
    record_hotkey: String,
    replay_hotkey: String,
    timer_hotkey: String,
    stopwatch_hotkey: String,
) -> Result<(), String> {
    use std::str::FromStr;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let shortcut_manager = app.global_shortcut();
    let _ = shortcut_manager.unregister_all();

    let register_hotkey = |hotkey_str: &str, event_name: &str| {
        if let Ok(shortcut) = Shortcut::from_str(hotkey_str) {
            if shortcut_manager.is_registered(shortcut) {
                let _ = shortcut_manager.unregister(shortcut);
            }
            let event_name = event_name.to_string();
            let res = shortcut_manager.on_shortcut(shortcut, move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    if event_name == "hotkey-overlay" {
                        use tauri::Manager;
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(cursor_pos) = app.cursor_position() {
                                if let Ok(monitors) = window.available_monitors() {
                                    for m in monitors {
                                        let pos = m.position();
                                        let size = m.size();
                                        let scale = m.scale_factor();
                                        let x = pos.x as f64;
                                        let y = pos.y as f64;
                                        let w = size.width as f64;
                                        let h = size.height as f64;

                                        if cursor_pos.x >= x
                                            && cursor_pos.x <= x + w
                                            && cursor_pos.y >= y
                                            && cursor_pos.y <= y + h
                                        {
                                            let lx = x / scale;
                                            let ly = y / scale;
                                            let lw = w / scale;
                                            let lh = h / scale;
                                            let _ = window
                                                .set_position(tauri::LogicalPosition::new(lx, ly));
                                            let _ =
                                                window.set_size(tauri::LogicalSize::new(lw, lh));
                                            let _ = window.set_skip_taskbar(true);
                                            let _ = window.set_focus();
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    let _ = app.emit(&event_name, ());
                }
            });
            if let Err(e) = res {
                tracing::error!("Failed to set shortcut handler: {} - {:?}", hotkey_str, e);
            }
            if let Err(e) = shortcut_manager.register(shortcut) {
                let err_str = format!("{:?}", e);
                if !err_str.contains("already registered") {
                    tracing::error!("Failed to register shortcut: {} - {:?}", hotkey_str, e);
                }
            }
        }
    };

    register_hotkey(&overlay_hotkey, "hotkey-overlay");
    register_hotkey(&screenshot_hotkey, "hotkey-screenshot");
    register_hotkey(&record_hotkey, "hotkey-record");
    register_hotkey(&replay_hotkey, "hotkey-replay");
    register_hotkey(&timer_hotkey, "hotkey-timer");
    register_hotkey(&stopwatch_hotkey, "hotkey-stopwatch");

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Shared shutdown flag for background threads
    let shutdown_flag = Arc::new(AtomicBool::new(false));
    let shutdown_flag_for_exit = shutdown_flag.clone();

    tauri::Builder::default()
        .setup(move |app| {
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

                // Register autostart plugin (boots app on Windows login)
                app.handle().plugin(tauri_plugin_autostart::init(
                    tauri_plugin_autostart::MacosLauncher::AppleScript,
                    Some(vec![]),
                ))?;

                // Register global shortcut plugin (hotkeys will be bound via frontend update_hotkeys)
                app.handle()
                    .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;

                // Size the window to cover the primary monitor on boot
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(false);

                    // Size the window to cover the primary monitor on boot
                    if let Ok(Some(monitor)) = window.primary_monitor() {
                        let scale = monitor.scale_factor();
                        let size = monitor.size();
                        let pos = monitor.position();
                        let _ = window.set_position(tauri::LogicalPosition::new(
                            pos.x as f64 / scale,
                            pos.y as f64 / scale,
                        ));
                        let _ = window.set_size(tauri::LogicalSize::new(
                            size.width as f64 / scale,
                            size.height as f64 / scale,
                        ));
                    }

                    // Exclude from capture so it doesn't show up in recordings
                    if let Ok(hwnd) = window.hwnd() {
                        unsafe {
                            let _ =
                                windows::Win32::UI::WindowsAndMessaging::SetWindowDisplayAffinity(
                                    windows::Win32::Foundation::HWND(hwnd.0 as isize),
                                    windows::Win32::UI::WindowsAndMessaging::WDA_EXCLUDEFROMCAPTURE,
                                );
                        }
                    }

                    // Dismiss overlay when window loses focus (e.g. clicking second monitor)
                    let app_handle = app.handle().clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::Focused(focused) = event {
                            if !*focused {
                                let _ = app_handle.emit("window-lost-focus", ());
                            }
                        }
                    });
                }
            }

            // Spawn the hardware telemetry thread with shutdown signal
            core::metrics::spawn_metrics_thread(app.handle().clone(), shutdown_flag.clone());

            // Initialize video recorder state
            app.manage(core::record::RecorderState(std::sync::Mutex::new(
                core::record::RecorderManager::new(),
            )));

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
                        // Migration v2 is a no-op: capture_history was already created in v1.
                        // Kept for compatibility with databases that already ran this migration.
                        tauri_plugin_sql::Migration {
                            version: 2,
                            description: "noop_capture_history_already_exists",
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
                        tauri_plugin_sql::Migration {
                            version: 3,
                            description: "create_user_credentials",
                            sql: "
                        CREATE TABLE IF NOT EXISTS user_credentials (
                            id TEXT PRIMARY KEY,
                            encrypted_value TEXT NOT NULL,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                        ",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 4,
                            description: "create_known_games",
                            sql: "
                        CREATE TABLE IF NOT EXISTS known_games (
                            process_name TEXT PRIMARY KEY,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                        ",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 5,
                            description: "create_ai_chat_history",
                            sql: "
                        CREATE TABLE IF NOT EXISTS ai_chat_history (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            role TEXT NOT NULL,
                            content TEXT NOT NULL,
                            image_path TEXT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                        ",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 6,
                            description: "add_session_id_to_chat",
                            sql: "
                        ALTER TABLE ai_chat_history ADD COLUMN session_id TEXT;
                        ",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            set_interactive_mode,
            update_hotkeys,
            commands::telemetry::frontend_log,
            commands::api::sync_to_notion,
            commands::api::save_local_note,
            commands::api::open_notes_folder,
            commands::api::ensure_notion_schema,
            commands::api::fetch_notion_notes,
            commands::api::delete_notion_note,
            commands::api::update_notion_status,
            commands::api::fetch_notion_blocks,
            commands::api::toggle_notion_task,
            core::capture::capture_screenshot,
            core::capture::capture_screen_base64,
            core::capture::check_file_exists,
            core::capture::delete_capture,
            core::auth::encrypt_data,
            core::auth::decrypt_data,
            core::record::start_video_recording,
            core::record::stop_video_recording,
            core::record::start_replay_buffer,
            core::record::save_replay_buffer,
            core::record::stop_replay_buffer,
            core::record::get_recording_status,
            core::audio_mixer::get_audio_mixer_state,
            core::audio_mixer::set_app_volume,
            core::audio_mixer::set_master_volume,
            core::media_control::get_current_media,
            core::media_control::media_play_pause,
            core::media_control::media_next,
            core::media_control::media_prev
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            if let RunEvent::Exit = event {
                tracing::info!("Application exit requested — signaling background threads to stop");
                shutdown_flag_for_exit.store(true, Ordering::Relaxed);
            }
        });
}
