use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{Row, SqlitePool};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::SystemTime,
};
use tauri::{AppHandle, Runtime};

const MAX_SUMMARY_CHARS: usize = 180;
const MAX_DETAIL_CHARS: usize = 500_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddChatLinkInput {
    source: String,
    kind: String,
    url_or_file: String,
    title: Option<String>,
    summary: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct ChatLinkRecord {
    id: i64,
    project_id: i64,
    source: String,
    kind: String,
    url_or_file: String,
    title: String,
    summary: Option<String>,
    captured_at: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct ChatImportCandidate {
    source: String,
    kind: String,
    url_or_file: String,
    title: String,
    summary: Option<String>,
    captured_at: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct ChatLinkDetail {
    id: i64,
    project_id: i64,
    source: String,
    kind: String,
    url_or_file: String,
    title: String,
    summary: Option<String>,
    captured_at: String,
    content: String,
    truncated: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanLocalChatExportsInput {
    source: String,
    limit: Option<usize>,
}

struct NormalizedChatLink {
    source: String,
    kind: String,
    url_or_file: String,
    title: String,
    summary: Option<String>,
}

struct LocalChatFile {
    path: PathBuf,
    modified: SystemTime,
}

#[tauri::command]
pub async fn list_chat_links<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
) -> Result<Vec<ChatLinkRecord>, String> {
    let pool = crate::projects::database_pool(&app).await?;
    crate::projects::get_project_path_by_id(&pool, id).await?;
    list_chat_link_records(&pool, id).await
}

#[tauri::command]
pub async fn add_chat_link<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    link: AddChatLinkInput,
) -> Result<ChatLinkRecord, String> {
    let pool = crate::projects::database_pool(&app).await?;
    crate::projects::get_project_path_by_id(&pool, id).await?;
    let link = normalize_chat_link(link)?;

    let result = sqlx::query(
        "INSERT INTO chat_links (project_id, source, kind, url_or_file, title, summary)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(id)
    .bind(&link.source)
    .bind(&link.kind)
    .bind(&link.url_or_file)
    .bind(&link.title)
    .bind(&link.summary)
    .execute(&pool)
    .await
    .map_err(|error| format!("无法添加聊天记录: {error}"))?;

    get_chat_link_record(&pool, id, result.last_insert_rowid()).await
}

#[tauri::command]
pub async fn delete_chat_link<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    chat_id: i64,
) -> Result<String, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let result = sqlx::query("DELETE FROM chat_links WHERE project_id = $1 AND id = $2")
        .bind(id)
        .bind(chat_id)
        .execute(&pool)
        .await
        .map_err(|error| format!("无法删除聊天记录: {error}"))?;

    if result.rows_affected() == 0 {
        return Err(format!("聊天记录不存在: {chat_id}"));
    }
    Ok("聊天记录已删除".to_string())
}

#[tauri::command]
pub async fn open_chat_link<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    chat_id: i64,
) -> Result<String, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let chat = get_chat_link_record(&pool, id, chat_id).await?;
    if chat.kind == "import" {
        let path = normalize_existing_file(&chat.url_or_file)?;
        reveal_target(&path)?;
        return Ok(format!("已定位 {}", chat.title));
    }
    open_target(&chat.url_or_file)?;
    Ok(format!("已打开 {}", chat.title))
}

#[tauri::command]
pub async fn read_chat_link_detail<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    chat_id: i64,
) -> Result<ChatLinkDetail, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let chat = get_chat_link_record(&pool, id, chat_id).await?;

    let (content, truncated) = if chat.kind == "import" {
        let path = normalize_existing_file(&chat.url_or_file)?;
        let content = fs::read_to_string(&path)
            .map_err(|error| format!("无法读取聊天导出文件 {}: {error}", path.display()))?;
        parse_chat_detail(&path, &content, &chat)?
    } else {
        truncate_detail(
            chat.summary
                .clone()
                .unwrap_or_else(|| format!("分享链接: {}", chat.url_or_file)),
        )
    };

    Ok(ChatLinkDetail {
        id: chat.id,
        project_id: chat.project_id,
        source: chat.source,
        kind: chat.kind,
        url_or_file: chat.url_or_file,
        title: chat.title,
        summary: chat.summary,
        captured_at: chat.captured_at,
        content,
        truncated,
    })
}

#[tauri::command]
pub fn import_chat_export(file: String) -> Result<Vec<ChatImportCandidate>, String> {
    let path = normalize_existing_file(&file)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("无法读取聊天导出文件 {}: {error}", path.display()))?;
    parse_chat_export(&path, &content)
}

