use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tokio::sync::Mutex;
use tracing::info;

use windows::Win32::Foundation::{BOOL, LPARAM, RECT};
use windows::Win32::Graphics::Gdi::{
    EnumDisplayMonitors, MonitorFromWindow, HDC, HMONITOR, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

struct MonitorEnumData {
    target: HMONITOR,
    current_index: i32,
    found_index: i32,
}

unsafe extern "system" fn monitor_enum_proc(
    hmonitor: HMONITOR,
    _: HDC,
    _: *mut RECT,
    lparam: LPARAM,
) -> BOOL {
    let data = &mut *(lparam.0 as *mut MonitorEnumData);
    if hmonitor == data.target {
        data.found_index = data.current_index;
        return BOOL(0); // Stop enumeration
    }
    data.current_index += 1;
    BOOL(1) // Continue
}

fn get_active_monitor_index() -> i32 {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return 0;
        }
        let hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        if hmonitor.0 == 0 {
            return 0;
        }

        // Attempt to find the correct DXGI output index matching the active GDI monitor.
        // This is crucial because ddagrab's output_idx refers to the DXGI output enumeration index,
        // which does not always match GDI EnumDisplayMonitors index.
        if let Ok(factory) = windows::Win32::Graphics::Dxgi::CreateDXGIFactory1::<
            windows::Win32::Graphics::Dxgi::IDXGIFactory1,
        >() {
            if let Ok(adapter) = factory.EnumAdapters1(0) {
                let mut output_idx = 0;
                while let Ok(output) = adapter.EnumOutputs(output_idx) {
                    let mut desc = std::mem::zeroed();
                    if output.GetDesc(&mut desc).is_ok() && desc.Monitor == hmonitor {
                        tracing::info!("get_active_monitor_index: Found matching DXGI output_idx={} for active monitor", output_idx);
                        return output_idx as i32;
                    }
                    output_idx += 1;
                }
            }
        }

        // Fallback to GDI EnumDisplayMonitors order if DXGI query fails
        tracing::warn!("get_active_monitor_index: DXGI enum failed or monitor not found on primary adapter, falling back to GDI monitor list");
        let mut data = MonitorEnumData {
            target: hmonitor,
            current_index: 0,
            found_index: 0,
        };

        EnumDisplayMonitors(
            None,
            None,
            Some(monitor_enum_proc),
            LPARAM(&mut data as *mut _ as isize),
        );

        data.found_index
    }
}

#[derive(Default)]
pub struct FfmpegManager {
    pub replay_buffer_process: Option<CommandChild>,
    pub is_replay_active: bool,
    pub replay_m3u8_path: Option<PathBuf>,
    pub audio_capture: Option<crate::core::audio_capture::AudioCapture>,
}

pub struct FfmpegState(pub Mutex<FfmpegManager>);

fn get_best_encoder(_app: &AppHandle) -> &'static str {
    "h264_nvenc"
}

pub fn get_video_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let picture_dir = app.path().picture_dir().map_err(|e| e.to_string())?;
    let hud_dir = picture_dir.join("VectorHUD");
    if !hud_dir.exists() {
        fs::create_dir_all(&hud_dir)
            .map_err(|e| format!("Failed to create VectorHUD video directory: {}", e))?;
    }
    Ok(hud_dir)
}

