use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use std::{fs, path::PathBuf, process::Command};
use tauri::{AppHandle, Runtime};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddDocumentInput {
    #[serde(rename = "type")]
    doc_type: String,
    title: Option<String>,
    path_or_url: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct DocumentRecord {
    id: i64,
    project_id: i64,
    #[serde(rename = "type")]
    doc_type: String,
    title: String,
    path_or_url: String,
    created_at: String,
}

struct NormalizedDocument {
    doc_type: String,
    title: String,
    path_or_url: String,
}

#[tauri::command]
pub async fn list_documents<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
) -> Result<Vec<DocumentRecord>, String> {
    let pool = crate::projects::database_pool(&app).await?;
    crate::projects::get_project_path_by_id(&pool, id).await?;
    list_document_records(&pool, id).await
}

#[tauri::command]
pub async fn add_document<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    document: AddDocumentInput,
) -> Result<DocumentRecord, String> {
    let pool = crate::projects::database_pool(&app).await?;
    crate::projects::get_project_path_by_id(&pool, id).await?;
    let document = normalize_document(document)?;

    let result = sqlx::query(
        "INSERT INTO documents (project_id, type, title, path_or_url)
         VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(&document.doc_type)
    .bind(&document.title)
    .bind(&document.path_or_url)
    .execute(&pool)
    .await
    .map_err(|error| format!("无法添加资料: {error}"))?;

    let document_id = result.last_insert_rowid();
    get_document_record(&pool, id, document_id).await
}

#[tauri::command]
pub async fn delete_document<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    document_id: i64,
) -> Result<String, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let result = sqlx::query("DELETE FROM documents WHERE project_id = $1 AND id = $2")
        .bind(id)
        .bind(document_id)
        .execute(&pool)
        .await
        .map_err(|error| format!("无法删除资料: {error}"))?;

    if result.rows_affected() == 0 {
        return Err(format!("资料不存在: {document_id}"));
    }
    Ok("资料已删除".to_string())
}

#[tauri::command]
pub async fn open_document<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    document_id: i64,
) -> Result<String, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let document = get_document_record(&pool, id, document_id).await?;
    let target = if document.doc_type == "local_file" || document.doc_type == "local_dir" {
        let path = PathBuf::from(&document.path_or_url);
        if !path.exists() {
            return Err(format!("本地资料不存在: {}", path.display()));
        }
        path.to_string_lossy().to_string()
    } else {
        document.path_or_url.clone()
    };

    open_target(&target)?;
    Ok(format!("已打开 {}", document.title))
}

async fn list_document_records(
    pool: &SqlitePool,
    project_id: i64,
) -> Result<Vec<DocumentRecord>, String> {
    let rows = sqlx::query(
        "SELECT id, project_id, type, title, path_or_url, created_at
         FROM documents
         WHERE project_id = $1
         ORDER BY created_at DESC, id DESC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("无法读取资料列表: {error}"))?;

    rows.iter().map(document_from_row).collect()
}

async fn get_document_record(
    pool: &SqlitePool,
    project_id: i64,
    document_id: i64,
) -> Result<DocumentRecord, String> {
    let row = sqlx::query(
        "SELECT id, project_id, type, title, path_or_url, created_at
         FROM documents
         WHERE project_id = $1 AND id = $2",
    )
    .bind(project_id)
    .bind(document_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("无法读取资料: {error}"))?
    .ok_or_else(|| format!("资料不存在: {document_id}"))?;

    document_from_row(&row)
}

fn document_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<DocumentRecord, String> {
    Ok(DocumentRecord {
        id: row
            .try_get("id")
            .map_err(|error| format!("无法解析资料 ID: {error}"))?,
        project_id: row
            .try_get("project_id")
            .map_err(|error| format!("无法解析项目 ID: {error}"))?,
        doc_type: row
            .try_get("type")
            .map_err(|error| format!("无法解析资料类型: {error}"))?,
        title: row
            .try_get("title")
            .map_err(|error| format!("无法解析资料标题: {error}"))?,
        path_or_url: row
            .try_get("path_or_url")
            .map_err(|error| format!("无法解析资料路径: {error}"))?,
        created_at: row
            .try_get("created_at")
            .map_err(|error| format!("无法解析资料创建时间: {error}"))?,
    })
}

