use crate::core::ffmpeg_manager::{self, FfmpegState};
use std::sync::Mutex;
use tauri::{command, AppHandle, Manager, State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use windows_record::{AudioSource, Recorder};

pub struct RecorderManager {
    pub standard_recorder: Option<Recorder>,
    pub standard_path: Option<std::path::PathBuf>,
    pub is_recording: bool,
    pub ffmpeg_recording_process: Option<CommandChild>,
    pub audio_capture: Option<crate::core::audio_capture::AudioCapture>,
}

impl RecorderManager {
    pub fn new() -> Self {
        Self {
            standard_recorder: None,
            standard_path: None,
            is_recording: false,
            ffmpeg_recording_process: None,
            audio_capture: None,
        }
    }
}

pub struct RecorderState(pub Mutex<RecorderManager>);

#[derive(serde::Serialize)]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub is_replay_active: bool,
}

fn get_video_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let picture_dir = app
        .path()
        .picture_dir()
        .map_err(|_| "Could not find Pictures directory".to_string())?;

    let hud_dir = picture_dir.join("VectorHUD");
    if !hud_dir.exists() {
        std::fs::create_dir_all(&hud_dir)
            .map_err(|e| format!("Failed to create VectorHUD video directory: {}", e))?;
    }
    Ok(hud_dir)
}

unsafe fn get_active_monitor_dimensions() -> (u32, u32) {
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
    };
    use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

    let hwnd = GetForegroundWindow();
    let target_hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTOPRIMARY);
    let mut minfo = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };

    if GetMonitorInfoW(target_hmonitor, &mut minfo).into() {
        let width = (minfo.rcMonitor.right - minfo.rcMonitor.left).unsigned_abs();
        let height = (minfo.rcMonitor.bottom - minfo.rcMonitor.top).unsigned_abs();
        (width, height)
    } else {
        (1920, 1080)
    }
}

#[command]
pub async fn check_dxgi_support() -> Result<bool, String> {
    unsafe {
        match windows_record::capture_raw_frame() {
            Ok(_) => Ok(true),
            Err(e) => {
                tracing::info!(
                    "check_dxgi_support: DXGI probe failed ({:?}), reporting unsupported.",
                    e
                );
                Ok(false)
            }
        }
    }
}

