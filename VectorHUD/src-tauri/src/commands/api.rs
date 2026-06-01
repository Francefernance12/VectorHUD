use chrono::Local;
use std::fs::OpenOptions;
use std::io::Write;
use std::time::Duration;

#[tauri::command]
pub async fn sync_to_notion(note: String, token: String, db_id: String) -> Result<(), String> {
    tracing::info!("Notion sync requested — note length: {} chars", note.len());

    if token.is_empty() || db_id.is_empty() {
        return Err("Notion token or DB ID missing".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let body = serde_json::json!({
        "parent": { "database_id": db_id },
        "properties": {
            "title": {
                "title": [
                    {
                        "text": {
                            "content": note
                        }
                    }
                ]
            }
        }
    });

    let res = client
        .post("https://api.notion.com/v1/pages")
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Notion HTTP request failed: {}", e);
            format!("Notion request failed: {}", e)
        })?;

    if !res.status().is_success() {
        let status = res.status();
        let error_text = res.text().await.unwrap_or_default();
        tracing::error!("Notion API returned {}: {}", status, error_text);
        return Err(format!("Notion API Error ({}): {}", status, error_text));
    }

    tracing::info!("Notion sync completed successfully");
    Ok(())
}

#[tauri::command]
pub fn save_local_note(note: String) -> Result<(), String> {
    let doc_dir = dirs::document_dir().ok_or("Could not find Documents directory")?;
    let notes_dir = doc_dir.join("VectorHUD").join("Notes");

    if !notes_dir.exists() {
        std::fs::create_dir_all(&notes_dir)
            .map_err(|e| format!("Failed to create Notes directory: {}", e))?;
    }

    let timestamp = Local::now().format("%Y-%m-%d").to_string();
    let file_path = notes_dir.join(format!("QuickNotes_{}.txt", timestamp));

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("Failed to open local notes file: {}", e))?;

    let timestamp_full = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    writeln!(file, "[{}] {}", timestamp_full, note)
        .map_err(|e| format!("Failed to write to local notes file: {}", e))?;

    tracing::info!("Saved note locally to {:?}", file_path);
    Ok(())
}

#[tauri::command]
pub fn open_notes_folder() -> Result<(), String> {
    let doc_dir = dirs::document_dir().ok_or("Could not find Documents directory")?;
    let notes_dir = doc_dir.join("VectorHUD").join("Notes");

    if !notes_dir.exists() {
        std::fs::create_dir_all(&notes_dir)
            .map_err(|e| format!("Failed to create Notes directory: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&notes_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