#[tauri::command]
pub fn scan_local_chat_exports(
    input: ScanLocalChatExportsInput,
) -> Result<Vec<ChatImportCandidate>, String> {
    let source = normalize_source(&input.source)?;
    let limit = input.limit.unwrap_or(30).clamp(1, 100);
    let roots = default_chat_roots(&source)?;
    let mut files = Vec::new();
    for root in roots {
        collect_jsonl_files(&root, &source, &mut files);
    }
    files.sort_by(|left, right| right.modified.cmp(&left.modified));

    let mut candidates = Vec::new();
    for file in files.into_iter().take(limit.saturating_mul(3)) {
        let Ok(content) = fs::read_to_string(&file.path) else {
            continue;
        };
        let Ok(parsed) = parse_chat_export(&file.path, &content) else {
            continue;
        };
        for candidate in parsed {
            if candidate.source == source {
                candidates.push(candidate);
                if candidates.len() >= limit {
                    return Ok(candidates);
                }
            }
        }
    }

    Ok(candidates)
}

async fn list_chat_link_records(
    pool: &SqlitePool,
    project_id: i64,
) -> Result<Vec<ChatLinkRecord>, String> {
    let rows = sqlx::query(
        "SELECT id, project_id, source, kind, url_or_file, title, summary, captured_at
         FROM chat_links
         WHERE project_id = $1
         ORDER BY captured_at DESC, id DESC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("无法读取聊天记录: {error}"))?;

    rows.iter().map(chat_link_from_row).collect()
}

async fn get_chat_link_record(
    pool: &SqlitePool,
    project_id: i64,
    chat_id: i64,
) -> Result<ChatLinkRecord, String> {
    let row = sqlx::query(
        "SELECT id, project_id, source, kind, url_or_file, title, summary, captured_at
         FROM chat_links
         WHERE project_id = $1 AND id = $2",
    )
    .bind(project_id)
    .bind(chat_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("无法读取聊天记录: {error}"))?
    .ok_or_else(|| format!("聊天记录不存在: {chat_id}"))?;

    chat_link_from_row(&row)
}

fn chat_link_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<ChatLinkRecord, String> {
    Ok(ChatLinkRecord {
        id: row
            .try_get("id")
            .map_err(|error| format!("无法解析聊天记录 ID: {error}"))?,
        project_id: row
            .try_get("project_id")
            .map_err(|error| format!("无法解析项目 ID: {error}"))?,
        source: row
            .try_get("source")
            .map_err(|error| format!("无法解析聊天来源: {error}"))?,
        kind: row
            .try_get("kind")
            .map_err(|error| format!("无法解析聊天类型: {error}"))?,
        url_or_file: row
            .try_get("url_or_file")
            .map_err(|error| format!("无法解析聊天目标: {error}"))?,
        title: row
            .try_get("title")
            .map_err(|error| format!("无法解析聊天标题: {error}"))?,
        summary: row
            .try_get("summary")
            .map_err(|error| format!("无法解析聊天摘要: {error}"))?,
        captured_at: row
            .try_get("captured_at")
            .map_err(|error| format!("无法解析聊天记录时间: {error}"))?,
    })
}

fn normalize_chat_link(input: AddChatLinkInput) -> Result<NormalizedChatLink, String> {
    let source = normalize_source(&input.source)?;
    let kind = input.kind.trim();
    let raw_target = input.url_or_file.trim();
    if raw_target.is_empty() {
        return Err("请输入聊天链接或导出文件路径".to_string());
    }

    let (kind, url_or_file, fallback_title) = match kind {
        "link" => {
            if !is_supported_url(raw_target) {
                return Err("聊天分享链接必须以 http:// 或 https:// 开头".to_string());
            }
            (
                "link".to_string(),
                raw_target.to_string(),
                link_title(raw_target),
            )
        }
        "import" => {
            let path = normalize_existing_file(raw_target)?;
            let title = path
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .unwrap_or_else(|| path.to_string_lossy().to_string());
            (
                "import".to_string(),
                path.to_string_lossy().to_string(),
                title,
            )
        }
        _ => return Err(format!("不支持的聊天记录类型: {kind}")),
    };

    let title = normalized_text(input.title).unwrap_or(fallback_title);
    let summary = normalized_text(input.summary).map(|value| truncate_chars(&value, 500));
    Ok(NormalizedChatLink {
        source,
        kind,
        url_or_file,
        title,
        summary,
    })
}

