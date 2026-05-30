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
