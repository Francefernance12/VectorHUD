use tauri::Manager;

#[tauri::command]
pub fn frontend_log(level: String, message: String) {
    match level.as_str() {
        "error" => tracing::error!("Frontend: {}", message),
        "warn" => tracing::warn!("Frontend: {}", message),
        "info" => tracing::info!("Frontend: {}", message),
        "debug" => tracing::debug!("Frontend: {}", message),
        _ => tracing::trace!("Frontend: {}", message),
    }
}

#[tauri::command]
pub fn read_latest_logs(app: tauri::AppHandle) -> Result<String, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let log_dir = app_data_dir.join("logs");
    if !log_dir.exists() {
        return Ok("No log directory found.".to_string());
    }
    let mut log_files = std::fs::read_dir(log_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            name.starts_with("vectorhud.log")
        })
        .collect::<Vec<_>>();

    log_files.sort_by(|a, b| {
        let time_a = a.metadata().ok().and_then(|m| m.modified().ok());
        let time_b = b.metadata().ok().and_then(|m| m.modified().ok());
        time_b.cmp(&time_a)
    });

    if let Some(latest_file) = log_files.first() {
        let content = std::fs::read_to_string(latest_file.path()).map_err(|e| e.to_string())?;
        let lines: Vec<&str> = content.lines().collect();
        let start = if lines.len() > 200 {
            lines.len() - 200
        } else {
            0
        };
        Ok(lines[start..].join("\n"))
    } else {
        Ok("No log files found.".to_string())
    }
}
