use std::fs;
use tauri::{AppHandle, Emitter, Manager};
use xcap::Monitor;

#[tauri::command]
pub async fn capture_screenshot(window: tauri::Window, app: AppHandle) -> Result<String, String> {
    // Hide the overlay so it doesn't get captured
    let _ = window.hide();

    // Give Windows compositor a split second to remove the window visually
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;

    // 1. Get the current monitor based on cursor position
    let cursor_pos = app
        .cursor_position()
        .map_err(|e| format!("Failed to get cursor: {}", e))?;
    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    let fallback_monitors =
        Monitor::all().map_err(|e| format!("Failed to get fallback monitors: {}", e))?;
    let fallback = fallback_monitors
        .into_iter()
        .next()
        .ok_or("No monitors found")?;

    let target_monitor = monitors
        .into_iter()
        .find(|m| {
            let x = m.x().unwrap_or(0) as f64;
            let y = m.y().unwrap_or(0) as f64;
            let w = m.width().unwrap_or(0) as f64;
            let h = m.height().unwrap_or(0) as f64;
            cursor_pos.x >= x && cursor_pos.x <= x + w && cursor_pos.y >= y && cursor_pos.y <= y + h
        })
        .unwrap_or(fallback);

    // 2. Capture the screen
    let image = target_monitor
        .capture_image()
        .map_err(|e| format!("Capture failed: {}", e))?;

    // Restore the overlay
    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit("force-interactive", ());

    // 3. Determine save path (Pictures/VectorHUD)
    let picture_dir = app
        .path()
        .picture_dir()
        .map_err(|_| "Could not find Pictures directory".to_string())?;

    let hud_dir = picture_dir.join("VectorHUD");

    // 4. Create directory if it doesn't exist
    if !hud_dir.exists() {
        fs::create_dir_all(&hud_dir).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // 5. Generate filename with timestamp
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let file_name = format!("screenshot_{}.png", timestamp);
    let file_path = hud_dir.join(file_name);

    // 6. Save image
    image
        .save(&file_path)
        .map_err(|e| format!("Failed to save image: {}", e))?;

    // 7. Return the absolute path
    Ok(file_path.to_string_lossy().to_string())
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
    use std::io::Cursor;

    // Hide the overlay
    let _ = window.hide();
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;

    let cursor_pos = app
        .cursor_position()
        .map_err(|e| format!("Failed to get cursor: {}", e))?;
    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;

    let fallback_monitors =
        Monitor::all().map_err(|e| format!("Failed to get fallback monitors: {}", e))?;
    let fallback = fallback_monitors
        .into_iter()
        .next()
        .ok_or("No monitors found")?;

    let target_monitor = monitors
        .into_iter()
        .find(|m| {
            let x = m.x().unwrap_or(0) as f64;
            let y = m.y().unwrap_or(0) as f64;
            let w = m.width().unwrap_or(0) as f64;
            let h = m.height().unwrap_or(0) as f64;
            cursor_pos.x >= x && cursor_pos.x <= x + w && cursor_pos.y >= y && cursor_pos.y <= y + h
        })
        .unwrap_or(fallback);

    let image = target_monitor
        .capture_image()
        .map_err(|e| format!("Capture failed: {}", e))?;

    // Restore the overlay
    let _ = window.show();
    let _ = window.set_focus();
    let _ = app.emit("force-interactive", ());

    // Convert RGBA to RGB (JPEG does not support alpha channel)
    let rgb_image = image::DynamicImage::ImageRgba8(image).into_rgb8();

    // Compress the image to JPEG memory buffer
    let mut buffer = Cursor::new(Vec::new());
    rgb_image
        .write_to(&mut buffer, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to encode image to memory: {}", e))?;

    let base64_str = STANDARD.encode(buffer.into_inner());
    let data_uri = format!("data:image/jpeg;base64,{}", base64_str);

    Ok(data_uri)
}
