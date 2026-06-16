use serde::{Deserialize, Serialize};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    QueryBuilder, Row, Sqlite, SqlitePool,
};
use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Deserialize)]
pub struct ProjectListFilter {
    status: Option<String>,
    search: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectRecord {
    id: i64,
    name: String,
    path: String,
    vcs_type: String,
    remote_url: Option<String>,
    last_commit_at: Option<String>,
    last_opened_at: Option<String>,
    archive_completeness: i64,
    category: String,
    status: String,
    created_at: String,
    tags: Vec<String>,
    language: String,
    tech_stack: Vec<String>,
    last_commit_msg: Option<String>,
    last_commit_hash: Option<String>,
    archive_positioning: String,
    docs_count: i64,
}

#[derive(Debug, Serialize)]
pub struct ScanProjectsResult {
    scanned_roots: usize,
    discovered: usize,
    inserted: usize,
    skipped: usize,
    projects: Vec<ProjectRecord>,
}

struct ProjectCandidate {
    name: String,
    path: String,
    vcs_type: String,
    category: String,
    tags: Vec<String>,
}

#[tauri::command]
pub async fn scan_projects<R: Runtime>(
    app: AppHandle<R>,
    roots: Vec<String>,
) -> Result<ScanProjectsResult, String> {
    if roots.is_empty() {
        return Err("请至少提供一个扫描根目录".to_string());
    }

    let candidates = discover_git_projects(&roots)?;
    let pool = database_pool(&app).await?;
    let normalized_roots = normalize_roots(&roots)?;
    save_scan_roots(&pool, &normalized_roots).await?;

    let mut inserted = 0usize;
    for candidate in &candidates {
        inserted += insert_project(&pool, candidate).await?;
    }

    let projects = list_project_records(&pool, None, Some("opened".to_string())).await?;
    Ok(ScanProjectsResult {
        scanned_roots: normalized_roots.len(),
        discovered: candidates.len(),
        inserted,
        skipped: candidates.len().saturating_sub(inserted),
        projects,
    })
}

#[tauri::command]
pub async fn add_project<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<ProjectRecord, String> {
    let candidate = project_candidate_from_path(&path, false)?;
    let pool = database_pool(&app).await?;
    insert_project(&pool, &candidate).await?;
    get_project_by_path(&pool, &candidate.path).await
}

#[tauri::command]
pub async fn list_projects<R: Runtime>(
    app: AppHandle<R>,
    filter: Option<ProjectListFilter>,
    sort: Option<String>,
) -> Result<Vec<ProjectRecord>, String> {
    let pool = database_pool(&app).await?;
    list_project_records(&pool, filter, sort).await
}

#[tauri::command]
pub async fn get_project<R: Runtime>(app: AppHandle<R>, id: i64) -> Result<ProjectRecord, String> {
    let pool = database_pool(&app).await?;
    get_project_by_id(&pool, id).await
}

#[tauri::command]
pub async fn set_project_category<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    category: String,
) -> Result<ProjectRecord, String> {
    let pool = database_pool(&app).await?;
    let category = normalize_category(&category)?;
    sqlx::query("UPDATE projects SET category = $1 WHERE id = $2")
        .bind(category)
        .bind(id)
        .execute(&pool)
        .await
        .map_err(|error| format!("无法更新项目分类: {error}"))?;
    get_project_by_id(&pool, id).await
}

pub(crate) async fn database_pool<R: Runtime>(app: &AppHandle<R>) -> Result<SqlitePool, String> {
    let app_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("无法获取应用配置目录: {error}"))?;
    fs::create_dir_all(&app_dir)
        .map_err(|error| format!("无法创建应用配置目录 {}: {error}", app_dir.display()))?;

    let db_path = app_dir.join("memoir.db");
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(|error| format!("无法连接 SQLite: {error}"))?;

    sqlx::raw_sql(crate::db::schema_sql())
        .execute(&pool)
        .await
        .map_err(|error| format!("无法初始化数据库 schema: {error}"))?;
    ensure_schema_compat(&pool).await?;

    Ok(pool)
}

async fn ensure_schema_compat(pool: &SqlitePool) -> Result<(), String> {
    if !table_has_column(pool, "projects", "category").await? {
        sqlx::query(
            "ALTER TABLE projects ADD COLUMN category TEXT NOT NULL DEFAULT 'other' CHECK (
              category IN ('android', 'ios', 'miniprogram', 'web', 'desktop', 'backend', 'cli', 'library', 'other')
            )",
        )
        .execute(pool)
        .await
        .map_err(|error| format!("无法迁移项目分类字段: {error}"))?;
        backfill_project_categories(pool).await?;
    }
    ensure_document_types(pool).await?;
    ensure_chat_links_sources(pool).await?;
    Ok(())
}