fn parse_chat_export(path: &PathBuf, content: &str) -> Result<Vec<ChatImportCandidate>, String> {
    if let Ok(value) = serde_json::from_str::<Value>(content) {
        let candidates = parse_json_export(path, &value);
        if !candidates.is_empty() {
            return Ok(candidates);
        }
    }

    let jsonl_candidates = parse_jsonl_export(path, content);
    if !jsonl_candidates.is_empty() {
        return Ok(jsonl_candidates);
    }

    let candidates = parse_markdown_export(path, content);
    if candidates.is_empty() {
        return Err("没有从聊天导出文件中解析到对话".to_string());
    }
    Ok(candidates)
}

fn parse_jsonl_export(path: &PathBuf, content: &str) -> Vec<ChatImportCandidate> {
    let values = content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            serde_json::from_str::<Value>(trimmed).ok()
        })
        .collect::<Vec<_>>();
    if values.is_empty() {
        return Vec::new();
    }

    let Some(source) = detect_jsonl_source(&values) else {
        return Vec::new();
    };
    let title = jsonl_title(path, &source, &values);
    let captured_at = values.iter().find_map(jsonl_timestamp);
    let mut parts = Vec::new();
    for value in &values {
        collect_jsonl_text(&source, value, &mut parts);
    }
    let summary = summarize_text(&parts.join("\n"));
    vec![ChatImportCandidate {
        source,
        kind: "import".to_string(),
        url_or_file: path.to_string_lossy().to_string(),
        title,
        summary,
        captured_at,
    }]
}

fn parse_json_export(path: &PathBuf, value: &Value) -> Vec<ChatImportCandidate> {
    let conversations: Vec<&Value> = if let Some(items) = value.as_array() {
        items.iter().collect()
    } else if let Some(items) = value.get("conversations").and_then(Value::as_array) {
        items.iter().collect()
    } else {
        vec![value]
    };

    conversations
        .into_iter()
        .enumerate()
        .filter_map(|(index, conversation)| json_candidate(path, conversation, index))
        .collect()
}

fn json_candidate(
    path: &PathBuf,
    conversation: &Value,
    index: usize,
) -> Option<ChatImportCandidate> {
    let source = detect_source(conversation)?;
    let title = first_string(conversation, &["title", "name"])
        .unwrap_or_else(|| default_import_title(path, index));
    let text = extract_conversation_text(conversation);
    let summary = summarize_text(&text);
    let captured_at = first_string(
        conversation,
        &["created_at", "createdAt", "updated_at", "updatedAt"],
    );
    Some(ChatImportCandidate {
        source,
        kind: "import".to_string(),
        url_or_file: path.to_string_lossy().to_string(),
        title,
        summary,
        captured_at,
    })
}

fn parse_markdown_export(path: &PathBuf, content: &str) -> Vec<ChatImportCandidate> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let title = first_markdown_heading(trimmed).unwrap_or_else(|| default_import_title(path, 0));
    vec![ChatImportCandidate {
        source: detect_markdown_source(trimmed),
        kind: "import".to_string(),
        url_or_file: path.to_string_lossy().to_string(),
        title,
        summary: summarize_text(trimmed),
        captured_at: None,
    }]
}

fn parse_chat_detail(
    path: &PathBuf,
    content: &str,
    chat: &ChatLinkRecord,
) -> Result<(String, bool), String> {
    let detail = if let Ok(value) = serde_json::from_str::<Value>(content) {
        detail_from_json_export(path, &value, chat)
            .or_else(|| detail_from_jsonl_export(content))
            .unwrap_or_else(|| content.trim().to_string())
    } else {
        detail_from_jsonl_export(content).unwrap_or_else(|| content.trim().to_string())
    };

    if detail.trim().is_empty() {
        return Err("聊天导出文件里没有可展示的正文".to_string());
    }

    Ok(truncate_detail(detail))
}

fn detail_from_json_export(path: &PathBuf, value: &Value, chat: &ChatLinkRecord) -> Option<String> {
    let conversations = json_export_conversations(value);
    let mut fallback = None;

    for (index, conversation) in conversations.iter().enumerate() {
        let title = json_conversation_title(path, conversation, index);
        let detail = conversation_detail(conversation);
        if title == chat.title {
            return detail;
        }
        if fallback.is_none() {
            fallback = detail;
        }
    }

    fallback
}

fn json_export_conversations(value: &Value) -> Vec<&Value> {
    if let Some(items) = value.as_array() {
        items.iter().collect()
    } else if let Some(items) = value.get("conversations").and_then(Value::as_array) {
        items.iter().collect()
    } else {
        vec![value]
    }
}

