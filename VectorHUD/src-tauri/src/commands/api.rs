use serde::Serialize;
use std::env;
use std::time::Duration;

#[derive(Serialize)]
pub struct ApiKeys {
    pub openrouter: Option<String>,
    pub notion_token: Option<String>,
    pub notion_db_id: Option<String>,
}

#[tauri::command]
pub fn get_api_keys() -> ApiKeys {
    // Attempt to load from .env file if it exists (e.g. at the workspace root)
    // In production, this will be replaced by a settings UI that writes to secure storage.
    let _ = dotenvy::dotenv(); // Try loading .env from current dir
    let _ = dotenvy::from_path("../.env");
    let _ = dotenvy::from_path("../../.env");

    let openrouter = env::var("OPENROUTER_API_KEY").ok();
    let notion_token = env::var("NOTION_ACCESS_TOKEN").ok();
    let notion_db_id = env::var("NOTION_DB_ID").ok();

    // Log which keys were found for debugging (not the values themselves!)
    tracing::info!(
        "API key lookup — OpenRouter: {}, Notion Token: {}, Notion DB: {}",
        if openrouter.is_some() {
            "found"
        } else {
            "MISSING"
        },
        if notion_token.is_some() {
            "found"
        } else {
            "MISSING"
        },
        if notion_db_id.is_some() {
            "found"
        } else {
            "MISSING"
        },
    );

    ApiKeys {
        openrouter,
        notion_token,
        notion_db_id,
    }
}

#[tauri::command]
pub async fn sync_to_notion(note: String) -> Result<(), String> {
    tracing::info!("Notion sync requested — note length: {} chars", note.len());

    let keys = get_api_keys();
    let token = keys.notion_token.ok_or("Notion token missing")?;
    let db_id = keys.notion_db_id.ok_or("Notion DB ID missing")?;

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