async fn ensure_document_types(pool: &SqlitePool) -> Result<(), String> {
    let create_sql =
        sqlx::query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'documents'")
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("无法读取资料表结构: {error}"))?
            .and_then(|row| row.try_get::<String, _>("sql").ok())
            .unwrap_or_default();

    if create_sql.contains("local_dir") {
        return Ok(());
    }

    sqlx::raw_sql(
        "PRAGMA foreign_keys = OFF;
         DROP TABLE IF EXISTS documents_next;
         CREATE TABLE IF NOT EXISTS documents_next (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           project_id INTEGER NOT NULL,
           type TEXT NOT NULL CHECK (type IN ('local_file', 'local_dir', 'link')),
           title TEXT NOT NULL,
           path_or_url TEXT NOT NULL,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
         );
         INSERT INTO documents_next (id, project_id, type, title, path_or_url, created_at)
         SELECT id, project_id, type, title, path_or_url, created_at
         FROM documents;
         DROP TABLE documents;
         ALTER TABLE documents_next RENAME TO documents;
         CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
         PRAGMA foreign_keys = ON;",
    )
    .execute(pool)
    .await
    .map_err(|error| format!("无法迁移资料类型约束: {error}"))?;

    Ok(())
}

async fn ensure_chat_links_sources(pool: &SqlitePool) -> Result<(), String> {
    let create_sql =
        sqlx::query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chat_links'")
            .fetch_optional(pool)
            .await
            .map_err(|error| format!("无法读取聊天记录表结构: {error}"))?
            .and_then(|row| row.try_get::<String, _>("sql").ok())
            .unwrap_or_default();

    if create_sql.contains("claude_code") && create_sql.contains("codex") {
        return Ok(());
    }

    sqlx::raw_sql(
        "PRAGMA foreign_keys = OFF;
         DROP TABLE IF EXISTS chat_links_next;
         CREATE TABLE IF NOT EXISTS chat_links_next (
           id INTEGER PRIMARY KEY AUTOINCREMENT,
           project_id INTEGER NOT NULL,
           source TEXT NOT NULL CHECK (source IN ('claude', 'chatgpt', 'claude_code', 'codex')),
           kind TEXT NOT NULL CHECK (kind IN ('link', 'import')),
           url_or_file TEXT NOT NULL,
           title TEXT NOT NULL,
           summary TEXT,
           captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
         );
         INSERT INTO chat_links_next (id, project_id, source, kind, url_or_file, title, summary, captured_at)
         SELECT id, project_id, source, kind, url_or_file, title, summary, captured_at
         FROM chat_links;
         DROP TABLE chat_links;
         ALTER TABLE chat_links_next RENAME TO chat_links;
         CREATE INDEX IF NOT EXISTS idx_chat_links_project_id ON chat_links(project_id);
         PRAGMA foreign_keys = ON;",
    )
    .execute(pool)
    .await
    .map_err(|error| format!("无法迁移聊天记录来源约束: {error}"))?;

    Ok(())
}

async fn table_has_column(pool: &SqlitePool, table: &str, column: &str) -> Result<bool, String> {
    let rows = sqlx::query(&format!("PRAGMA table_info({table})"))
        .fetch_all(pool)
        .await
        .map_err(|error| format!("无法读取表结构 {table}: {error}"))?;
    Ok(rows
        .iter()
        .filter_map(|row| row.try_get::<String, _>("name").ok())
        .any(|name| name == column))
}

async fn backfill_project_categories(pool: &SqlitePool) -> Result<(), String> {
    let rows = sqlx::query("SELECT id, path FROM projects WHERE category = 'other'")
        .fetch_all(pool)
        .await
        .map_err(|error| format!("无法读取待回填分类项目: {error}"))?;

    for row in rows {
        let id: i64 = row
            .try_get("id")
            .map_err(|error| format!("无法解析项目 ID: {error}"))?;
        let path: String = row
            .try_get("path")
            .map_err(|error| format!("无法解析项目路径: {error}"))?;
        let category = detect_category(Path::new(&path));
        sqlx::query("UPDATE projects SET category = $1 WHERE id = $2")
            .bind(category)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|error| format!("无法回填项目分类: {error}"))?;
    }
    Ok(())
}