#[command]
pub async fn start_video_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
    mic_enabled: bool,
    audio_enabled: bool,
) -> Result<String, String> {
    {
        let manager = state
            .0
            .lock()
            .map_err(|e| format!("Failed to lock state: {}", e))?;

        if manager.is_recording {
            return Err("A video recording is already in progress".to_string());
        }
    }

    let video_dir = get_video_dir(&app)?;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let file_name = format!("video_{}.mp4", timestamp);
    let file_path = video_dir.join(file_name);

    // Get the exact dimensions of the active monitor using Windows APIs
    let (width, height) = unsafe { get_active_monitor_dimensions() };
    tracing::info!(
        "Using active monitor resolution for recording: {}x{}",
        width,
        height
    );

    // Check user preferences from settings.json
    let mut capture_mode = "auto".to_string();
    let mut encoder_pref = "software".to_string();
    let settings_path = std::path::PathBuf::from("settings.json");
    if let Ok(store) = tauri_plugin_store::StoreBuilder::new(&app, settings_path).build() {
        let _ = store.reload();
        if let Some(val) = store.get("captureMode") {
            if let Some(s) = val.as_str() {
                capture_mode = s.to_string();
            }
        }
        if let Some(val) = store.get("videoEncoder") {
            if let Some(s) = val.as_str() {
                encoder_pref = s.to_string();
            }
        }
    }

    let force_ffmpeg = capture_mode == "gdi";
    let mut native_recorder = None;

    if !force_ffmpeg {
        // Attempt native DXGI recording via windows-record
        let config = Recorder::builder()
            .fps(30, 1)
            .input_dimensions(width, height)
            .output_dimensions(width, height)
            .audio_source(AudioSource::Desktop)
            .capture_audio(audio_enabled)
            .capture_microphone(mic_enabled)
            .enable_replay_buffer(false)
            .output_path(file_path.to_string_lossy().to_string())
            .build();

        match Recorder::new(config) {
            Ok(recorder) => {
                let recorder = recorder.with_process_name("Desktop");
                match recorder.start_recording() {
                    Ok(_) => {
                        native_recorder = Some(recorder);
                    }
                    Err(e) => {
                        tracing::warn!(
                            "Failed to start native recording: {:?}. Falling back to FFmpeg...",
                            e
                        );
                    }
                }
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to initialize native recorder: {:?}. Falling back to FFmpeg...",
                    e
                );
            }
        }
    }

    if let Some(recorder) = native_recorder {
        let mut manager = state
            .0
            .lock()
            .map_err(|e| format!("Failed to lock state: {}", e))?;
        manager.standard_recorder = Some(recorder);
        manager.standard_path = Some(file_path.clone());
        manager.is_recording = true;
        tracing::info!("Started standard video recording (DXGI): {:?}", file_path);
        return Ok(file_path.to_string_lossy().to_string());
    }

    // FFmpeg GDI Grab fallback path
    tracing::info!("Initializing FFmpeg recording fallback...");
    let is_gdi = true; // Since DXGI/native failed or GDI is selected

    // Resolve encoder
    let encoder_str = match encoder_pref.as_str() {
        "nvenc" => "h264_nvenc",
        "amf" => "h264_amf",
        "qsv" => "h264_qsv",
        "software" => "libx264",
        _ => "libx264",
    };

    let mut args = vec!["-y".to_string()];

    let active_monitor = ffmpeg_manager::get_active_monitor_index();

    if is_gdi {
        args.extend(vec![
            "-thread_queue_size".to_string(),
            "512".to_string(),
            "-f".to_string(),
            "gdigrab".to_string(),
            "-framerate".to_string(),
            "30".to_string(),
            "-i".to_string(),
            "desktop".to_string(),
        ]);
    } else {
        args.extend(vec![
            "-f".to_string(),
            "lavfi".to_string(),
            "-i".to_string(),
            format!(
                "ddagrab=output_idx={}:framerate=30:output_fmt=8bit",
                active_monitor
            ),
        ]);
    }

    let pipe_name = r"\\.\pipe\vectorhud_audio_recording".to_string();
    let mut audio_capture = None;

    if audio_enabled {
        match crate::core::audio_capture::start_loopback_capture(&pipe_name).await {
            Ok((cap, sample_rate, channels)) => {
                audio_capture = Some(cap);
                args.extend(vec![
                    "-f".to_string(),
                    "f32le".to_string(),
                    "-ar".to_string(),
                    sample_rate.to_string(),
                    "-ac".to_string(),
                    channels.to_string(),
                    "-i".to_string(),
                    pipe_name.clone(),
                ]);
            }
            Err(e) => {
                tracing::error!("Failed to start audio loopback: {}", e);
            }
        }
    }

    let filter = if is_gdi {
        "format=yuv420p".to_string()
    } else {
        "hwdownload,format=bgra,format=yuv420p".to_string()
    };

    args.extend(vec![
        "-vf".to_string(),
        filter,
        "-c:v".to_string(),
        encoder_str.to_string(),
    ]);

    // Apply encoder-specific parameters
    match encoder_str {
        "h264_nvenc" => {
            args.extend(vec![
                "-preset".to_string(),
                "p3".to_string(),
                "-cq".to_string(),
                "23".to_string(),
            ]);
        }
        "libx264" => {
            args.extend(vec![
                "-preset".to_string(),
                "ultrafast".to_string(),
                "-crf".to_string(),
                "23".to_string(),
            ]);
        }
        "h264_amf" => {
            args.extend(vec!["-quality".to_string(), "speed".to_string()]);
        }
        "h264_qsv" => {
            args.extend(vec![
                "-preset".to_string(),
                "veryfast".to_string(),
                "-global_quality".to_string(),
                "23".to_string(),
            ]);
        }
        _ => {
            args.extend(vec![
                "-preset".to_string(),
                "ultrafast".to_string(),
                "-crf".to_string(),
                "23".to_string(),
            ]);
        }
    }

    args.extend(vec![
        "-g".to_string(),
        "60".to_string(),
        "-keyint_min".to_string(),
        "60".to_string(),
        "-sc_threshold".to_string(),
        "0".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "192k".to_string(),
        "-movflags".to_string(),
        "frag_keyframe+empty_moov".to_string(),
        file_path.to_string_lossy().to_string(),
    ]);

    tracing::info!(
        "Starting FFmpeg standard recording fallback with args: {:?}",
        args
    );

    let (mut rx, child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to find ffmpeg sidecar: {}", e))?
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg recording fallback: {}", e))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let s = String::from_utf8_lossy(&line);
                    tracing::info!("ffmpeg recording fallback stdout: {}", s.trim());
                }
                CommandEvent::Stderr(line) => {
                    let s = String::from_utf8_lossy(&line);
                    tracing::info!("ffmpeg recording fallback stderr: {}", s.trim());
                }
                CommandEvent::Terminated(payload) => {
                    tracing::info!(
                        "ffmpeg recording fallback terminated: status={:?}, signal={:?}",
                        payload.code,
                        payload.signal
                    );
                }
                _ => {}
            }
        }
    });

    let mut manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;
    manager.ffmpeg_recording_process = Some(child);
    manager.audio_capture = audio_capture;
    manager.standard_path = Some(file_path.clone());
    manager.is_recording = true;

    tracing::info!(
        "Started FFmpeg standard recording fallback: {:?}",
        file_path
    );
    Ok(file_path.to_string_lossy().to_string())
}

