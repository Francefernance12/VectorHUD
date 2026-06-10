use crate::core::ffmpeg_manager::{self, FfmpegState};
use std::sync::Mutex;
use tauri::{command, AppHandle, Manager, State};
use windows_record::{AudioSource, Recorder};

pub struct RecorderManager {
    pub standard_recorder: Option<Recorder>,
    pub standard_path: Option<std::path::PathBuf>,
    pub is_recording: bool,
}

impl RecorderManager {
    pub fn new() -> Self {
        Self {
            standard_recorder: None,
            standard_path: None,
            is_recording: false,
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
        let width = (minfo.rcMonitor.right - minfo.rcMonitor.left).abs() as u32;
        let height = (minfo.rcMonitor.bottom - minfo.rcMonitor.top).abs() as u32;
        (width, height)
    } else {
        (1920, 1080)
    }
}

#[command]
pub async fn start_video_recording(
    app: AppHandle,
    state: State<'_, RecorderState>,
    mic_enabled: bool,
    audio_enabled: bool,
) -> Result<String, String> {
    let mut manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;

    if manager.is_recording {
        return Err("A video recording is already in progress".to_string());
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

    let recorder = Recorder::new(config)
        .map_err(|e| format!("Failed to initialize recorder: {}", e))?
        .with_process_name("Desktop");

    recorder
        .start_recording()
        .map_err(|e| format!("Failed to start recording: {}", e))?;

    manager.standard_recorder = Some(recorder);
    manager.standard_path = Some(file_path.clone());
    manager.is_recording = true;

    tracing::info!("Started standard video recording: {:?}", file_path);
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

    let recorder = manager
        .standard_recorder
        .take()
        .ok_or("Recorder instance missing")?;
    let file_path = manager
        .standard_path
        .take()
        .ok_or("Recording file path missing")?;

    recorder
        .stop_recording()
        .map_err(|e| format!("Failed to stop recording: {}", e))?;

    manager.is_recording = false;

    tracing::info!(
        "Stopped video recording successfully, saved to {:?}",
        file_path
    );
    Ok(file_path.to_string_lossy().to_string())
}

#[command]
pub async fn start_replay_buffer(
    app: AppHandle,
    state: State<'_, FfmpegState>,
    mic_enabled: bool,
    audio_enabled: bool,
    resolution: Option<String>,
    fps: Option<u32>,
) -> Result<String, String> {
    let mut manager = state.0.lock().await;

    ffmpeg_manager::start_replay_buffer(
        &app,
        &mut manager,
        mic_enabled,
        audio_enabled,
        resolution,
        fps,
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