fn json_conversation_title(path: &PathBuf, conversation: &Value, index: usize) -> String {
    first_string(conversation, &["title", "name"])
        .unwrap_or_else(|| default_import_title(path, index))
}

#[derive(Debug, PartialEq, Eq)]
struct ParsedChatMessage {
    role: String,
    content: String,
    timestamp: Option<String>,
}

fn detail_from_jsonl_export(content: &str) -> Option<String> {
    let values = content
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                return None;
            }
            serde_json::from_str::<Value>(trimmed).ok()
        })
        .collect::<Vec<_>>();
    let source = detect_jsonl_source(&values)?;
    let messages = values
        .iter()
        .filter_map(|value| jsonl_message_detail(&source, value))
        .collect::<Vec<_>>();

    if messages.is_empty() {
        return None;
    }

    Some(format_chat_messages(&messages))
}

fn jsonl_message_detail(source: &str, value: &Value) -> Option<ParsedChatMessage> {
    let role = json_role(value).unwrap_or_else(|| "event".to_string());
    let timestamp = jsonl_timestamp(value);
    let mut parts = Vec::new();

    match source {
        "codex" => {
            if let Some(payload) = value.get("payload") {
                collect_detail_text(payload, &mut parts);
            }
        }
        "claude_code" => {
            if let Some(content) = value.pointer("/message/content") {
                collect_detail_text(content, &mut parts);
            }
        }
        _ => collect_detail_text(value, &mut parts),
    }

    let content = join_detail_parts(parts);
    if content.is_empty() {
        return None;
    }

    Some(ParsedChatMessage {
        role,
        content,
        timestamp,
    })
}

fn conversation_detail(value: &Value) -> Option<String> {
    let messages = json_conversation_messages(value);
    if !messages.is_empty() {
        return Some(format_chat_messages(&messages));
    }

    let mut parts = Vec::new();
    collect_detail_text(value, &mut parts);
    let content = join_detail_parts(parts);
    if content.is_empty() {
        None
    } else {
        Some(content)
    }
}

fn json_conversation_messages(value: &Value) -> Vec<ParsedChatMessage> {
    if let Some(mapping) = value.get("mapping").and_then(Value::as_object) {
        let mut messages = mapping
            .values()
            .filter_map(|node| node.get("message"))
            .filter(|message| !message.is_null())
            .filter_map(json_message_detail)
            .collect::<Vec<_>>();
        messages.sort_by(|left, right| left.timestamp.cmp(&right.timestamp));
        return messages;
    }

    if let Some(messages) = value.get("chat_messages").and_then(Value::as_array) {
        return messages.iter().filter_map(json_message_detail).collect();
    }

    if let Some(messages) = value.get("messages").and_then(Value::as_array) {
        return messages.iter().filter_map(json_message_detail).collect();
    }

    Vec::new()
}

fn json_message_detail(value: &Value) -> Option<ParsedChatMessage> {
    let role = json_role(value).unwrap_or_else(|| "message".to_string());
    let timestamp = json_timestamp(value);
    let target = value.get("content").unwrap_or(value);
    let mut parts = Vec::new();
    collect_detail_text(target, &mut parts);

    let content = join_detail_parts(parts);
    if content.is_empty() {
        return None;
    }

    Some(ParsedChatMessage {
        role,
        content,
        timestamp,
    })
}

fn json_role(value: &Value) -> Option<String> {
    first_string_at(
        value,
        &["/role", "/author/role", "/message/role", "/payload/role"],
    )
    .or_else(|| {
        first_string_at(value, &["/sender", "/type"]).filter(|role| {
            matches!(
                role.as_str(),
                "user" | "assistant" | "system" | "tool" | "human"
            )
        })
    })
}

fn json_timestamp(value: &Value) -> Option<String> {
    first_string_at(
        value,
        &[
            "/timestamp",
            "/created_at",
            "/createdAt",
            "/updated_at",
            "/updatedAt",
        ],
    )
}

fn first_string_at(value: &Value, pointers: &[&str]) -> Option<String> {
    pointers
        .iter()
        .find_map(|pointer| value.pointer(pointer).and_then(Value::as_str))
        .and_then(|value| normalized_text(Some(value.to_string())))
}

fn collect_detail_text(value: &Value, parts: &mut Vec<String>) {
    match value {
        Value::String(text) => push_detail_text(parts, text),
        Value::Array(items) => {
            for item in items {
                collect_detail_text(item, parts);
            }
        }
        Value::Object(object) => {
            for key in ["text", "content", "parts", "message"] {
                if let Some(next) = object.get(key) {
                    collect_detail_text(next, parts);
                }
            }
        }
        _ => {}
    }
}