fn discover_git_projects(roots: &[String]) -> Result<Vec<ProjectCandidate>, String> {
    let mut seen = BTreeSet::new();
    let mut projects = Vec::new();

    for root in roots {
        let root_path = normalize_existing_dir(root)?;
        discover_in_dir(&root_path, &mut seen, &mut projects);
    }

    Ok(projects)
}

fn discover_in_dir(dir: &Path, seen: &mut BTreeSet<PathBuf>, projects: &mut Vec<ProjectCandidate>) {
    if has_git_dir(dir) {
        if seen.insert(dir.to_path_buf()) {
            if let Some(candidate) = project_candidate_from_normalized_path(dir, true) {
                projects.push(candidate);
            }
        }
        return;
    }

    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }
        let child = entry.path();
        if should_skip_dir(&child) {
            continue;
        }
        discover_in_dir(&child, seen, projects);
    }
}

fn project_candidate_from_path(
    raw_path: &str,
    require_git: bool,
) -> Result<ProjectCandidate, String> {
    let path = normalize_existing_dir(raw_path)?;
    if require_git && !has_git_dir(&path) {
        return Err(format!("{} 不是 Git 仓库", path.display()));
    }
    project_candidate_from_normalized_path(&path, has_git_dir(&path))
        .ok_or_else(|| format!("无法读取项目名称: {}", path.display()))
}

fn project_candidate_from_normalized_path(path: &Path, is_git: bool) -> Option<ProjectCandidate> {
    let name = path.file_name()?.to_string_lossy().to_string();
    let language = detect_language(path);
    let category = detect_category(path);
    let mut tags = vec![language.clone()];
    if is_git {
        tags.push("git".to_string());
    }

    Some(ProjectCandidate {
        name,
        path: path.to_string_lossy().to_string(),
        vcs_type: if is_git { "git" } else { "none" }.to_string(),
        category,
        tags,
    })
}

fn normalize_roots(roots: &[String]) -> Result<Vec<String>, String> {
    roots
        .iter()
        .map(|root| normalize_existing_dir(root).map(|path| path.to_string_lossy().to_string()))
        .collect()
}

fn normalize_existing_dir(raw_path: &str) -> Result<PathBuf, String> {
    let expanded = expand_home(raw_path);
    let canonical = fs::canonicalize(&expanded)
        .map_err(|error| format!("无法访问目录 {}: {error}", expanded.display()))?;
    if !canonical.is_dir() {
        return Err(format!("路径不是目录: {}", canonical.display()));
    }
    Ok(canonical)
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

fn has_git_dir(path: &Path) -> bool {
    path.join(".git").exists()
}

pub(crate) fn should_skip_dir(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };

    matches!(
        name,
        ".git"
            | ".next"
            | ".turbo"
            | ".cache"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | "vendor"
            | "__pycache__"
    )
}

fn detect_language(path: &Path) -> String {
    if path.join("Cargo.toml").exists() {
        return "rust".to_string();
    }
    if path.join("go.mod").exists() {
        return "go".to_string();
    }
    if path.join("pyproject.toml").exists() || path.join("requirements.txt").exists() {
        return "python".to_string();
    }
    if path.join("tsconfig.json").exists() {
        return "ts".to_string();
    }
    if path.join("package.json").exists() {
        return "js".to_string();
    }
    if contains_extension(path, "csproj") {
        return "csharp".to_string();
    }
    if contains_extension(path, "sh") {
        return "shell".to_string();
    }
    "unknown".to_string()
}

fn detect_category(path: &Path) -> String {
    if is_android_project(path) {
        return "android".to_string();
    }
    if is_ios_project(path) {
        return "ios".to_string();
    }
    if is_miniprogram_project(path) {
        return "miniprogram".to_string();
    }
    if is_desktop_project(path) {
        return "desktop".to_string();
    }
    if is_web_project(path) {
        return "web".to_string();
    }
    if is_cli_project(path) {
        return "cli".to_string();
    }
    if is_library_project(path) {
        return "library".to_string();
    }
    if is_backend_project(path) {
        return "backend".to_string();
    }
    "other".to_string()
}

fn is_android_project(path: &Path) -> bool {
    path.join("settings.gradle").exists()
        || path.join("settings.gradle.kts").exists()
        || path.join("gradlew").exists()
        || path.join("AndroidManifest.xml").exists()
        || path.join("app").join("src").join("main").exists()
        || contains_extension(path, "gradle")
}

