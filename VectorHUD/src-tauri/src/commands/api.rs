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
            "Name": {
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

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct UnifiedLlmResponse {
    pub content: String,
    pub total_tokens: u32,
    pub tool_calls: Option<serde_json::Value>,
}

fn map_messages_to_anthropic(messages: &Vec<serde_json::Value>) -> Vec<serde_json::Value> {
    let mut anthropic_messages = Vec::new();
    for msg in messages {
        let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user");
        let content_val = msg.get("content");

        // Handle tool role (maps to user role with tool_result block in Anthropic)
        if role == "tool" {
            let tool_use_id = msg
                .get("tool_call_id")
                .and_then(|id| id.as_str())
                .unwrap_or("");
            let content_str = content_val.and_then(|c| c.as_str()).unwrap_or("");
            let block = serde_json::json!({
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "content": content_str
            });
            anthropic_messages.push(serde_json::json!({
                "role": "user",
                "content": vec![block]
            }));
            continue;
        }

        // Handle assistant role with potential tool calls
        if role == "assistant" {
            let mut mapped_content = Vec::new();
            if let Some(content_str) = content_val.and_then(|c| c.as_str()) {
                if !content_str.is_empty() {
                    mapped_content.push(serde_json::json!({
                        "type": "text",
                        "text": content_str
                    }));
                }
            }
            if let Some(tool_calls_arr) = msg.get("tool_calls").and_then(|tc| tc.as_array()) {
                for tc in tool_calls_arr {
                    let tc_id = tc.get("id").and_then(|i| i.as_str()).unwrap_or("");
                    let tc_name = tc
                        .get("function")
                        .and_then(|f| f.get("name"))
                        .and_then(|n| n.as_str())
                        .unwrap_or("");
                    let tc_args_str = tc
                        .get("function")
                        .and_then(|f| f.get("arguments"))
                        .and_then(|a| a.as_str())
                        .unwrap_or("{}");
                    let tc_args: serde_json::Value =
                        serde_json::from_str(tc_args_str).unwrap_or(serde_json::json!({}));

                    mapped_content.push(serde_json::json!({
                        "type": "tool_use",
                        "id": tc_id,
                        "name": tc_name,
                        "input": tc_args
                    }));
                }
            }
            if !mapped_content.is_empty() {
                anthropic_messages.push(serde_json::json!({
                    "role": "assistant",
                    "content": mapped_content
                }));
            }
            continue;
        }

        // Standard user/system message translation
        if let Some(content) = content_val {
            if let Some(text_str) = content.as_str() {
                anthropic_messages.push(serde_json::json!({
                    "role": role,
                    "content": text_str
                }));
            } else if let Some(arr) = content.as_array() {
                let mut mapped_content = Vec::new();
                for block in arr {
                    let b_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("text");
                    if b_type == "text" {
                        let text_val = block.get("text").and_then(|t| t.as_str()).unwrap_or("");
                        mapped_content.push(serde_json::json!({
                            "type": "text",
                            "text": text_val
                        }));
                    } else if b_type == "image_url" {
                        let url_val = block
                            .get("image_url")
                            .and_then(|iu| iu.get("url"))
                            .and_then(|u| u.as_str())
                            .unwrap_or("");

                        if url_val.starts_with("data:") {
                            if let Some(comma_idx) = url_val.find(',') {
                                let header = &url_val[..comma_idx];
                                let base64_data = &url_val[comma_idx + 1..];
                                let media_type = header.replace("data:", "").replace(";base64", "");

                                mapped_content.push(serde_json::json!({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": media_type,
                                        "data": base64_data
                                    }
                                }));
                            }
                        }
                    }
                }
                anthropic_messages.push(serde_json::json!({
                    "role": role,
                    "content": mapped_content
                }));
            }
        }
    }
    anthropic_messages
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn call_ai_api(
    provider: String,
    model: String,
    messages: Vec<serde_json::Value>,
    system_prompt: String,
    api_key: String,
    tools: Option<serde_json::Value>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
    top_p: Option<f64>,
    top_k: Option<u32>,
) -> Result<UnifiedLlmResponse, String> {
    tracing::info!("call_ai_api: provider='{}', model='{}'", provider, model);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| {
            let err = format!("Failed to build HTTP client: {}", e);
            tracing::error!("{}", err);
            err
        })?;

    match provider.as_str() {
        "openai" | "groq" | "openrouter" => {
            let url = match provider.as_str() {
                "openai" => "https://api.openai.com/v1/chat/completions",
                "groq" => "https://api.groq.com/openai/v1/chat/completions",
                _ => "https://openrouter.ai/api/v1/chat/completions",
            };

            let mut body_messages = vec![serde_json::json!({
                "role": "system",
                "content": system_prompt
            })];
            for msg in messages {
                body_messages.push(msg);
            }

            let mut body = serde_json::json!({
                "model": model,
                "messages": body_messages
            });

            if let Some(body_obj) = body.as_object_mut() {
                if let Some(t) = &tools {
                    body_obj.insert("tools".to_string(), t.clone());
                    body_obj.insert("tool_choice".to_string(), serde_json::json!("auto"));
                }
                if let Some(temp) = temperature {
                    body_obj.insert("temperature".to_string(), serde_json::json!(temp));
                }
                if let Some(tokens) = max_tokens {
                    if tokens > 0 {
                        body_obj.insert("max_tokens".to_string(), serde_json::json!(tokens));
                    }
                }
                if let Some(p) = top_p {
                    body_obj.insert("top_p".to_string(), serde_json::json!(p));
                }
                if let Some(k) = top_k {
                    body_obj.insert("top_k".to_string(), serde_json::json!(k));
                }
            }

            let mut req = client
                .post(url)
                .header("Content-Type", "application/json")
                .header("Authorization", format!("Bearer {}", api_key));

            if provider == "openrouter" {
                req = req
                    .header("HTTP-Referer", "http://localhost:1420")
                    .header("X-Title", "VectorHUD");
            }

            let res = req.json(&body).send().await.map_err(|e| {
                let err = format!("HTTP Request to '{}' failed: {}", provider, e);
                tracing::error!("{}", err);
                err
            })?;

            let status = res.status();
            let raw_text = res.text().await.map_err(|e| {
                let err = format!("Failed to read response body: {}", e);
                tracing::error!("{}", err);
                err
            })?;

            // Log response body if not successful
            if !status.is_success() {
                tracing::error!("AI API Error ({}): Raw Body: {}", status, raw_text);

                // Try to parse error structure
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&raw_text) {
                    if let Some(err_msg) = data
                        .get("error")
                        .and_then(|e| e.get("message"))
                        .and_then(|m| m.as_str())
                    {
                        return Err(format!("AI Provider Error: {}", err_msg));
                    }
                }
                return Err(format!("Request failed with status code {}", status));
            }

            let data: serde_json::Value = serde_json::from_str(&raw_text).map_err(|e| {
                let err = format!("Failed to parse response JSON: {}", e);
                tracing::error!("{}", err);
                err
            })?;

            let content = data["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let tool_calls = data["choices"][0]["message"].get("tool_calls").cloned();
            let total_tokens = data["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32;

            tracing::info!("call_ai_api success: tokens={}", total_tokens);
            Ok(UnifiedLlmResponse {
                content,
                total_tokens,
                tool_calls,
            })
        }
        "anthropic" => {
            let mapped_messages = map_messages_to_anthropic(&messages);
            let final_max_tokens = match max_tokens {
                Some(tokens) if tokens > 0 => tokens,
                _ => 4096, // default for Anthropic since it's required
            };

            let mut body = serde_json::json!({
                "model": model,
                "system": system_prompt,
                "messages": mapped_messages,
                "max_tokens": final_max_tokens
            });

            if let Some(body_obj) = body.as_object_mut() {
                if let Some(t) = &tools {
                    body_obj.insert("tools".to_string(), t.clone());
                }
                if let Some(temp) = temperature {
                    body_obj.insert("temperature".to_string(), serde_json::json!(temp));
                }
                if let Some(p) = top_p {
                    body_obj.insert("top_p".to_string(), serde_json::json!(p));
                }
                if let Some(k) = top_k {
                    body_obj.insert("top_k".to_string(), serde_json::json!(k));
                }
            }

            let res = client
                .post("https://api.anthropic.com/v1/messages")
                .header("Content-Type", "application/json")
                .header("x-api-key", api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&body)
                .send()
                .await
                .map_err(|e| {
                    let err = format!("HTTP Request to Anthropic failed: {}", e);
                    tracing::error!("{}", err);
                    err
                })?;

            let status = res.status();
            let raw_text = res.text().await.map_err(|e| {
                let err = format!("Failed to read response body: {}", e);
                tracing::error!("{}", err);
                err
            })?;

            if !status.is_success() {
                tracing::error!("Anthropic API Error ({}): Raw Body: {}", status, raw_text);

                if let Ok(data) = serde_json::from_str::<serde_json::Value>(&raw_text) {
                    if let Some(err_msg) = data
                        .get("error")
                        .and_then(|e| e.get("message"))
                        .and_then(|m| m.as_str())
                    {
                        return Err(format!("Anthropic Error: {}", err_msg));
                    }
                }
                return Err(format!("Anthropic failed with status code {}", status));
            }

            let data: serde_json::Value = serde_json::from_str(&raw_text).map_err(|e| {
                let err = format!("Failed to parse Anthropic JSON: {}", e);
                tracing::error!("{}", err);
                err
            })?;

            let mut text_parts = Vec::new();
            let mut unified_tool_calls = Vec::new();

            if let Some(arr) = data["content"].as_array() {
                for block in arr {
                    let b_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    if b_type == "text" {
                        if let Some(txt) = block.get("text").and_then(|t| t.as_str()) {
                            text_parts.push(txt.to_string());
                        }
                    } else if b_type == "tool_use" {
                        let id = block.get("id").and_then(|i| i.as_str()).unwrap_or("");
                        let name = block.get("name").and_then(|n| n.as_str()).unwrap_or("");
                        let input = block.get("input").cloned().unwrap_or(serde_json::json!({}));
                        unified_tool_calls.push(serde_json::json!({
                            "id": id,
                            "type": "function",
                            "function": {
                                "name": name,
                                "arguments": input.to_string()
                            }
                        }));
                    }
                }
            }

            let content = text_parts.join("\n");
            let tool_calls = if !unified_tool_calls.is_empty() {
                Some(serde_json::Value::Array(unified_tool_calls))
            } else {
                None
            };

            let input_tokens = data["usage"]["input_tokens"].as_u64().unwrap_or(0);
            let output_tokens = data["usage"]["output_tokens"].as_u64().unwrap_or(0);
            let total_tokens = (input_tokens + output_tokens) as u32;

            tracing::info!("call_ai_api success: tokens={}", total_tokens);
            Ok(UnifiedLlmResponse {
                content,
                total_tokens,
                tool_calls,
            })
        }
        _ => {
            let err = format!("Unsupported AI provider: {}", provider);
            tracing::error!("{}", err);
            Err(err)
        }
    }
}

#[tauri::command]
pub async fn transcribe_audio_api(
    provider: String,
    api_key: String,
    base64_wav: String,
) -> Result<String, String> {
    tracing::info!("transcribe_audio_api: provider='{}'", provider);

    if api_key.is_empty() {
        return Err("API key is missing".to_string());
    }

    if base64_wav.is_empty() {
        return Err("Audio data is empty".to_string());
    }

    // Parse base64
    let base64_data = if let Some(comma_idx) = base64_wav.find(',') {
        &base64_wav[comma_idx + 1..]
    } else {
        &base64_wav
    };

    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let wav_bytes = STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Failed to decode base64 audio: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let (url, model) = match provider.as_str() {
        "groq" => (
            "https://api.groq.com/openai/v1/audio/transcriptions",
            "whisper-large-v3",
        ),
        "openai" => (
            "https://api.openai.com/v1/audio/transcriptions",
            "whisper-1",
        ),
        _ => return Err(format!("Unsupported transcription provider: {}", provider)),
    };

    // Construct multipart form
    use reqwest::multipart;
    let part = multipart::Part::bytes(wav_bytes)
        .file_name("speech.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("Failed to set mime type: {}", e))?;

    let form = multipart::Form::new()
        .text("model", model)
        .part("file", part);

    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("HTTP request to {} transcription failed: {}", provider, e))?;

    let status = res.status();
    let raw_text = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    if !status.is_success() {
        tracing::error!(
            "Transcription API Error ({}): Raw Body: {}",
            status,
            raw_text
        );
        if let Ok(data) = serde_json::from_str::<serde_json::Value>(&raw_text) {
            if let Some(err_msg) = data
                .get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
            {
                return Err(format!("Transcription API Error: {}", err_msg));
            }
        }
        return Err(format!(
            "Transcription request failed with status {}",
            status
        ));
    }

    let data: serde_json::Value = serde_json::from_str(&raw_text)
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;

    let text = data
        .get("text")
        .and_then(|t| t.as_str())
        .ok_or_else(|| "Transcription response contains no text".to_string())?
        .to_string();

    Ok(text)
}

#[tauri::command]
pub async fn read_attached_file(path: String) -> Result<String, String> {
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let extension = path_buf
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    if extension == "pdf" {
        let bytes =
            std::fs::read(&path_buf).map_err(|e| format!("Failed to read PDF file: {}", e))?;

        let text = tokio::task::spawn_blocking(move || pdf_extract::extract_text_from_mem(&bytes))
            .await
            .map_err(|e| format!("Join error during PDF extraction: {}", e))?
            .map_err(|e| format!("Failed to extract text from PDF: {}", e))?;

        Ok(text)
    } else {
        let text = std::fs::read_to_string(&path_buf)
            .map_err(|e| format!("Failed to read file as UTF-8 string: {}", e))?;
        Ok(text)
    }
}

#[tauri::command]
pub async fn select_attached_files(window: tauri::Window) -> Result<Vec<String>, String> {
    let _ = window.set_always_on_top(false);

    let window_clone = window.clone();
    let files = tokio::task::spawn_blocking(move || {
        rfd::FileDialog::new()
            .add_filter(
                "Documents",
                &["txt", "html", "css", "js", "py", "json", "md", "pdf"],
            )
            .set_parent(&window_clone)
            .pick_files()
    })
    .await
    .map_err(|e| {
        let _ = window.set_always_on_top(true);
        format!("Join error during file selection: {}", e)
    })?;

    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();

    if let Some(paths) = files {
        Ok(paths
            .into_iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect())
    } else {
        Ok(vec![])
    }
}

#[derive(serde::Serialize)]
pub struct AttachedFileData {
    name: String,
    path: String,
    content: String,
    size: u64,
    lines: usize,
}

#[tauri::command]
pub async fn read_attached_file_data(path: String) -> Result<AttachedFileData, String> {
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        return Err(format!("File does not exist: {}", path));
    }

    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let metadata = path_buf
        .metadata()
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let size = metadata.len();

    let extension = path_buf
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    let content = if extension == "pdf" {
        let bytes =
            std::fs::read(&path_buf).map_err(|e| format!("Failed to read PDF file: {}", e))?;
        tokio::task::spawn_blocking(move || pdf_extract::extract_text_from_mem(&bytes))
            .await
            .map_err(|e| format!("Join error during PDF extraction: {}", e))?
            .map_err(|e| format!("Failed to extract text from PDF: {}", e))?
    } else {
        std::fs::read_to_string(&path_buf).map_err(|e| format!("Failed to read file: {}", e))?
    };

    let lines = content.lines().count();

    Ok(AttachedFileData {
        name,
        path,
        content,
        size,
        lines,
    })
}