fn push_detail_text(parts: &mut Vec<String>, text: &str) {
    let text = text.trim();
    if !text.is_empty() {
        parts.push(text.to_string());
    }
}

fn join_detail_parts(parts: Vec<String>) -> String {
    parts
        .into_iter()
        .map(|part| part.trim().to_string())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn format_chat_messages(messages: &[ParsedChatMessage]) -> String {
    messages
        .iter()
        .map(|message| {
            let mut header = display_chat_role(&message.role);
            if let Some(timestamp) = &message.timestamp {
                header.push_str(" · ");
                header.push_str(timestamp);
            }
            format!("{header}\n{}", message.content)
        })
        .collect::<Vec<_>>()
        .join("\n\n---\n\n")
}

fn display_chat_role(role: &str) -> String {
    match role.to_ascii_lowercase().as_str() {
        "user" | "human" => "用户".to_string(),
        "assistant" => "助手".to_string(),
        "system" => "系统".to_string(),
        "tool" => "工具".to_string(),
        "event" => "事件".to_string(),
        "message" => "消息".to_string(),
        other => other.to_string(),
    }
}

fn truncate_detail(content: String) -> (String, bool) {
    if content.chars().count() <= MAX_DETAIL_CHARS {
        return (content, false);
    }

    let mut truncated = content.chars().take(MAX_DETAIL_CHARS).collect::<String>();
    truncated.push_str("\n\n[内容过长,已截断]");
    (truncated, true)
}

fn detect_source(value: &Value) -> Option<String> {
    if value.get("payload").is_some() {
        return Some("codex".to_string());
    }
    if value.get("mapping").is_some() || value.get("current_node").is_some() {
        return Some("chatgpt".to_string());
    }
    if value.get("sessionId").is_some() && value.get("message").is_some() {
        return Some("claude_code".to_string());
    }
    if value.get("chat_messages").is_some() || value.get("uuid").is_some() {
        return Some("claude".to_string());
    }
    first_string(value, &["source"]).and_then(|source| normalize_source(&source).ok())
}

fn detect_markdown_source(content: &str) -> String {
    let lower = content.to_ascii_lowercase();
    if lower.contains("claude code") {
        "claude_code".to_string()
    } else if lower.contains("codex") {
        "codex".to_string()
    } else if lower.contains("chatgpt") || lower.contains("openai") {
        "chatgpt".to_string()
    } else {
        "claude".to_string()
    }
}

fn detect_jsonl_source(values: &[Value]) -> Option<String> {
    if values.iter().any(|value| {
        value.get("payload").is_some()
            || value
                .get("type")
                .and_then(Value::as_str)
                .is_some_and(|item| item == "session_meta" || item == "response_item")
    }) {
        return Some("codex".to_string());
    }
    if values.iter().any(|value| {
        value.get("sessionId").is_some()
            && (value.get("message").is_some()
                || value
                    .get("type")
                    .and_then(Value::as_str)
                    .is_some_and(|item| {
                        item == "permission-mode" || item == "file-history-snapshot"
                    }))
    }) {
        return Some("claude_code".to_string());
    }
    None
}

fn jsonl_title(path: &PathBuf, source: &str, values: &[Value]) -> String {
    let prefix = match source {
        "codex" => "Codex",
        "claude_code" => "Claude Code",
        _ => "聊天",
    };
    let cwd = values.iter().find_map(|value| {
        value
            .get("cwd")
            .and_then(Value::as_str)
            .or_else(|| value.pointer("/payload/cwd").and_then(Value::as_str))
    });
    let title = cwd
        .and_then(|item| Path::new(item).file_name())
        .map(|item| item.to_string_lossy().to_string())
        .filter(|item| !item.is_empty())
        .unwrap_or_else(|| default_import_title(path, 0));
    format!("{prefix} · {title}")
}

fn jsonl_timestamp(value: &Value) -> Option<String> {
    value
        .get("timestamp")
        .and_then(Value::as_str)
        .or_else(|| value.pointer("/payload/timestamp").and_then(Value::as_str))
        .and_then(|value| normalized_text(Some(value.to_string())))
}

fn collect_jsonl_text(source: &str, value: &Value, parts: &mut Vec<String>) {
    match source {
        "codex" => {
            if let Some(payload) = value.get("payload") {
                collect_content_text(payload, parts);
            }
        }
        "claude_code" => {
            if let Some(content) = value.pointer("/message/content") {
                collect_content_text(content, parts);
            }
        }
        _ => collect_content_text(value, parts),
    }
}

fn extract_conversation_text(value: &Value) -> String {
    let mut parts = Vec::new();
    collect_conversation_text(value, &mut parts);
    parts.join("\n")
}

fn collect_conversation_text(value: &Value, parts: &mut Vec<String>) {
    if parts.len() >= 20 {
        return;
    }
    if let Some(mapping) = value.get("mapping").and_then(Value::as_object) {
        for node in mapping.values() {
            if let Some(message) = node.get("message") {
                collect_content_text(message, parts);
            }
        }
        return;
    }
    if let Some(messages) = value.get("chat_messages").and_then(Value::as_array) {
        for message in messages {
            collect_content_text(message, parts);
        }
        return;
    }
    collect_content_text(value, parts);
}

fn collect_content_text(value: &Value, parts: &mut Vec<String>) {
    if parts.len() >= 20 {
        return;
    }
    match value {
        Value::String(text) => push_text(parts, text),
        Value::Array(items) => {
            for item in items {
                collect_content_text(item, parts);
            }
        }
        Value::Object(object) => {
            for key in ["text", "content", "parts", "message"] {
                if let Some(next) = object.get(key) {
                    collect_content_text(next, parts);
                }
            }
        }
        _ => {}
    }
}

fn push_text(parts: &mut Vec<String>, text: &str) {
    let text = normalize_whitespace(text);
    if !text.is_empty() && !parts.iter().any(|item| item == &text) {
        parts.push(text);
    }
}

fn summarize_text(content: &str) -> Option<String> {
    let plain = strip_markdown(content);
    let plain = normalize_whitespace(&plain);
    if plain.is_empty() {
        return None;
    }
    Some(truncate_chars(&plain, MAX_SUMMARY_CHARS))
}

fn strip_markdown(content: &str) -> String {
    content
        .lines()
        .map(|line| {
            line.trim()
                .trim_start_matches('#')
                .trim_start_matches('>')
                .trim_start_matches("- ")
                .replace("**", "")
                .replace('`', "")
                .replace('[', "")
                .replace(']', "")
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn first_markdown_heading(content: &str) -> Option<String> {
    content.lines().find_map(|line| {
        let trimmed = line.trim();
        if !trimmed.starts_with('#') {
            return None;
        }
        normalized_text(Some(trimmed.trim_start_matches('#').trim().to_string()))
    })
}

fn first_string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(key).and_then(Value::as_str))
        .and_then(|value| normalized_text(Some(value.to_string())))
}

fn normalize_source(source: &str) -> Result<String, String> {
    match source.trim().to_ascii_lowercase().as_str() {
        "claude" | "anthropic" => Ok("claude".to_string()),
        "chatgpt" | "openai" => Ok("chatgpt".to_string()),
        "claude_code" | "claude-code" | "claudecode" => Ok("claude_code".to_string()),
        "codex" | "openai_codex" | "openai-codex" => Ok("codex".to_string()),
        other => Err(format!("不支持的聊天来源: {other}")),
    }
}

fn normalized_text(value: Option<String>) -> Option<String> {
    value
        .map(|item| normalize_whitespace(&item))
        .filter(|item| !item.is_empty())
}

fn normalize_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let mut truncated = value.chars().take(max_chars).collect::<String>();
    truncated.push('…');
    truncated
}

fn default_import_title(path: &PathBuf, index: usize) -> String {
    let name = path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "聊天导出".to_string());
    if index == 0 {
        name
    } else {
        format!("{name} #{index}")
    }
}

