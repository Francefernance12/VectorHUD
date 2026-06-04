use chrono::Local;
use std::fs::OpenOptions;
use std::io::Write;
use std::time::Duration;

#[tauri::command]
pub async fn sync_to_notion(
    title: String,
    description: String,
    content: String,
    tasks: Vec<String>,
    token: String,
    db_id: String,
) -> Result<(), String> {
    tracing::info!("Notion sync requested — title: {}", title);

    // Auto-save locally as backup
    let local_note_body = format!(
        "TITLE: {}\nDESCRIPTION: {}\nCONTENT:\n{}\nTASKS:\n{}",
        title,
        description,
        content,
        tasks
            .iter()
            .map(|t| format!("- [ ] {}", t))
            .collect::<Vec<_>>()
            .join("\n")
    );
    let _ = save_local_note(local_note_body);

    if token.is_empty() || db_id.is_empty() {
        return Err("Notion token or DB ID missing".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let timestamp = Local::now().to_rfc3339();
    let display_title = if title.is_empty() {
        format!("Note - {}", Local::now().format("%Y-%m-%d %H:%M:%S"))
    } else {
        title.clone()
    };

    // Build the page children
    let mut children_blocks = Vec::new();

    // 1. Add Content/Notes as a paragraph if present
    if !content.trim().is_empty() {
        children_blocks.push(serde_json::json!({
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{ "type": "text", "text": { "content": content } }]
            }
        }));
    }

    // 2. Add Todo blocks
    for task in tasks {
        if !task.trim().is_empty() {
            children_blocks.push(serde_json::json!({
                "object": "block",
                "type": "to_do",
                "to_do": {
                    "rich_text": [{ "type": "text", "text": { "content": task } }],
                    "checked": false
                }
            }));
        }
    }

    let body = serde_json::json!({
        "parent": { "database_id": db_id },
        "properties": {
            "Name": {
                "title": [
                    {
                        "text": {
                            "content": display_title
                        }
                    }
                ]
            },
            "Description": {
                "rich_text": [
                    {
                        "type": "text",
                        "text": {
                            "content": description
                        }
                    }
                ]
            },
            "Date": {
                "date": {
                    "start": timestamp
                }
            }
        },
        "children": children_blocks
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

#[tauri::command]
pub fn open_capture_folder() -> Result<(), String> {
    let pic_dir = dirs::picture_dir().ok_or("Could not find Pictures directory")?;
    let capture_dir = pic_dir.join("VectorHUD");

    if !capture_dir.exists() {
        std::fs::create_dir_all(&capture_dir)
            .map_err(|e| format!("Failed to create VectorHUD capture directory: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&capture_dir)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct NotionNote {
    pub id: String,
    pub title: String,
    pub description: String,
    pub status: String,
    pub date: String,
}

#[tauri::command]
pub async fn fetch_notion_notes(token: String, db_id: String) -> Result<Vec<NotionNote>, String> {
    if token.is_empty() || db_id.is_empty() {
        return Err("Notion token or DB ID missing".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let body = serde_json::json!({
        "sorts": [
            {
                "timestamp": "created_time",
                "direction": "descending"
            }
        ],
        "page_size": 20
    });

    let res = client
        .post(format!(
            "https://api.notion.com/v1/databases/{}/query",
            db_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Notion request failed: {}", e))?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("Notion API Error: {}", error_text));
    }

    let json_res: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse Notion JSON: {}", e))?;

    let mut notes = Vec::new();
    if let Some(results) = json_res.get("results").and_then(|r| r.as_array()) {
        for page in results {
            if let Some(id) = page.get("id").and_then(|id| id.as_str()) {
                let mut title_str = "Untitled Note".to_string();
                let mut desc_str = "".to_string();
                let mut status_str = "Unknown".to_string();
                let mut date_str = "".to_string();

                if let Some(properties) = page.get("properties").and_then(|p| p.as_object()) {
                    for (_, prop_obj) in properties {
                        let prop_type = prop_obj.get("type").and_then(|t| t.as_str());
                        match prop_type {
                            Some("title") => {
                                if let Some(title_arr) =
                                    prop_obj.get("title").and_then(|t| t.as_array())
                                {
                                    if !title_arr.is_empty() {
                                        if let Some(content) = title_arr[0]
                                            .get("text")
                                            .and_then(|t| t.get("content"))
                                            .and_then(|c| c.as_str())
                                        {
                                            title_str = content.to_string();
                                        }
                                    }
                                }
                            }
                            Some("rich_text") => {
                                if let Some(rt_arr) =
                                    prop_obj.get("rich_text").and_then(|t| t.as_array())
                                {
                                    if !rt_arr.is_empty() {
                                        if let Some(content) = rt_arr[0]
                                            .get("text")
                                            .and_then(|t| t.get("content"))
                                            .and_then(|c| c.as_str())
                                        {
                                            desc_str = content.to_string();
                                        }
                                    }
                                }
                            }
                            Some("status") => {
                                if let Some(status_obj) =
                                    prop_obj.get("status").and_then(|s| s.as_object())
                                {
                                    if let Some(name) =
                                        status_obj.get("name").and_then(|n| n.as_str())
                                    {
                                        status_str = name.to_string();
                                    }
                                }
                            }
                            Some("date") => {
                                if let Some(date_obj) =
                                    prop_obj.get("date").and_then(|d| d.as_object())
                                {
                                    if let Some(start) =
                                        date_obj.get("start").and_then(|s| s.as_str())
                                    {
                                        date_str = start.to_string();
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                }
                notes.push(NotionNote {
                    id: id.to_string(),
                    title: title_str,
                    description: desc_str,
                    status: status_str,
                    date: date_str,
                });
            }
        }
    }

    Ok(notes)
}

#[tauri::command]
pub async fn ensure_notion_schema(token: String, db_id: String) -> Result<(), String> {
    tracing::info!("Ensuring Notion DB schema for db_id: {}", db_id);
    if token.is_empty() || db_id.is_empty() {
        return Err("Notion token or DB ID missing".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // We simply PATCH the database with the required properties.
    // Notion ignores existing properties and adds new ones.
    let body = serde_json::json!({
        "properties": {
            "Description": { "rich_text": {} },
            "Date": { "date": {} },
            "Status": {
                "status": {
                    "options": [
                        { "name": "Not started", "color": "default" },
                        { "name": "In progress", "color": "blue" },
                        { "name": "Done", "color": "green" }
                    ]
                }
            }
        }
    });

    let res = client
        .patch(format!("https://api.notion.com/v1/databases/{}", db_id))
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
        tracing::error!("Notion Schema Update Error {}: {}", status, error_text);
        // We don't hard fail here just in case they don't have permissions to update DB schema,
        // but it's good to log it.
        return Err(format!(
            "Notion Schema Update Error ({}): {}",
            status, error_text
        ));
    }

    tracing::info!("Notion DB Schema ensured successfully.");
    Ok(())
}

#[tauri::command]
pub async fn delete_notion_note(token: String, page_id: String) -> Result<(), String> {
    if token.is_empty() || page_id.is_empty() {
        return Err("Notion token or Page ID missing".to_string());
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({ "archived": true });

    let res = client
        .patch(format!("https://api.notion.com/v1/pages/{}", page_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        let err = res.text().await.unwrap_or_default();
        return Err(format!("Notion API Error: {}", err));
    }
    Ok(())
}

#[tauri::command]
pub async fn update_notion_status(
    token: String,
    page_id: String,
    status: String,
) -> Result<(), String> {
    if token.is_empty() || page_id.is_empty() {
        return Err("Notion token or Page ID missing".to_string());
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "properties": {
            "Status": {
                "status": { "name": status }
            }
        }
    });

    let res = client
        .patch(format!("https://api.notion.com/v1/pages/{}", page_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        let err = res.text().await.unwrap_or_default();
        return Err(format!("Notion API Error: {}", err));
    }
    Ok(())
}

#[tauri::command]
pub async fn update_notion_page(
    token: String,
    page_id: String,
    title: String,
    description: String,
) -> Result<(), String> {
    if token.is_empty() || page_id.is_empty() {
        return Err("Notion token or Page ID missing".to_string());
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "properties": {
            "Title": {
                "title": [
                    { "text": { "content": title } }
                ]
            },
            "Description": {
                "rich_text": [
                    { "text": { "content": description } }
                ]
            }
        }
    });

    let res = client
        .patch(format!("https://api.notion.com/v1/pages/{}", page_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        let err = res.text().await.unwrap_or_default();
        return Err(format!("Notion API Error: {}", err));
    }
    Ok(())
}

#[tauri::command]
pub async fn update_notion_page_full(
    token: String,
    page_id: String,
    title: String,
    description: String,
    content: String,
    tasks: Vec<String>,
) -> Result<(), String> {
    // 1. Update title and description properties
    update_notion_page(token.clone(), page_id.clone(), title, description).await?;

    // 2. Fetch existing blocks
    let blocks = fetch_notion_blocks(token.clone(), page_id.clone()).await?;

    // 3. Delete existing blocks
    let client = reqwest::Client::new();
    for block in blocks {
        let _ = client
            .delete(format!("https://api.notion.com/v1/blocks/{}", block.id))
            .header("Authorization", format!("Bearer {}", token))
            .header("Notion-Version", "2022-06-28")
            .send()
            .await;
    }

    // 4. Append new blocks
    let mut children = Vec::new();
    let content_trim = content.trim();
    if !content_trim.is_empty() {
        children.push(serde_json::json!({
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    { "type": "text", "text": { "content": content_trim } }
                ]
            }
        }));
    }

    for task in tasks {
        let t = task.trim();
        if !t.is_empty() {
            children.push(serde_json::json!({
                "object": "block",
                "type": "to_do",
                "to_do": {
                    "rich_text": [
                        { "type": "text", "text": { "content": t } }
                    ],
                    "checked": false
                }
            }));
        }
    }

    if !children.is_empty() {
        let body = serde_json::json!({ "children": children });
        let res = client
            .patch(format!(
                "https://api.notion.com/v1/blocks/{}/children",
                page_id
            ))
            .header("Authorization", format!("Bearer {}", token))
            .header("Notion-Version", "2022-06-28")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !res.status().is_success() {
            let err = res.text().await.unwrap_or_default();
            return Err(format!("Notion API Error: {}", err));
        }
    }

    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct NotionBlock {
    pub id: String,
    pub b_type: String,
    pub task_text: String,
    pub checked: bool,
}

#[tauri::command]
pub async fn fetch_notion_blocks(
    token: String,
    block_id: String,
) -> Result<Vec<NotionBlock>, String> {
    if token.is_empty() || block_id.is_empty() {
        return Err("Notion token or Block ID missing".to_string());
    }

    let client = reqwest::Client::new();
    let res = client
        .get(format!(
            "https://api.notion.com/v1/blocks/{}/children",
            block_id
        ))
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        let err = res.text().await.unwrap_or_default();
        return Err(format!("Notion API Error: {}", err));
    }

    let json_res: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("JSON Parse failed: {}", e))?;
    let mut blocks = Vec::new();

    if let Some(results) = json_res.get("results").and_then(|r| r.as_array()) {
        for block in results {
            if let Some(b_type) = block.get("type").and_then(|t| t.as_str()) {
                if b_type == "to_do" || b_type == "paragraph" {
                    if let Some(block_data) = block.get(b_type).and_then(|t| t.as_object()) {
                        let id = block
                            .get("id")
                            .and_then(|i| i.as_str())
                            .unwrap_or("")
                            .to_string();
                        let checked = block_data
                            .get("checked")
                            .and_then(|c| c.as_bool())
                            .unwrap_or(false);

                        let mut text = "".to_string();
                        if let Some(rt_arr) =
                            block_data.get("rich_text").and_then(|rt| rt.as_array())
                        {
                            if !rt_arr.is_empty() {
                                if let Some(content) = rt_arr[0]
                                    .get("text")
                                    .and_then(|t| t.get("content"))
                                    .and_then(|c| c.as_str())
                                {
                                    text = content.to_string();
                                }
                            }
                        }

                        blocks.push(NotionBlock {
                            id,
                            b_type: b_type.to_string(),
                            task_text: text,
                            checked,
                        });
                    }
                }
            }
        }
    }

    Ok(blocks)
}

#[tauri::command]
pub async fn toggle_notion_task(
    token: String,
    block_id: String,
    checked: bool,
) -> Result<(), String> {
    if token.is_empty() || block_id.is_empty() {
        return Err("Notion token or Block ID missing".to_string());
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "to_do": { "checked": checked }
    });

    let res = client
        .patch(format!("https://api.notion.com/v1/blocks/{}", block_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Notion-Version", "2022-06-28")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        let err = res.text().await.unwrap_or_default();
        return Err(format!("Notion API Error: {}", err));
    }
    Ok(())
}
