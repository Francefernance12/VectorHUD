use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{command, AppHandle, Manager, State};
use windows_record::Recorder;

pub struct RecorderManager {
    standard_recorder: Option<Recorder>,
    standard_path: Option<PathBuf>,
    replay_recorder: Option<Recorder>,
    is_recording: bool,
    is_replay_active: bool,
}

impl RecorderManager {
    pub fn new() -> Self {
        Self {
            standard_recorder: None,
            standard_path: None,
            replay_recorder: None,
            is_recording: false,
            is_replay_active: false,
        }
    }
}

pub struct RecorderState(pub Mutex<RecorderManager>);

#[derive(serde::Serialize)]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub is_replay_active: bool,
}

/// Helper to get or create target folder in ~/Pictures/VectorHUD
fn get_video_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let picture_dir = app
        .path()
        .picture_dir()
        .map_err(|e| format!("Could not find Pictures directory: {}", e))?;
    let hud_dir = picture_dir.join("VectorHUD");
    if !hud_dir.exists() {
        fs::create_dir_all(&hud_dir)
            .map_err(|e| format!("Failed to create VectorHUD video directory: {}", e))?;
    }
    Ok(hud_dir)
}

// get_active_process_name removed as windows-record now records the entire desktop

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
    if manager.is_replay_active {
        return Err(
            "Cannot start recording while replay buffer is active. Stop replay buffer first."
                .to_string(),
        );
    }

    let video_dir = get_video_dir(&app)?;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let file_name = format!("video_{}.mp4", timestamp);
    let file_path = video_dir.join(file_name);

    let mut width = 1920;
    let mut height = 1080;

    // Get the primary monitor resolution to prevent DXGI/D3D11 crash 
    // when copying the desktop duplication texture to the texture pool
    if let Ok(monitors) = xcap::Monitor::all() {
        if let Some(monitor) = monitors.into_iter().find(|m| m.is_primary().unwrap_or(false)).or_else(|| xcap::Monitor::all().unwrap_or_default().into_iter().next()) {
            width = monitor.width().unwrap_or(1920);
            height = monitor.height().unwrap_or(1080);
            tracing::info!("Using primary monitor resolution for recording: {}x{}", width, height);
        }
    }

    let config = Recorder::builder()
        .fps(30, 1)
        .input_dimensions(width, height)
        .output_dimensions(width, height)
        .audio_source(windows_record::AudioSource::Desktop)
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
    state: State<'_, RecorderState>,
    mic_enabled: bool,
    audio_enabled: bool,
) -> Result<(), String> {
    let mut manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;

    if manager.is_replay_active {
        return Err("Replay buffer is already active".to_string());
    }
    if manager.is_recording {
        return Err("Cannot start replay buffer while a standard recording is active".to_string());
    }

    let video_dir = get_video_dir(&app)?;
    let fallback_path = video_dir.join("replay_buffer_fallback.mp4");

    let mut width = 1920;
    let mut height = 1080;

    if let Ok(monitors) = xcap::Monitor::all() {
        if let Some(monitor) = monitors.into_iter().find(|m| m.is_primary().unwrap_or(false)).or_else(|| xcap::Monitor::all().unwrap_or_default().into_iter().next()) {
            width = monitor.width().unwrap_or(1920);
            height = monitor.height().unwrap_or(1080);
            tracing::info!("Using primary monitor resolution for replay buffer: {}x{}", width, height);
        }
    }

    let config = Recorder::builder()
        .fps(30, 1)
        .input_dimensions(width, height)
        .output_dimensions(width, height)
        .audio_source(windows_record::AudioSource::Desktop)
        .capture_audio(audio_enabled)
        .capture_microphone(mic_enabled)
        .enable_replay_buffer(true)
        .replay_buffer_seconds(30)
        .output_path(fallback_path.to_string_lossy().to_string())
        .build();

    let recorder = Recorder::new(config)
        .map_err(|e| format!("Failed to initialize replay recorder: {}", e))?
        .with_process_name("Desktop");

    recorder
        .start_recording()
        .map_err(|e| format!("Failed to start replay buffer: {}", e))?;

    manager.replay_recorder = Some(recorder);
    manager.is_replay_active = true;

    tracing::info!("Replay buffer started successfully (rolling 30s)");
    Ok(())
}

#[command]
pub async fn save_replay_buffer(
    app: AppHandle,
    state: State<'_, RecorderState>,
) -> Result<String, String> {
    let manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;

    if !manager.is_replay_active {
        return Err("Replay buffer is not active".to_string());
    }

    let recorder = manager
        .replay_recorder
        .as_ref()
        .ok_or("Replay recorder instance missing")?;
    let video_dir = get_video_dir(&app)?;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let file_name = format!("replay_{}.mp4", timestamp);
    let file_path = video_dir.join(file_name);

    let file_path_str = file_path.to_string_lossy();
    recorder
        .save_replay(&file_path_str)
        .map_err(|e| format!("Failed to save replay clip: {}", e))?;

    tracing::info!("Saved replay clip to: {:?}", file_path);
    Ok(file_path.to_string_lossy().to_string())
}

#[command]
pub async fn stop_replay_buffer(state: State<'_, RecorderState>) -> Result<(), String> {
    let mut manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;

    if !manager.is_replay_active {
        return Err("Replay buffer is not active".to_string());
    }

    let recorder = manager
        .replay_recorder
        .take()
        .ok_or("Replay recorder instance missing")?;

    recorder
        .stop_recording()
        .map_err(|e| format!("Failed to stop replay buffer: {}", e))?;

    manager.is_replay_active = false;

    tracing::info!("Stopped replay buffer successfully");
    Ok(())
}

#[command]
pub async fn get_recording_status(
    state: State<'_, RecorderState>,
) -> Result<RecordingStatus, String> {
    let manager = state
        .0
        .lock()
        .map_err(|e| format!("Failed to lock state: {}", e))?;
    Ok(RecordingStatus {
        is_recording: manager.is_recording,
        is_replay_active: manager.is_replay_active,
    })
}