fn normalize_existing_file(raw_path: &str) -> Result<PathBuf, String> {
    let expanded = expand_home(raw_path);
    let path = fs::canonicalize(&expanded)
        .map_err(|error| format!("无法访问聊天导出文件 {}: {error}", expanded.display()))?;
    if !path.is_file() {
        return Err(format!("聊天导出路径不是文件: {}", path.display()));
    }
    Ok(path)
}

fn default_chat_roots(source: &str) -> Result<Vec<PathBuf>, String> {
    let home = std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "无法读取 HOME 目录".to_string())?;
    Ok(match source {
        "codex" => vec![home.join(".codex").join("sessions")],
        "claude_code" => vec![home.join(".claude").join("projects")],
        _ => return Err(format!("不支持扫描该聊天来源: {source}")),
    })
}

fn collect_jsonl_files(dir: &Path, source: &str, files: &mut Vec<LocalChatFile>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if source == "claude_code" && path.file_name().is_some_and(|name| name == "subagents") {
                continue;
            }
            collect_jsonl_files(&path, source, files);
            continue;
        }

        if !path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("jsonl"))
        {
            continue;
        }
        let modified = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(SystemTime::UNIX_EPOCH);
        files.push(LocalChatFile { path, modified });
    }
}

fn expand_home(raw_path: &str) -> PathBuf {
    if raw_path == "~" {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home);
        }
    }
    if let Some(rest) = raw_path.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(raw_path)
}

