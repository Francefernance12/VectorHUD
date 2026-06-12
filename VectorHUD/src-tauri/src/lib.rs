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

static HOTKEY_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn parse_hotkey_to_vk(hotkey_str: &str) -> (bool, bool, bool, i32) {
    let mut ctrl = false;
    let mut alt = false;
    let mut shift = false;
    let mut vk = 0;
    for part in hotkey_str.to_lowercase().split('+') {
        match part.trim() {
            "ctrl" | "control" | "commandorcontrol" => ctrl = true,
            "alt" | "menu" => alt = true,
            "shift" => shift = true,
            other => {
                if other.len() == 1 {
                    let c = other.chars().next().unwrap();
                    if c.is_alphabetic() {
                        vk = 0x41 + (c as i32 - 'a' as i32);
                    } else if c.is_numeric() {
                        vk = 0x30 + (c as i32 - '0' as i32);
                    }
                } else {
                    match other {
                        "space" => vk = 0x20,
                        "enter" | "return" => vk = 0x0D,
                        "tab" => vk = 0x09,
                        "escape" | "esc" => vk = 0x1B,
                        "up" => vk = 0x26,
                        "down" => vk = 0x28,
                        "left" => vk = 0x25,
                        "right" => vk = 0x27,
                        "f1" => vk = 0x70,
                        "f2" => vk = 0x71,
                        "f3" => vk = 0x72,
                        "f4" => vk = 0x73,
                        "f5" => vk = 0x74,
                        "f6" => vk = 0x75,
                        "f7" => vk = 0x76,
                        "f8" => vk = 0x77,
                        "f9" => vk = 0x78,
                        "f10" => vk = 0x79,
                        "f11" => vk = 0x7A,
                        "f12" => vk = 0x7B,
                        _ => {}
                    }
                }
            }
        }
    }
    (ctrl, alt, shift, vk)
}

#[tauri::command]
fn start_voice_recording(
    state: tauri::State<'_, core::voice_recorder::VoiceRecorderState>,
) -> Result<(), String> {
    let mut lock = state.0.lock().unwrap();
    if lock.is_some() {
        return Err("Voice recording is already in progress".to_string());
    }
    let recorder = core::voice_recorder::VoiceRecorder::start()?;
    *lock = Some(recorder);
    Ok(())
}

