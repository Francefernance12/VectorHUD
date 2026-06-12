use std::fs;
use tauri::{AppHandle, Manager};

unsafe fn save_capture_pixels(
    app: &AppHandle,
    mut bgra_data: Vec<u8>,
    width: u32,
    height: u32,
    is_hdr: bool,
) -> Result<String, String> {
    tracing::info!(
        "save_capture_pixels: saving captured frame, is_hdr={}",
        is_hdr
    );

    // Swap B and R channels to convert BGRA to RGBA for image crate
    for chunk in bgra_data.chunks_exact_mut(4) {
        chunk.swap(0, 2);
    }

    let picture_dir = app
        .path()
        .picture_dir()
        .map_err(|_| "Could not find Pictures directory".to_string())?;

    let hud_dir = picture_dir.join("VectorHUD");
    if !hud_dir.exists() {
        fs::create_dir_all(&hud_dir).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let file_name = format!("screenshot_{}.png", timestamp);
    let file_path = hud_dir.join(file_name);

    image::save_buffer(
        &file_path,
        &bgra_data,
        width,
        height,
        image::ColorType::Rgba8,
    )
    .map_err(|e| format!("Failed to save image: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn capture_screenshot(window: tauri::Window, app: AppHandle) -> Result<String, String> {
    let was_visible = window.is_visible().unwrap_or(false);

    if was_visible {
        // Hide the overlay so it doesn't get captured
        let _ = window.hide();
        // Give Windows compositor a split second to remove the window visually
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    }

    // Capture raw frame immediately (extremely fast)
    let capture_result = unsafe {
        windows_record::capture_raw_frame().map_err(|e| format!("Capture failed: {:?}", e))
    };

    if was_visible {
        // Restore the overlay immediately before the slow PNG save operations
        let _ = window.show();
        let _ = window.set_focus();
    }

    let (bgra_data, width, height, is_hdr) = capture_result?;

    unsafe { save_capture_pixels(&app, bgra_data, width, height, is_hdr) }
}

#[tauri::command]
pub async fn check_file_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).exists())
}

#[tauri::command]
pub async fn delete_capture(path: String) -> Result<(), String> {
    if std::path::Path::new(&path).exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn capture_screen_base64(
    window: tauri::Window,
    app: AppHandle,
) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};

    let was_visible = window.is_visible().unwrap_or(false);

    if was_visible {
        // Hide the overlay
        let _ = window.hide();
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
    }

    // Capture raw frame immediately
    let capture_result = unsafe {
        windows_record::capture_raw_frame().map_err(|e| format!("Capture failed: {:?}", e))
    };

    if was_visible {
        // Restore the overlay immediately before encoding/saving
        let _ = window.show();
        let _ = window.set_focus();
    }

    let (bgra_data, width, height, is_hdr) = capture_result?;

    // Save temporary capture file
    let file_path = unsafe { save_capture_pixels(&app, bgra_data, width, height, is_hdr)? };

    // Read the file and encode to base64
    let file_data =
        std::fs::read(&file_path).map_err(|e| format!("Failed to read screenshot: {}", e))?;

    // Convert directly to base64 data URI (we saved it as PNG)
    let base64_str = STANDARD.encode(file_data);
    let data_uri = format!("data:image/png;base64,{}", base64_str);

    // Clean up the temp file
    let _ = std::fs::remove_file(file_path);

    Ok(data_uri)
}
