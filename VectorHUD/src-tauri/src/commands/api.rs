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
