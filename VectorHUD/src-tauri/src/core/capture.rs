use std::fs;
use tauri::AppHandle;
use tauri::Manager;
use xcap::Monitor;

#[tauri::command]
pub async fn capture_screenshot(window: tauri::Window, app: AppHandle) -> Result<String, String> {
    // Hide the overlay so it doesn't get captured
    let _ = window.hide();

    // Give Windows compositor a split second to remove the window visually
    tokio::time::sleep(std::time::Duration::from_millis(150)).await;

    // 1. Get the primary monitor
    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;
    let primary_monitor = monitors.into_iter().next().ok_or("No monitors found")?;

    // 2. Capture the screen
    let image = primary_monitor
        .capture_image()
        .map_err(|e| format!("Capture failed: {}", e))?;

    // Restore the overlay
    let _ = window.show();

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