fn is_supported_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    (lower.starts_with("https://") || lower.starts_with("http://"))
        && value
            .split_once("://")
            .is_some_and(|(_, rest)| rest.contains('.') && !rest.trim().is_empty())
}

fn link_title(url: &str) -> String {
    url.split_once("://")
        .map(|(_, rest)| rest)
        .unwrap_or(url)
        .split('/')
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or(url)
        .to_string()
}

fn open_target(target: &str) -> Result<(), String> {
    run_system_open(open_command(target), target)
}

fn reveal_target(path: &Path) -> Result<(), String> {
    run_system_open(reveal_command(path), &path.to_string_lossy())
}

fn run_system_open(mut command: Command, target: &str) -> Result<(), String> {
    let status = command
        .status()
        .map_err(|error| format!("无法打开聊天记录 {target}: {error}"))?;
    if status.success() {
        return Ok(());
    }
    Err(format!("无法打开聊天记录 {target}: {status}"))
}

#[cfg(target_os = "macos")]
fn open_command(target: &str) -> Command {
    let mut command = Command::new("open");
    command.arg(target);
    command
}

#[cfg(target_os = "macos")]
fn reveal_command(path: &Path) -> Command {
    let mut command = Command::new("open");
    command.arg("-R").arg(path);
    command
}

#[cfg(target_os = "windows")]
fn open_command(target: &str) -> Command {
    let mut command = Command::new("cmd");
    command.args(["/C", "start", "", target]);
    command
}