pub async fn start_replay_buffer(
    app: &AppHandle,
    state: &mut FfmpegManager,
    _mic_enabled: bool,
    _audio_enabled: bool,
    resolution: Option<String>,
    fps: Option<u32>,
) -> Result<(), String> {
    if state.is_replay_active {
        return Ok(()); // Already running
    }

    // Kill any existing FFmpeg process first to avoid conflicts
    if let Some(child) = state.replay_buffer_process.take() {
        let _ = child.kill();
    }

    let temp_dir = std::env::temp_dir().join("vectorhud_replay");
    if temp_dir.exists() {
        // Clear old replay segments and playlist from temp folder to avoid stale data and conflicts
        if let Ok(entries) = fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let _ = fs::remove_file(path);
                }
            }
        }
    } else {
        fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp dir: {}", e))?;
    }

    let m3u8_path = temp_dir.join("replay.m3u8");
    let encoder = get_best_encoder(app);
    let fps_num = fps.unwrap_or(30);
    let fps_val = fps_num.to_string();
    let gop_size = (fps_num * 2).to_string();
    let active_monitor = get_active_monitor_index();

    let mut filter = "hwdownload,format=bgra,format=yuv420p".to_string();
    if let Some(res) = resolution {
        match res.as_str() {
            "720p" => filter.push_str(",scale=1280:720"),
            "480p" => filter.push_str(",scale=848:480"),
            "1080p" => filter.push_str(",scale=1920:1080"),
            _ => {}
        }
    }

    let mut args = vec![
        "-y".to_string(),
        "-f".to_string(),
        "lavfi".to_string(),
        "-i".to_string(),
        format!(
            "ddagrab=output_idx={}:framerate={}:output_fmt=8bit",
            active_monitor, fps_val
        ),
    ];

    let pipe_name = r"\\.\pipe\vectorhud_audio_replay".to_string();

    if _audio_enabled {
        match crate::core::audio_capture::start_loopback_capture(&pipe_name).await {
            Ok((cap, sample_rate, channels)) => {
                state.audio_capture = Some(cap);
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

    args.extend(vec![
        "-vf".to_string(),
        filter,
        "-c:v".to_string(),
        encoder.to_string(),
        "-g".to_string(),
        gop_size.clone(),
        "-keyint_min".to_string(),
        gop_size,
        "-sc_threshold".to_string(),
        "0".to_string(),
        "-preset".to_string(),
        "p3".to_string(), // Fast preset for buffer
        "-cq".to_string(),
        "23".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "192k".to_string(),
        "-f".to_string(),
        "hls".to_string(),
        "-hls_time".to_string(),
        "2".to_string(), // 2-second chunks
        "-hls_list_size".to_string(),
        "15".to_string(), // 15 chunks = 30 seconds
        "-hls_flags".to_string(),
        "delete_segments".to_string(),
        "-hls_segment_filename".to_string(),
        temp_dir
            .join("segment_%03d.ts")
            .to_string_lossy()
            .to_string(),
        m3u8_path.to_string_lossy().to_string(),
    ]);

    info!("Starting replay buffer with args: {:?}", args);

    let (mut rx, child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to find ffmpeg sidecar: {}", e))?
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg buffer: {}", e))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let s = String::from_utf8_lossy(&line);
                    tracing::info!("ffmpeg stdout: {}", s.trim());
                }
                CommandEvent::Stderr(line) => {
                    let s = String::from_utf8_lossy(&line);
                    tracing::info!("ffmpeg stderr: {}", s.trim());
                }
                CommandEvent::Terminated(payload) => {
                    tracing::info!(
                        "ffmpeg terminated: status={:?}, signal={:?}",
                        payload.code,
                        payload.signal
                    );
                }
                _ => {}
            }
        }
    });

    state.replay_buffer_process = Some(child);
    state.is_replay_active = true;
    state.replay_m3u8_path = Some(m3u8_path);

    Ok(())
}

pub fn stop_replay_buffer(state: &mut FfmpegManager) -> Result<(), String> {
    if let Some(child) = state.replay_buffer_process.take() {
        let _ = child.kill();
    }
    state.is_replay_active = false;
    state.audio_capture = None;
    Ok(())
}

pub async fn save_replay_clip(app: &AppHandle, m3u8_path: PathBuf) -> Result<String, String> {
    if !m3u8_path.exists() {
        return Err("Replay buffer has not written any data yet".to_string());
    }

    let temp_dir = m3u8_path.parent().ok_or("Invalid m3u8 path")?;
    let save_m3u8_path = temp_dir.join("save_temp.m3u8");

    // Read current rolling playlist and append ENDLIST tag to tell FFmpeg to stop waiting and exit cleanly
    let mut m3u8_content =
        fs::read_to_string(&m3u8_path).map_err(|e| format!("Failed to read m3u8: {}", e))?;

    if !m3u8_content.contains("#EXT-X-ENDLIST") {
        m3u8_content.push_str("\n#EXT-X-ENDLIST\n");
    }

    fs::write(&save_m3u8_path, m3u8_content)
        .map_err(|e| format!("Failed to write temporary save m3u8: {}", e))?;

    let video_dir = get_video_dir(app)?;
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let file_path = video_dir.join(format!("replay_{}.mp4", timestamp));

    let args = vec![
        "-y".to_string(),
        "-i".to_string(),
        save_m3u8_path.to_string_lossy().to_string(),
        "-c".to_string(),
        "copy".to_string(),
        file_path.to_string_lossy().to_string(),
    ];

    info!("Saving replay clip with args: {:?}", args);

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| format!("Failed to find ffmpeg sidecar: {}", e))?
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to execute concat: {}", e))?;

    let _ = fs::remove_file(save_m3u8_path);

    if !output.status.success() {
        return Err(format!(
            "FFmpeg failed to save clip: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(file_path.to_string_lossy().to_string())
}