#[tauri::command]
pub async fn wipe_and_reset_database(app: tauri::AppHandle) -> Result<(), String> {
    use std::fs;
    use tauri::Manager;

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("vectorhud.db");

    tracing::info!(
        "wipe_and_reset_database: attempting to delete database file at {:?}",
        db_path
    );

    if db_path.exists() {
        fs::remove_file(&db_path).map_err(|e| format!("Failed to delete database file: {}", e))?;
        tracing::info!("wipe_and_reset_database: database file deleted successfully");
    } else {
        tracing::info!("wipe_and_reset_database: database file does not exist");
    }

    Ok(())
}

#[tauri::command]
pub fn open_app_data_folder(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create AppData directory: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&app_dir)
            .spawn()
            .map_err(|e| format!("Failed to open AppData folder: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn test_mcp_connection(command: String, args: String) -> Result<String, String> {
    let args_list: Vec<&str> = if args.trim().is_empty() {
        vec!["--version"]
    } else {
        args.split_whitespace().collect()
    };

    let mut cmd = std::process::Command::new(&command);
    cmd.args(&args_list);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let check_res = cmd.output();

    match check_res {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let display = if stdout.is_empty() {
                    "Executable found and responded".to_string()
                } else {
                    stdout
                };
                Ok(format!("Connection successful: {}", display))
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let display = if stderr.is_empty() {
                    format!("Exit code: {}", output.status.code().unwrap_or(-1))
                } else {
                    stderr
                };
                Ok(format!("Executable found but returned error: {}", display))
            }
        }
        Err(e) => {
            if cfg!(target_os = "windows") {
                let fallback_args = if args.trim().is_empty() {
                    "--version"
                } else {
                    args.trim()
                };
                let mut cmd_fallback = std::process::Command::new("cmd");
                // Run the command directly through cmd /C so CREATE_NO_WINDOW hides it
                cmd_fallback.args(["/C", &format!("{} {}", command, fallback_args)]);

                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    cmd_fallback.creation_flags(0x08000000); // CREATE_NO_WINDOW
                }

                let shell_res = cmd_fallback.output();
                match shell_res {
                    Ok(output) => {
                        if output.status.success() {
                            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                            let display = if stdout.is_empty() {
                                "Connection successful via shell".to_string()
                            } else {
                                stdout
                            };
                            Ok(format!("Connection successful: {}", display))
                        } else {
                            Err(format!(
                                "Shell command failed: {}",
                                String::from_utf8_lossy(&output.stderr).trim()
                            ))
                        }
                    }
                    Err(err) => Err(format!("Command not found or failed to spawn: {}", err)),
                }
            } else {
                Err(format!("Failed to spawn command: {}", e))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[tokio::test]
    async fn test_read_attached_file_text() {
        let temp_dir = std::env::temp_dir();
        let file_path = temp_dir.join("vectorhud_test_attached.txt");

        let mut file = std::fs::File::create(&file_path).unwrap();
        writeln!(file, "Hello from VectorHUD file attachment test!").unwrap();

        let path_str = file_path.to_string_lossy().to_string();
        let result = read_attached_file(path_str).await;

        assert!(result.is_ok());
        assert!(result
            .unwrap()
            .contains("Hello from VectorHUD file attachment test!"));

        let _ = std::fs::remove_file(file_path);
    }

    #[tokio::test]
    async fn test_read_attached_file_nonexistent() {
        let result = read_attached_file("nonexistent_file_path_12345.xyz".to_string()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File does not exist"));
    }

    #[tokio::test]
    async fn test_call_ai_api_invalid_keys() {
        // OpenAI invalid key check
        let res_openai = call_ai_api(
            "openai".to_string(),
            "gpt-4o".to_string(),
            vec![serde_json::json!({"role": "user", "content": "Hello"})],
            "System prompt".to_string(),
            "invalid_key_for_testing".to_string(),
            None,
            None,
            None,
            None,
            None,
        )
        .await;

        assert!(res_openai.is_err());
        let err_openai = res_openai.unwrap_err();
        assert!(
            err_openai.contains("AI Provider Error")
                || err_openai.contains("Incorrect API key")
                || err_openai.contains("failed")
                || err_openai.contains("status code")
        );

        // Anthropic invalid key check
        let res_anthropic = call_ai_api(
            "anthropic".to_string(),
            "claude-3-5-sonnet".to_string(),
            vec![serde_json::json!({"role": "user", "content": "Hello"})],
            "System prompt".to_string(),
            "invalid_key_for_testing".to_string(),
            None,
            None,
            None,
            None,
            None,
        )
        .await;

        assert!(res_anthropic.is_err());
        let err_anthropic = res_anthropic.unwrap_err();
        assert!(
            err_anthropic.contains("Anthropic Error")
                || err_anthropic.contains("x-api-key")
                || err_anthropic.contains("failed")
                || err_anthropic.contains("status code")
        );

        // Groq invalid key check
        let res_groq = call_ai_api(
            "groq".to_string(),
            "llama-3.1-8b-instant".to_string(),
            vec![serde_json::json!({"role": "user", "content": "Hello"})],
            "System prompt".to_string(),
            "invalid_key_for_testing".to_string(),
            None,
            None,
            None,
            None,
            None,
        )
        .await;

        assert!(res_groq.is_err());
        let err_groq = res_groq.unwrap_err();
        assert!(
            err_groq.contains("AI Provider Error")
                || err_groq.contains("Incorrect API key")
                || err_groq.contains("failed")
                || err_groq.contains("status code")
                || err_groq.contains("Invalid API Key")
        );

        // OpenRouter invalid key check
        let res_or = call_ai_api(
            "openrouter".to_string(),
            "google/gemini-2.5-flash".to_string(),
            vec![serde_json::json!({"role": "user", "content": "Hello"})],
            "System prompt".to_string(),
            "invalid_key_for_testing".to_string(),
            None,
            None,
            None,
            None,
            None,
        )
        .await;

        assert!(res_or.is_err());
        let err_or = res_or.unwrap_err();
        assert!(
            err_or.contains("AI Provider Error")
                || err_or.contains("Incorrect API key")
                || err_or.contains("failed")
                || err_or.contains("status code")
                || err_or.contains("credentials")
        );
    }

    #[tokio::test]
    async fn test_test_mcp_connection_valid() {
        #[cfg(target_os = "windows")]
        {
            let res = test_mcp_connection("cmd".to_string(), "/C echo test_ok".to_string()).await;
            assert!(res.is_ok());
            let msg = res.unwrap();
            assert!(msg.contains("Connection successful") && msg.contains("test_ok"));
        }
        #[cfg(not(target_os = "windows"))]
        {
            let res = test_mcp_connection("echo".to_string(), "test_ok".to_string()).await;
            assert!(res.is_ok());
            let msg = res.unwrap();
            assert!(msg.contains("Connection successful") && msg.contains("test_ok"));
        }
    }
}