fn is_ios_project(path: &Path) -> bool {
    contains_extension(path, "xcodeproj")
        || contains_extension(path, "xcworkspace")
        || (path.join("Package.swift").exists()
            && (path.join("Sources").exists()
                || path.join("ios").exists()
                || path.join("iOS").exists()))
}

fn is_miniprogram_project(path: &Path) -> bool {
    path.join("project.config.json").exists()
        || path.join("app.json").exists()
        || path.join("sitemap.json").exists()
        || path.join("miniprogram").exists()
}

fn is_desktop_project(path: &Path) -> bool {
    path.join("src-tauri").exists()
        || path.join("tauri.conf.json").exists()
        || path.join("wails.json").exists()
        || package_json_contains(path, &["electron", "@tauri-apps/api"])
}

fn is_web_project(path: &Path) -> bool {
    path.join("vite.config.ts").exists()
        || path.join("vite.config.js").exists()
        || path.join("next.config.js").exists()
        || path.join("next.config.mjs").exists()
        || package_json_contains(
            path,
            &[
                "vite",
                "next",
                "react",
                "vue",
                "svelte",
                "astro",
                "@angular/core",
            ],
        )
}

fn is_cli_project(path: &Path) -> bool {
    package_json_contains(path, &["\"bin\"", "commander", "yargs"])
        || cargo_toml_contains(path, &["clap", "structopt"])
        || pyproject_contains(path, &["console_scripts", "click", "typer"])
}

fn is_library_project(path: &Path) -> bool {
    package_json_contains(path, &["\"exports\"", "\"main\"", "\"module\""])
        || cargo_toml_contains(path, &["[lib]"])
        || path.join("lib").exists()
}

fn is_backend_project(path: &Path) -> bool {
    path.join("server").exists()
        || path.join("api").exists()
        || path.join("backend").exists()
        || path.join("go.mod").exists()
        || path.join("requirements.txt").exists()
        || path.join("pyproject.toml").exists()
        || path.join("Cargo.toml").exists()
}

fn package_json_contains(path: &Path, needles: &[&str]) -> bool {
    file_contains_any(&path.join("package.json"), needles)
}

fn cargo_toml_contains(path: &Path, needles: &[&str]) -> bool {
    file_contains_any(&path.join("Cargo.toml"), needles)
}

fn pyproject_contains(path: &Path, needles: &[&str]) -> bool {
    file_contains_any(&path.join("pyproject.toml"), needles)
}

fn file_contains_any(path: &Path, needles: &[&str]) -> bool {
    let Ok(content) = fs::read_to_string(path) else {
        return false;
    };
    let content = content.to_lowercase();
    needles
        .iter()
        .map(|needle| needle.to_lowercase())
        .any(|needle| content.contains(&needle))
}

fn normalize_category(category: &str) -> Result<String, String> {
    let category = category.trim();
    if valid_categories().contains(&category) {
        return Ok(category.to_string());
    }
    Err(format!("不支持的项目分类: {category}"))
}

pub(crate) fn valid_categories() -> &'static [&'static str] {
    &[
        "android",
        "ios",
        "miniprogram",
        "web",
        "desktop",
        "backend",
        "cli",
        "library",
        "other",
    ]
}

fn contains_extension(path: &Path, extension: &str) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    entries.flatten().any(|entry| {
        entry
            .path()
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| value.eq_ignore_ascii_case(extension))
    })
}