#[command]
pub async fn stop_video_recording(state: State<'_, RecorderState>) -> Result<String, String> {
    let mut manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;

    if !manager.is_recording {
        return Err("No video recording in progress".to_string());
    }

    let file_path = manager
        .standard_path
        .take()
        .ok_or("Recording file path missing")?;

    if let Some(recorder) = manager.standard_recorder.take() {
        recorder
            .stop_recording()
            .map_err(|e| format!("Failed to stop recording: {}", e))?;
    } else if let Some(child) = manager.ffmpeg_recording_process.take() {
        let _ = child.kill();
    }

    manager.audio_capture = None;
    manager.is_recording = false;

    tracing::info!(
        "Stopped video recording successfully, saved to {:?}",
        file_path
    );
    Ok(file_path.to_string_lossy().to_string())
}

#[command]
#[allow(clippy::too_many_arguments)]
pub async fn start_replay_buffer(
    app: AppHandle,
    state: State<'_, FfmpegState>,
    mic_enabled: bool,
    audio_enabled: bool,
    resolution: Option<String>,
    fps: Option<u32>,
    encoder: Option<String>,
    capture_mode: Option<String>,
) -> Result<String, String> {
    let mut manager = state.0.lock().await;

    ffmpeg_manager::start_replay_buffer(
        &app,
        &mut manager,
        mic_enabled,
        audio_enabled,
        resolution,
        fps,
        encoder,
        capture_mode,
    )
    .await?;

    Ok("Replay buffer started successfully".to_string())
}

#[command]
pub async fn stop_replay_buffer(state: State<'_, FfmpegState>) -> Result<String, String> {
    let mut manager = state.0.lock().await;

    ffmpeg_manager::stop_replay_buffer(&mut manager)?;
    Ok("Replay buffer stopped successfully".to_string())
}

#[command]
pub async fn save_replay_buffer(
    app: AppHandle,
    state: State<'_, FfmpegState>,
) -> Result<String, String> {
    let m3u8_path = {
        let manager = state.0.lock().await;

        if !manager.is_replay_active {
            return Err("Replay buffer is not active".to_string());
        }

        manager
            .replay_m3u8_path
            .clone()
            .ok_or("No m3u8 path found")?
    };

    ffmpeg_manager::save_replay_clip(&app, m3u8_path).await
}

#[command]
pub async fn get_recording_status(
    recorder_state: State<'_, RecorderState>,
    ffmpeg_state: State<'_, FfmpegState>,
) -> Result<RecordingStatus, String> {
    let is_recording = {
        let rec_manager = recorder_state
            .0
            .lock()
            .map_err(|e| format!("Failed to lock recorder state: {}", e))?;
        rec_manager.is_recording
    };
    let ffmpeg_manager = ffmpeg_state.0.lock().await;

    Ok(RecordingStatus {
        is_recording,
        is_replay_active: ffmpeg_manager.is_replay_active,
    })
}
