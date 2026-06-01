use serde::Serialize;
use std::env;

#[derive(Serialize)]
pub struct ApiKeys {
    pub openrouter: Option<String>,
    pub notion_token: Option<String>,
    pub notion_db_id: Option<String>,
}

#[tauri::command]
pub fn get_api_keys() -> ApiKeys {
    // Attempt to load from .env file if it exists (e.g. at the workspace root)
    // In production, you might want a different strategy.
    let _ = dotenvy::dotenv(); // Try loading .env from current dir

    // Also try to look in the parent directory where the .env actually lives in this workspace setup
    let _ = dotenvy::from_path("../.env");
    let _ = dotenvy::from_path("../../.env");

    ApiKeys {
        openrouter: env::var("OPENROUTER_API_KEY").ok(),
        notion_token: env::var("NOTION_ACCESS_TOKEN").ok(),
        notion_db_id: env::var("NOTION_DB_ID").ok(),
    }
}

#[tauri::command]
pub async fn sync_to_notion(note: String) -> Result<(), String> {
    let keys = get_api_keys();
    let token = keys.notion_token.ok_or("Notion token missing")?;
    let db_id = keys.notion_db_id.ok_or("Notion DB ID missing")?;

    let client = reqwest::Client::new();
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
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("Notion API Error: {}", error_text));
    }

    Ok(())
}