async fn save_scan_roots(pool: &SqlitePool, roots: &[String]) -> Result<(), String> {
    let value =
        serde_json::to_string(roots).map_err(|error| format!("无法序列化扫描目录配置: {error}"))?;
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES ('scan_roots', $1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(value)
    .execute(pool)
    .await
    .map_err(|error| format!("无法保存扫描目录配置: {error}"))?;
    Ok(())
}

async fn insert_project(pool: &SqlitePool, candidate: &ProjectCandidate) -> Result<usize, String> {
    let result = sqlx::query(
        "INSERT OR IGNORE INTO projects
          (name, path, vcs_type, remote_url, last_opened_at, archive_completeness, category, status)
         VALUES ($1, $2, $3, NULL, CURRENT_TIMESTAMP, 0, $4, 'active')",
    )
    .bind(&candidate.name)
    .bind(&candidate.path)
    .bind(&candidate.vcs_type)
    .bind(&candidate.category)
    .execute(pool)
    .await
    .map_err(|error| format!("无法写入项目 {}: {error}", candidate.path))?;

    if result.rows_affected() > 0 {
        upsert_tags(pool, &candidate.path, &candidate.tags).await?;
        Ok(1)
    } else {
        Ok(0)
    }
}

async fn upsert_tags(pool: &SqlitePool, project_path: &str, tags: &[String]) -> Result<(), String> {
    let project_id: i64 = sqlx::query("SELECT id FROM projects WHERE path = $1")
        .bind(project_path)
        .fetch_one(pool)
        .await
        .map_err(|error| format!("无法读取项目 ID: {error}"))?
        .try_get("id")
        .map_err(|error| format!("无法解析项目 ID: {error}"))?;

    for tag in tags {
        if tag == "unknown" {
            continue;
        }
        sqlx::query("INSERT OR IGNORE INTO tags (name) VALUES ($1)")
            .bind(tag)
            .execute(pool)
            .await
            .map_err(|error| format!("无法写入标签 {tag}: {error}"))?;
        sqlx::query(
            "INSERT OR IGNORE INTO project_tags (project_id, tag_id)
             SELECT $1, id FROM tags WHERE name = $2",
        )
        .bind(project_id)
        .bind(tag)
        .execute(pool)
        .await
        .map_err(|error| format!("无法关联标签 {tag}: {error}"))?;
    }

    Ok(())
}

async fn get_project_by_path(pool: &SqlitePool, path: &str) -> Result<ProjectRecord, String> {
    let rows = sqlx::query(project_select_sql("WHERE p.path = $1", "name").as_str())
        .bind(path)
        .fetch_all(pool)
        .await
        .map_err(|error| format!("无法读取项目: {error}"))?;
    rows.first()
        .map(project_from_row)
        .transpose()?
        .ok_or_else(|| format!("项目不存在: {path}"))
}

async fn get_project_by_id(pool: &SqlitePool, id: i64) -> Result<ProjectRecord, String> {
    let rows = sqlx::query(project_select_sql("WHERE p.id = $1", "name").as_str())
        .bind(id)
        .fetch_all(pool)
        .await
        .map_err(|error| format!("无法读取项目: {error}"))?;
    rows.first()
        .map(project_from_row)
        .transpose()?
        .ok_or_else(|| format!("项目不存在: {id}"))
}

pub(crate) async fn get_project_path_by_id(pool: &SqlitePool, id: i64) -> Result<String, String> {
    let row = sqlx::query("SELECT path FROM projects WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("无法读取项目路径: {error}"))?
        .ok_or_else(|| format!("项目不存在: {id}"))?;

    row.try_get("path")
        .map_err(|error| format!("无法解析项目路径: {error}"))
}

pub(crate) async fn get_project_path_and_category_by_id(
    pool: &SqlitePool,
    id: i64,
) -> Result<(String, String), String> {
    let row = sqlx::query("SELECT path, category FROM projects WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("无法读取项目路径和分类: {error}"))?
        .ok_or_else(|| format!("项目不存在: {id}"))?;

    let path = row
        .try_get("path")
        .map_err(|error| format!("无法解析项目路径: {error}"))?;
    let category = row
        .try_get::<String, _>("category")
        .ok()
        .and_then(|value| normalize_category(&value).ok())
        .unwrap_or_else(|| "other".to_string());
    Ok((path, category))
}

async fn list_project_records(
    pool: &SqlitePool,
    filter: Option<ProjectListFilter>,
    sort: Option<String>,
) -> Result<Vec<ProjectRecord>, String> {
    let mut query = QueryBuilder::<Sqlite>::new(
        "SELECT p.id, p.name, p.path, p.vcs_type, p.remote_url,
                p.last_commit_at, p.last_opened_at, p.archive_completeness,
                p.category, p.status, p.created_at,
                a.md_path AS archive_md_path,
                COALESCE(group_concat(DISTINCT t.name), '') AS tags,
                COUNT(DISTINCT d.id) AS docs_count
         FROM projects p
         LEFT JOIN archives a ON a.project_id = p.id
         LEFT JOIN project_tags pt ON pt.project_id = p.id
         LEFT JOIN tags t ON t.id = pt.tag_id
         LEFT JOIN documents d ON d.project_id = p.id
         WHERE 1 = 1",
    );

    if let Some(filter) = filter {
        if let Some(status) = filter.status.filter(|value| value != "all") {
            query.push(" AND p.status = ");
            query.push_bind(status);
        }
        if let Some(search) = filter.search.filter(|value| !value.trim().is_empty()) {
            let pattern = format!("%{}%", search.trim());
            query.push(" AND (p.name LIKE ");
            query.push_bind(pattern.clone());
            query.push(" OR p.path LIKE ");
            query.push_bind(pattern);
            query.push(")");
        }
    }

    query.push(" GROUP BY p.id ");
    push_order_by(&mut query, sort.as_deref());

    let rows = query
        .build()
        .fetch_all(pool)
        .await
        .map_err(|error| format!("无法列出项目: {error}"))?;

    rows.iter().map(project_from_row).collect()
}

fn project_select_sql(where_clause: &str, sort: &str) -> String {
    let mut sql = format!(
        "SELECT p.id, p.name, p.path, p.vcs_type, p.remote_url,
                p.last_commit_at, p.last_opened_at, p.archive_completeness,
                p.category, p.status, p.created_at,
                a.md_path AS archive_md_path,
                COALESCE(group_concat(DISTINCT t.name), '') AS tags,
                COUNT(DISTINCT d.id) AS docs_count
         FROM projects p
         LEFT JOIN archives a ON a.project_id = p.id
         LEFT JOIN project_tags pt ON pt.project_id = p.id
         LEFT JOIN tags t ON t.id = pt.tag_id
         LEFT JOIN documents d ON d.project_id = p.id
         {where_clause}
         GROUP BY p.id "
    );
    sql.push_str(match sort {
        "opened" => "ORDER BY p.last_opened_at IS NULL, datetime(p.last_opened_at) DESC, datetime(p.created_at) DESC",
        "commit" => "ORDER BY p.last_commit_at IS NULL, datetime(p.last_commit_at) DESC, p.name COLLATE NOCASE ASC",
        "completeness" => "ORDER BY p.archive_completeness DESC, p.name COLLATE NOCASE ASC",
        _ => "ORDER BY p.name COLLATE NOCASE ASC",
    });
    sql
}

fn push_order_by(query: &mut QueryBuilder<Sqlite>, sort: Option<&str>) {
    query.push(match sort {
        Some("opened") => {
            "ORDER BY p.last_opened_at IS NULL, datetime(p.last_opened_at) DESC, datetime(p.created_at) DESC"
        }
        Some("commit") => {
            "ORDER BY p.last_commit_at IS NULL, datetime(p.last_commit_at) DESC, p.name COLLATE NOCASE ASC"
        }
        Some("completeness") => "ORDER BY p.archive_completeness DESC, p.name COLLATE NOCASE ASC",
        _ => "ORDER BY p.name COLLATE NOCASE ASC",
    });
}

fn project_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<ProjectRecord, String> {
    let path: String = row
        .try_get("path")
        .map_err(|error| format!("无法解析项目路径: {error}"))?;
    let root = Path::new(&path);
    let language = detect_language(root);
    let archive_markdown =
        archive_markdown_from_md_path(row.try_get::<String, _>("archive_md_path").ok());
    let archive_positioning = archive_markdown
        .as_deref()
        .map(extract_archive_positioning)
        .unwrap_or_default();
    let tech_stack = infer_tech_stack(root, archive_markdown.as_deref());
    let vcs_type: String = row
        .try_get("vcs_type")
        .map_err(|error| format!("无法解析 VCS 类型: {error}"))?;
    let latest_commit = if vcs_type == "git" {
        latest_git_commit(root)
    } else {
        None
    };
    let last_commit_at = latest_commit
        .as_ref()
        .and_then(|commit| commit.date.clone())
        .or_else(|| row.try_get("last_commit_at").ok());
    let tags = row
        .try_get::<String, _>("tags")
        .unwrap_or_default()
        .split(',')
        .filter(|tag| !tag.is_empty())
        .map(ToOwned::to_owned)
        .collect();

    Ok(ProjectRecord {
        id: row
            .try_get("id")
            .map_err(|error| format!("无法解析项目 ID: {error}"))?,
        name: row
            .try_get("name")
            .map_err(|error| format!("无法解析项目名称: {error}"))?,
        path,
        vcs_type,
        remote_url: row.try_get("remote_url").ok(),
        last_commit_at,
        last_opened_at: row.try_get("last_opened_at").ok(),
        archive_completeness: row
            .try_get("archive_completeness")
            .map_err(|error| format!("无法解析档案完整度: {error}"))?,
        category: row
            .try_get("category")
            .ok()
            .and_then(|value: String| normalize_category(&value).ok())
            .unwrap_or_else(|| "other".to_string()),
        status: row
            .try_get("status")
            .map_err(|error| format!("无法解析项目状态: {error}"))?,
        created_at: row
            .try_get("created_at")
            .map_err(|error| format!("无法解析创建时间: {error}"))?,
        tags,
        language,
        tech_stack,
        last_commit_msg: latest_commit.as_ref().map(|commit| commit.message.clone()),
        last_commit_hash: latest_commit.as_ref().map(|commit| commit.hash.clone()),
        archive_positioning,
        docs_count: row.try_get("docs_count").unwrap_or(0),
    })
}

fn archive_markdown_from_md_path(md_path: Option<String>) -> Option<String> {
    let Some(md_path) = md_path.filter(|value| !value.trim().is_empty()) else {
        return None;
    };
    fs::read_to_string(md_path).ok()
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LatestCommit {
    hash: String,
    message: String,
    date: Option<String>,
}

fn latest_git_commit(root: &Path) -> Option<LatestCommit> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["log", "-1", "--format=%h%x1f%s%x1f%aI"])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut parts = stdout.trim().split('\u{1f}');
    let hash = parts.next()?.trim().to_string();
    let message = parts.next()?.trim().to_string();
    let date = parts
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    if hash.is_empty() || message.is_empty() {
        return None;
    }
    Some(LatestCommit {
        hash,
        message,
        date,
    })
}

fn infer_tech_stack(root: &Path, archive_markdown: Option<&str>) -> Vec<String> {
    let mut stack = Vec::new();
    if let Some(markdown) = archive_markdown {
        collect_known_tech(markdown, &mut stack);
    }

    collect_tech_from_files(root, &mut stack);

    if stack.is_empty() {
        let language = detect_language(root);
        if language != "unknown" {
            push_unique(&mut stack, language_label(&language));
        }
    }

    stack.into_iter().take(8).collect()
}

fn collect_tech_from_files(root: &Path, stack: &mut Vec<String>) {
    if root.join("src-tauri").exists() || root.join("tauri.conf.json").exists() {
        push_unique(stack, "Tauri");
    }
    if root.join("Cargo.toml").exists() {
        push_unique(stack, "Rust");
        if read_to_lower(root.join("Cargo.toml")).contains("tauri") {
            push_unique(stack, "Tauri");
        }
    }
    if root.join("go.mod").exists() {
        push_unique(stack, "Go");
    }
    if root.join("pyproject.toml").exists() || root.join("requirements.txt").exists() {
        push_unique(stack, "Python");
        let python_deps = format!(
            "{}\n{}",
            read_to_lower(root.join("pyproject.toml")),
            read_to_lower(root.join("requirements.txt"))
        );
        collect_known_tech(&python_deps, stack);
    }
    if root.join("settings.gradle").exists()
        || root.join("build.gradle").exists()
        || root.join("gradlew").exists()
    {
        push_unique(stack, "Android");
    }
    if has_extension(root, "xcodeproj") || has_extension(root, "xcworkspace") {
        push_unique(stack, "iOS");
        push_unique(stack, "Swift");
    }
    if root.join("project.config.json").exists() || root.join("miniprogram").exists() {
        push_unique(stack, "小程序");
    }
    if root.join("Dockerfile").exists() || root.join("docker-compose.yml").exists() {
        push_unique(stack, "Docker");
    }

    let package_json = read_to_lower(root.join("package.json"));
    if !package_json.is_empty() {
        collect_known_tech(&package_json, stack);
        if package_json.contains("\"typescript\"") || root.join("tsconfig.json").exists() {
            push_unique(stack, "TypeScript");
        }
    }
}

fn collect_known_tech(content: &str, stack: &mut Vec<String>) {
    let lower = content.to_ascii_lowercase();
    for (needle, label) in [
        ("next", "Next.js"),
        ("react", "React"),
        ("vue", "Vue"),
        ("svelte", "Svelte"),
        ("astro", "Astro"),
        ("vite", "Vite"),
        ("tailwind", "Tailwind CSS"),
        ("typescript", "TypeScript"),
        ("electron", "Electron"),
        ("tauri", "Tauri"),
        ("node", "Node.js"),
        ("express", "Express"),
        ("fastapi", "FastAPI"),
        ("django", "Django"),
        ("flask", "Flask"),
        ("postgres", "PostgreSQL"),
        ("mysql", "MySQL"),
        ("sqlite", "SQLite"),
        ("redis", "Redis"),
        ("docker", "Docker"),
    ] {
        if lower.contains(needle) {
            push_unique(stack, label);
        }
    }
}

fn read_to_lower(path: PathBuf) -> String {
    fs::read_to_string(path)
        .map(|content| content.to_ascii_lowercase())
        .unwrap_or_default()
}

fn has_extension(root: &Path, extension: &str) -> bool {
    fs::read_dir(root)
        .ok()
        .into_iter()
        .flat_map(|entries| entries.flatten())
        .any(|entry| {
            entry
                .path()
                .extension()
                .is_some_and(|value| value.eq_ignore_ascii_case(extension))
        })
}

fn push_unique(stack: &mut Vec<String>, value: &str) {
    if !stack.iter().any(|item| item == value) {
        stack.push(value.to_string());
    }
}

fn language_label(language: &str) -> &'static str {
    match language {
        "ts" => "TypeScript",
        "js" => "JavaScript",
        "rust" => "Rust",
        "python" => "Python",
        "go" => "Go",
        "csharp" => "C#",
        "shell" => "Shell",
        _ => "Unknown",
    }
}

fn extract_archive_positioning(markdown: &str) -> String {
    let mut in_positioning = false;
    let mut lines = Vec::new();

    for line in markdown.lines() {
        let heading = line.trim().strip_prefix("## ").map(str::trim);
        if let Some(heading) = heading {
            if in_positioning {
                break;
            }
            in_positioning = heading == "项目定位";
            continue;
        }

        if in_positioning {
            lines.push(line);
        }
    }

    lines.join("\n").trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_language_from_known_files() {
        let root =
            std::env::temp_dir().join(format!("memoir-language-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create temp dir");
        fs::write(root.join("Cargo.toml"), "[package]\nname='x'").expect("write cargo");

        assert_eq!(detect_language(&root), "rust");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn skips_heavy_directories() {
        assert!(should_skip_dir(Path::new("/tmp/project/node_modules")));
        assert!(should_skip_dir(Path::new("/tmp/project/target")));
        assert!(!should_skip_dir(Path::new("/tmp/project/src")));
    }

    #[test]
    fn extracts_archive_positioning_for_project_summary() {
        let markdown = "# Memoir\n\n## 项目定位\n\n本机项目记忆库。\n\n## 技术栈与设计\n\nTauri";
        assert_eq!(extract_archive_positioning(markdown), "本机项目记忆库。");
    }

    #[test]
    fn infers_tech_stack_from_archive_and_project_files() {
        let root = std::env::temp_dir().join(format!("memoir-tech-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("src-tauri")).expect("create tauri dir");
        fs::write(
            root.join("package.json"),
            r#"{"dependencies":{"@vitejs/plugin-react":"latest","tailwindcss":"latest"},"devDependencies":{"typescript":"latest"}}"#,
        )
        .expect("write package");

        let markdown = "## 技术栈与设计\n\nTauri + SQLite 作为本地优先存储。";
        let stack = infer_tech_stack(&root, Some(markdown));

        assert!(stack.contains(&"Tauri".to_string()));
        assert!(stack.contains(&"SQLite".to_string()));
        assert!(stack.contains(&"React".to_string()));
        assert!(stack.contains(&"Vite".to_string()));
        assert!(stack.contains(&"Tailwind CSS".to_string()));
        assert!(stack.contains(&"TypeScript".to_string()));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn detects_project_categories_from_known_files() {
        let root =
            std::env::temp_dir().join(format!("memoir-category-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create temp dir");

        let cases = [
            ("android", vec![("settings.gradle", "pluginManagement {}")]),
            ("ios", vec![("App.xcodeproj", "")]),
            ("miniprogram", vec![("project.config.json", "{}")]),
            (
                "web",
                vec![("package.json", r#"{"dependencies":{"vite":"latest"}}"#)],
            ),
            ("desktop", vec![("src-tauri/tauri.conf.json", "{}")]),
            ("backend", vec![("go.mod", "module api")]),
            ("cli", vec![("Cargo.toml", "[dependencies]\nclap = \"4\"")]),
            (
                "library",
                vec![("package.json", r#"{"main":"dist/index.js"}"#)],
            ),
            ("other", vec![("README.md", "notes")]),
        ];

        for (category, files) in cases {
            let dir = root.join(category);
            fs::create_dir_all(&dir).expect("create case dir");
            for (relative, content) in files {
                let path = dir.join(relative);
                if let Some(parent) = path.parent() {
                    fs::create_dir_all(parent).expect("create parent dir");
                }
                if relative.ends_with(".xcodeproj") {
                    fs::create_dir_all(path).expect("create xcode project dir");
                } else {
                    fs::write(path, content).expect("write marker");
                }
            }
            assert_eq!(detect_category(&dir), category);
        }

        let _ = fs::remove_dir_all(&root);
    }
}