fn normalize_document(input: AddDocumentInput) -> Result<NormalizedDocument, String> {
    let doc_type = input.doc_type.trim();
    let raw_target = input.path_or_url.trim();
    if raw_target.is_empty() {
        return Err("请输入资料路径或链接".to_string());
    }

    match doc_type {
        "local_file" => normalize_local_path(input.title, raw_target, LocalDocumentKind::File),
        "local_dir" => normalize_local_path(input.title, raw_target, LocalDocumentKind::Directory),
        "link" => normalize_link(input.title, raw_target),
        _ => Err(format!("不支持的资料类型: {doc_type}")),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LocalDocumentKind {
    File,
    Directory,
}

fn normalize_local_path(
    title: Option<String>,
    raw_path: &str,
    kind: LocalDocumentKind,
) -> Result<NormalizedDocument, String> {
    let expanded = expand_home(raw_path);
    let path = fs::canonicalize(&expanded)
        .map_err(|error| format!("无法访问本地资料 {}: {error}", expanded.display()))?;

    match kind {
        LocalDocumentKind::File if !path.is_file() => {
            return Err(format!("本地资料不是文件: {}", path.display()));
        }
        LocalDocumentKind::Directory if !path.is_dir() => {
            return Err(format!("本地资料不是文件夹: {}", path.display()));
        }
        _ => {}
    }

    let title = normalized_title(title)
        .or_else(|| {
            path.file_name()
                .map(|value| value.to_string_lossy().to_string())
        })
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    Ok(NormalizedDocument {
        doc_type: match kind {
            LocalDocumentKind::File => "local_file",
            LocalDocumentKind::Directory => "local_dir",
        }
        .to_string(),
        title,
        path_or_url: path.to_string_lossy().to_string(),
    })
}

fn normalize_link(title: Option<String>, raw_url: &str) -> Result<NormalizedDocument, String> {
    if !is_supported_url(raw_url) {
        return Err("外链必须以 http:// 或 https:// 开头".to_string());
    }
    let title = normalized_title(title).unwrap_or_else(|| link_title(raw_url));
    Ok(NormalizedDocument {
        doc_type: "link".to_string(),
        title,
        path_or_url: raw_url.to_string(),
    })
}

fn normalized_title(title: Option<String>) -> Option<String> {
    title
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
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

fn open_target(target: &str) -> Result<(), String> {
    let mut command = open_command(target);
    command
        .spawn()
        .map_err(|error| format!("无法打开资料 {target}: {error}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn open_command(target: &str) -> Command {
    let mut command = Command::new("open");
    command.arg(target);
    command
}

#[cfg(target_os = "windows")]
fn open_command(target: &str) -> Command {
    let mut command = Command::new("cmd");
    command.args(["/C", "start", "", target]);
    command
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn open_command(target: &str) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(target);
    command
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_link_documents() {
        let document = normalize_document(AddDocumentInput {
            doc_type: "link".to_string(),
            title: None,
            path_or_url: "https://example.com/docs/intro".to_string(),
        })
        .expect("normalize link");

        assert_eq!(document.doc_type, "link");
        assert_eq!(document.title, "example.com");
        assert_eq!(document.path_or_url, "https://example.com/docs/intro");
        assert!(normalize_document(AddDocumentInput {
            doc_type: "link".to_string(),
            title: None,
            path_or_url: "ftp://example.com/file".to_string(),
        })
        .is_err());
    }

    #[test]
    fn validates_local_file_documents() {
        let root = std::env::temp_dir().join(format!("memoir-doc-test-{}", std::process::id()));
        let file = root.join("README.md");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create temp root");
        fs::write(&file, "# README").expect("write doc");

        let document = normalize_document(AddDocumentInput {
            doc_type: "local_file".to_string(),
            title: Some("  Readme  ".to_string()),
            path_or_url: file.to_string_lossy().to_string(),
        })
        .expect("normalize file");

        assert_eq!(document.doc_type, "local_file");
        assert_eq!(document.title, "Readme");
        assert!(document.path_or_url.ends_with("README.md"));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn validates_local_directory_documents() {
        let root = std::env::temp_dir().join(format!("memoir-doc-dir-test-{}", std::process::id()));
        let docs_dir = root.join("docs");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&docs_dir).expect("create temp docs dir");

        let document = normalize_document(AddDocumentInput {
            doc_type: "local_dir".to_string(),
            title: None,
            path_or_url: docs_dir.to_string_lossy().to_string(),
        })
        .expect("normalize directory");

        assert_eq!(document.doc_type, "local_dir");
        assert_eq!(document.title, "docs");
        assert!(document.path_or_url.ends_with("docs"));

        let _ = fs::remove_dir_all(root);
    }
}