#[cfg(target_os = "windows")]
fn reveal_command(path: &Path) -> Command {
    let mut command = Command::new("explorer");
    command.arg(format!("/select,{}", path.display()));
    command
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn open_command(target: &str) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(target);
    command
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn reveal_command(path: &Path) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(path.parent().unwrap_or(path));
    command
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_chatgpt_export_candidates() {
        let path = PathBuf::from("/tmp/conversations.json");
        let value = serde_json::json!([
          {
            "title": "Fix Tauri startup",
            "mapping": {
              "a": { "message": { "content": { "parts": ["App cannot open after migration"] } } },
              "b": { "message": { "content": { "parts": ["Use an idempotent schema initializer."] } } }
            }
          }
        ]);

        let candidates = parse_json_export(&path, &value);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].source, "chatgpt");
        assert_eq!(candidates[0].title, "Fix Tauri startup");
        assert!(candidates[0]
            .summary
            .as_ref()
            .is_some_and(|summary| summary.contains("App cannot open")));
    }

    #[test]
    fn parses_claude_export_candidates() {
        let path = PathBuf::from("/tmp/claude.json");
        let value = serde_json::json!({
          "conversations": [
            {
              "uuid": "abc",
              "name": "Memoir T11",
              "chat_messages": [
                { "text": "Import Claude export JSON" },
                { "content": [{ "text": "Show candidates before linking." }] }
              ]
            }
          ]
        });

        let candidates = parse_json_export(&path, &value);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].source, "claude");
        assert_eq!(candidates[0].title, "Memoir T11");
        assert!(candidates[0]
            .summary
            .as_ref()
            .is_some_and(|summary| summary.contains("Import Claude export JSON")));
    }

    #[test]
    fn validates_chat_share_links() {
        let link = normalize_chat_link(AddChatLinkInput {
            source: "openai".to_string(),
            kind: "link".to_string(),
            url_or_file: "https://chatgpt.com/share/abc".to_string(),
            title: None,
            summary: Some("  Project decision  ".to_string()),
        })
        .expect("normalize share link");

        assert_eq!(link.source, "chatgpt");
        assert_eq!(link.kind, "link");
        assert_eq!(link.title, "chatgpt.com");
        assert_eq!(link.summary.as_deref(), Some("Project decision"));
        assert!(normalize_chat_link(AddChatLinkInput {
            source: "chatgpt".to_string(),
            kind: "link".to_string(),
            url_or_file: "file:///tmp/chat.md".to_string(),
            title: None,
            summary: None,
        })
        .is_err());
    }

    #[test]
    fn parses_codex_jsonl_session() {
        let path = PathBuf::from("/tmp/rollout-2026-06-11.jsonl");
        let content = r#"{"timestamp":"2026-06-11T08:00:00Z","type":"session_meta","payload":{"cwd":"/Users/me/project/Memoir"}}
{"timestamp":"2026-06-11T08:00:01Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"关联 Codex 聊天记录"}]}}
{"timestamp":"2026-06-11T08:00:02Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"扫描 ~/.codex/sessions 下的 JSONL。"}]}}"#;

        let candidates = parse_jsonl_export(&path, content);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].source, "codex");
        assert_eq!(candidates[0].title, "Codex · Memoir");
        assert!(candidates[0]
            .summary
            .as_ref()
            .is_some_and(|summary| summary.contains("关联 Codex 聊天记录")));
    }

    #[test]
    fn parses_claude_code_jsonl_session() {
        let path = PathBuf::from("/tmp/claude-code.jsonl");
        let content = r#"{"type":"user","timestamp":"2026-06-11T08:00:00Z","cwd":"/Users/me/project/Memoir","sessionId":"abc","message":{"role":"user","content":"关联 Claude Code 聊天记录"}}
{"type":"assistant","timestamp":"2026-06-11T08:00:01Z","cwd":"/Users/me/project/Memoir","sessionId":"abc","message":{"role":"assistant","content":[{"type":"text","text":"读取 ~/.claude/projects 下的 JSONL。"}]}}"#;

        let candidates = parse_jsonl_export(&path, content);
        assert_eq!(candidates.len(), 1);
        assert_eq!(candidates[0].source, "claude_code");
        assert_eq!(candidates[0].title, "Claude Code · Memoir");
        assert!(candidates[0]
            .summary
            .as_ref()
            .is_some_and(|summary| summary.contains("关联 Claude Code 聊天记录")));
    }

    #[test]
    fn builds_claude_code_jsonl_detail() {
        let content = r#"{"type":"user","timestamp":"2026-06-11T08:00:00Z","cwd":"/Users/me/project/Memoir","sessionId":"abc","message":{"role":"user","content":"这里点关联会提示这个，要输入什么？"}}
{"type":"assistant","timestamp":"2026-06-11T08:00:01Z","cwd":"/Users/me/project/Memoir","sessionId":"abc","message":{"role":"assistant","content":[{"type":"text","text":"不用输入，这是扫描候选关联的前端判断 bug。"}]}}"#;

        let detail = detail_from_jsonl_export(content).expect("jsonl detail");
        assert!(detail.contains("用户 · 2026-06-11T08:00:00Z"));
        assert!(detail.contains("这里点关联会提示这个"));
        assert!(detail.contains("助手 · 2026-06-11T08:00:01Z"));
        assert!(detail.contains("扫描候选关联"));
    }

    #[test]
    fn builds_chatgpt_json_detail_by_title() {
        let path = PathBuf::from("/tmp/conversations.json");
        let chat = ChatLinkRecord {
            id: 1,
            project_id: 7,
            source: "chatgpt".to_string(),
            kind: "import".to_string(),
            url_or_file: path.to_string_lossy().to_string(),
            title: "Fix Tauri startup".to_string(),
            summary: None,
            captured_at: "2026-06-11T08:00:00Z".to_string(),
        };
        let value = serde_json::json!([
          {
            "title": "Ignore me",
            "mapping": {
              "a": { "message": { "author": { "role": "user" }, "content": { "parts": ["Other conversation"] } } }
            }
          },
          {
            "title": "Fix Tauri startup",
            "mapping": {
              "a": { "message": { "author": { "role": "user" }, "content": { "parts": ["App cannot open after migration"] } } },
              "b": { "message": { "author": { "role": "assistant" }, "content": { "parts": ["Use an idempotent schema initializer."] } } }
            }
          }
        ]);

        let detail = detail_from_json_export(&path, &value, &chat).expect("json detail");
        assert!(detail.contains("App cannot open after migration"));
        assert!(detail.contains("Use an idempotent schema initializer."));
        assert!(!detail.contains("Other conversation"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn builds_macos_reveal_command() {
        let command = reveal_command(Path::new("/tmp/chat.jsonl"));
        assert_eq!(command.get_program().to_string_lossy(), "open");
        let args = command
            .get_args()
            .map(|item| item.to_string_lossy().to_string())
            .collect::<Vec<_>>();
        assert_eq!(args, vec!["-R", "/tmp/chat.jsonl"]);
    }
}