#[tauri::command]
fn stop_voice_recording(
    state: tauri::State<'_, core::voice_recorder::VoiceRecorderState>,
) -> Result<String, String> {
    let mut lock = state.0.lock().unwrap();
    let recorder = lock
        .take()
        .ok_or_else(|| "No active voice recording to stop".to_string())?;
    let wav_bytes = recorder.get_wav_bytes()?;

    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let base64_str = STANDARD.encode(wav_bytes);
    Ok(format!("data:audio/wav;base64,{}", base64_str))
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn update_hotkeys(
    app: tauri::AppHandle,
    overlay_hotkey: String,
    screenshot_hotkey: String,
    record_hotkey: String,
    replay_hotkey: String,
    timer_hotkey: String,
    stopwatch_hotkey: String,
    timer_reset_hotkey: String,
    voice_ptt_hotkey: String,
) -> Result<(), String> {
    let _lock = HOTKEY_MUTEX.lock().unwrap();
    use std::str::FromStr;
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let shortcut_manager = app.global_shortcut();
    let _ = shortcut_manager.unregister_all();

    let mut errors = Vec::new();

    let mut register_hotkey = |hotkey_str: &str, event_name: &str| {
        if hotkey_str.is_empty() {
            return;
        } // Skip empty hotkeys
        if let Ok(shortcut) = Shortcut::from_str(hotkey_str) {
            if shortcut_manager.is_registered(shortcut) {
                let _ = shortcut_manager.unregister(shortcut);
            }
            let event_name_clone = event_name.to_string();
            let res = shortcut_manager.on_shortcut(shortcut, move |app, _shortcut, event| {
                tracing::info!(
                    "Shortcut triggered: {} with state {:?}",
                    event_name_clone,
                    event.state
                );
                if event.state == ShortcutState::Pressed {
                    if event_name_clone == "hotkey-overlay" {
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
                                            let _ = window.set_decorations(false);
                                            let _ = window.set_skip_taskbar(true);
                                            let _ = window.set_always_on_top(true);
                                            let _ = window.set_focus();
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    let _ = app.emit(&event_name_clone, ());
                }
            });
            if let Err(e) = res {
                tracing::error!("Failed to set shortcut handler: {} - {:?}", hotkey_str, e);
                errors.push(format!(
                    "Internal handler error for {}: {:?}",
                    hotkey_str, e
                ));
            }
        } else {
            tracing::error!("Failed to parse hotkey string: {}", hotkey_str);
            errors.push(format!("Invalid hotkey format: '{}'", hotkey_str));
        }
    };

    register_hotkey(&overlay_hotkey, "hotkey-overlay");
    register_hotkey(&screenshot_hotkey, "hotkey-screenshot");
    register_hotkey(&record_hotkey, "hotkey-record");
    register_hotkey(&replay_hotkey, "hotkey-replay");
    register_hotkey(&timer_hotkey, "hotkey-timer");
    register_hotkey(&stopwatch_hotkey, "hotkey-stopwatch");
    register_hotkey(&timer_reset_hotkey, "hotkey-timer-reset");

    // Register Voice PTT hotkey separately to handle polling key release
    if !voice_ptt_hotkey.is_empty() {
        if let Ok(shortcut) = Shortcut::from_str(&voice_ptt_hotkey) {
            if shortcut_manager.is_registered(shortcut) {
                let _ = shortcut_manager.unregister(shortcut);
            }
            let voice_ptt_hotkey_clone = voice_ptt_hotkey.clone();
            let res = shortcut_manager.on_shortcut(shortcut, move |app, _shortcut, event| {
                tracing::info!("Shortcut triggered: hotkey-voice-ptt with state {:?}", event.state);
                if event.state == ShortcutState::Pressed {
                    let state = app.state::<core::voice_recorder::VoiceRecorderState>();
                    let mut lock = state.0.lock().unwrap();
                    if lock.is_none() {
                        match core::voice_recorder::VoiceRecorder::start() {
                            Ok(recorder) => {
                                *lock = Some(recorder);
                                let _ = app.emit("voice-recording-started", ());

                                let hotkey_str = voice_ptt_hotkey_clone.clone();
                                let app_handle = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                                    let (ctrl, alt, shift, vk) = parse_hotkey_to_vk(&hotkey_str);
                                    loop {
                                        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                                        let mut pressed = true;
                                        unsafe {
                                            use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
                                            if ctrl && GetAsyncKeyState(0x11) >= 0 { // VK_CONTROL
                                                pressed = false;
                                            }
                                            if alt && GetAsyncKeyState(0x12) >= 0 { // VK_MENU
                                                pressed = false;
                                            }
                                            if shift && GetAsyncKeyState(0x10) >= 0 { // VK_SHIFT
                                                pressed = false;
                                            }
                                            if vk != 0 && GetAsyncKeyState(vk) >= 0 {
                                                pressed = false;
                                            }
                                        }
                                        if !pressed {
                                            break;
                                        }
                                    }

                                    let state = app_handle.state::<core::voice_recorder::VoiceRecorderState>();
                                    let mut lock = state.0.lock().unwrap();
                                    if let Some(recorder) = lock.take() {
                                        match recorder.get_wav_bytes() {
                                            Ok(wav_bytes) => {
                                                use base64::{engine::general_purpose::STANDARD, Engine as _};
                                                let base64_str = STANDARD.encode(wav_bytes);
                                                let data_uri = format!("data:audio/wav;base64,{}", base64_str);
                                                let _ = app_handle.emit("voice-recording-stopped", data_uri);
                                            }
                                            Err(e) => {
                                                tracing::error!("Failed to encode voice WAV: {}", e);
                                                let _ = app_handle.emit("voice-recording-stopped-error", e);
                                            }
                                        }
                                    }
                                });
                            }
                            Err(e) => {
                                tracing::error!("Failed to start voice PTT: {}", e);
                            }
                        }
                    }
                }
            });
            if let Err(e) = res {
                tracing::error!(
                    "Failed to set PTT shortcut handler: {} - {:?}",
                    voice_ptt_hotkey,
                    e
                );
                errors.push(format!(
                    "Internal handler error for PTT {}: {:?}",
                    voice_ptt_hotkey, e
                ));
            }
        } else {
            tracing::error!("Failed to parse PTT hotkey string: {}", voice_ptt_hotkey);
            errors.push(format!("Invalid PTT hotkey format: '{}'", voice_ptt_hotkey));
        }
    }

    if errors.is_empty() {
        tracing::info!("Successfully registered all hotkeys");
        Ok(())
    } else {
        let err_str = errors.join("\n");
        tracing::error!("Failed to register some hotkeys: {}", err_str);
        Err(err_str)
    }
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

                let mut tray_builder = TrayIconBuilder::new();
                if let Some(icon) = app.default_window_icon() {
                    tray_builder = tray_builder.icon(icon.clone());
                }

                let _tray = tray_builder
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
                        let _ = window.set_decorations(false);
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
                    let is_focused = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
                    let is_focused_for_event = is_focused.clone();
                    let app_handle = app.handle().clone();
                    let window_clone_focus = window.clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::Focused(focused) = event {
                            is_focused_for_event.store(*focused, std::sync::atomic::Ordering::Relaxed);
                            if !*focused {
                                let _ = app_handle.emit("window-lost-focus", ());
                            } else {
                                // Assert topmost ONCE on focus gain to prevent taskbar overlap
                                if let Ok(hwnd) = window_clone_focus.hwnd() {
                                    unsafe {
                                        let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
                                            windows::Win32::Foundation::HWND(hwnd.0 as isize),
                                            windows::Win32::UI::WindowsAndMessaging::HWND_TOPMOST,
                                            0, 0, 0, 0,
                                            windows::Win32::UI::WindowsAndMessaging::SWP_NOMOVE
                                                | windows::Win32::UI::WindowsAndMessaging::SWP_NOSIZE
                                                | windows::Win32::UI::WindowsAndMessaging::SWP_NOACTIVATE,
                                        );
                                    }
                                }
                            }
                        }
                    });

                    // Background task to re-assert HWND_TOPMOST every 2 seconds
                    // This prevents the Windows Taskbar from silently overlapping the overlay
                    // after shell events (like Opera GX gaining focus) without stealing focus.
                    let window_clone = window.clone();
                    let shutdown_flag_clone = shutdown_flag.clone();
                    let is_focused_clone = is_focused.clone();
                    tauri::async_runtime::spawn(async move {
                        loop {
                            if shutdown_flag_clone.load(Ordering::Relaxed) {
                                break;
                            }
                            // Only re-assert topmost if the window is NOT currently focused.
                            // Continuous SetWindowPos calls cause WebView2 to dismiss open HTML select dropdowns.
                            if !is_focused_clone.load(std::sync::atomic::Ordering::Relaxed) {
                                if let Ok(hwnd) = window_clone.hwnd() {
                                    unsafe {
                                        let _ = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
                                            windows::Win32::Foundation::HWND(hwnd.0 as isize),
                                            windows::Win32::UI::WindowsAndMessaging::HWND_TOPMOST,
                                            0, 0, 0, 0,
                                            windows::Win32::UI::WindowsAndMessaging::SWP_NOMOVE
                                                | windows::Win32::UI::WindowsAndMessaging::SWP_NOSIZE
                                                | windows::Win32::UI::WindowsAndMessaging::SWP_NOACTIVATE,
                                        );
                                    }
                                } else {
                                    tracing::warn!("Failed to get HWND for z-order re-assertion.");
                                }
                            }
                            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                        }
                    });
                }
            }

            // Spawn the hardware telemetry thread with shutdown signal
            core::metrics::spawn_metrics_thread(app.handle().clone(), shutdown_flag.clone());

            // Initialize video recorder state
            app.manage(core::ffmpeg_manager::FfmpegState(tokio::sync::Mutex::new(
                core::ffmpeg_manager::FfmpegManager::default(),
            )));
            app.manage(core::record::RecorderState(std::sync::Mutex::new(
                core::record::RecorderManager::new(),
            )));
            app.manage(core::voice_recorder::VoiceRecorderState(std::sync::Mutex::new(None)));

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
                        tauri_plugin_sql::Migration {
                            version: 7,
                            description: "add_tokens_to_chat",
                            sql: "
                        ALTER TABLE ai_chat_history ADD COLUMN tokens INTEGER;
                        ",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 8,
                            description: "add_session_titles",
                            sql: "
                        CREATE TABLE IF NOT EXISTS session_titles (
                            session_id TEXT PRIMARY KEY,
                            title TEXT NOT NULL
                        );
                        ",
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                        tauri_plugin_sql::Migration {
                            version: 9,
                            description: "add_tool_support_to_chat",
                            sql: "
                        ALTER TABLE ai_chat_history ADD COLUMN tool_calls TEXT;
                        ALTER TABLE ai_chat_history ADD COLUMN tool_call_id TEXT;
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
            start_voice_recording,
            stop_voice_recording,
            commands::telemetry::frontend_log,
            commands::api::sync_to_notion,
            commands::api::save_local_note,
            commands::api::open_notes_folder,
            commands::api::open_capture_folder,
            commands::api::ensure_notion_schema,
            commands::api::fetch_notion_notes,
            commands::api::delete_notion_note,
            commands::api::update_notion_status,
            commands::api::update_notion_page,
            commands::api::update_notion_page_full,
            commands::api::fetch_notion_blocks,
            commands::api::toggle_notion_task,
            commands::api::call_ai_api,
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
            core::audio_mixer::toggle_master_mute,
            core::audio_mixer::toggle_app_mute,
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

                // Cleanup PresentMon to prevent zombie processes locking the file during updates
                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    let _ = std::process::Command::new("taskkill")
                        .args(["/F", "/IM", "PresentMon64.exe"])
                        .stdout(std::process::Stdio::null())
                        .stderr(std::process::Stdio::null())
                        .creation_flags(0x08000000) // CREATE_NO_WINDOW
                        .status();
                }
            }
        });
}
