use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use std::{
    collections::BTreeSet,
    fs,
    path::{Component, Path, PathBuf},
    time::Duration,
};
use tauri::{AppHandle, Runtime};

const DEEPSEEK_ENDPOINT: &str = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL: &str = "deepseek-chat";
const DEEPSEEK_KEY: &str = "deepseek_api_key";
const SYSTEM_PROMPT: &str = "你是代码考古专家。根据给定的项目文件结构和关键文件内容,生成简洁、面向\"几年后重新接手\"的项目档案,分四部分:1) 项目定位(是什么/解决什么问题);2) 技术栈与关键设计决策;3) 如何运行/部署/运维;4) 待办与已知问题。用 Markdown,每部分用二级标题。";
const MAX_TREE_DEPTH: usize = 4;
const MAX_TREE_NODES: usize = 240;
const MAX_CONTEXT_CHARS: usize = 48_000;
const MAX_FILE_CHARS: usize = 8_000;
const MAX_ERROR_CHARS: usize = 800;

const KEY_FILE_CANDIDATES: &[&str] = &[
    "README.md",
    "README.MD",
    "readme.md",
    "package.json",
    "Cargo.toml",
    "requirements.txt",
    "pyproject.toml",
    "go.mod",
    "tsconfig.json",
    "vite.config.ts",
    "vite.config.js",
    "src/main.tsx",
    "src/main.ts",
    "src/App.tsx",
    "src-tauri/src/lib.rs",
    "src-tauri/src/main.rs",
    "src/main.rs",
    "src/lib.rs",
    "main.py",
    "app.py",
];

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct DeepSeekKeyStatus {
    configured: bool,
    masked: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ArchiveAiSections {
    positioning: String,
    tech: String,
    deploy: String,
    todos: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct ArchiveAiDraft {
    sections: ArchiveAiSections,
    markdown: String,
    source_files: Vec<String>,
}

#[derive(Debug, Serialize)]
struct DeepSeekRequest {
    model: &'static str,
    messages: Vec<DeepSeekMessage>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DeepSeekMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct DeepSeekResponse {
    choices: Vec<DeepSeekChoice>,
}

#[derive(Debug, Deserialize)]
struct DeepSeekChoice {
    message: DeepSeekMessage,
}

struct ProjectContext {
    prompt: String,
    source_files: Vec<String>,
}

struct TreeEntry {
    path: PathBuf,
    name: String,
    is_dir: bool,
}

enum ArchiveKey {
    Positioning,
    Tech,
    Deploy,
    Todos,
}

#[tauri::command]
pub async fn get_deepseek_key_status<R: Runtime>(
    app: AppHandle<R>,
) -> Result<DeepSeekKeyStatus, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let key = read_setting(&pool, DEEPSEEK_KEY).await?;
    Ok(deepseek_key_status(key.as_deref()))
}

#[tauri::command]
pub async fn save_deepseek_api_key<R: Runtime>(
    app: AppHandle<R>,
    key: String,
) -> Result<DeepSeekKeyStatus, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let trimmed = key.trim();
    save_setting(&pool, DEEPSEEK_KEY, trimmed).await?;
    Ok(deepseek_key_status(Some(trimmed)))
}

#[tauri::command]
pub async fn generate_archive_ai<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
) -> Result<ArchiveAiDraft, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let api_key = read_setting(&pool, DEEPSEEK_KEY)
        .await?
        .unwrap_or_default()
        .trim()
        .to_string();
    if api_key.is_empty() {
        return Err("请先在设置页配置 DeepSeek API Key".to_string());
    }

    let project_path = crate::projects::get_project_path_by_id(&pool, id).await?;
    let root = canonical_project_dir(&project_path)?;
    let context = collect_project_context(&root)?;
    let markdown = request_deepseek_archive(&api_key, &context.prompt).await?;
    let sections = parse_ai_archive_markdown(&markdown);

    if archive_section_count(&sections) == 0 {
        return Err("DeepSeek 未返回可解析的四分区档案".to_string());
    }

    Ok(ArchiveAiDraft {
        sections,
        markdown,
        source_files: context.source_files,
    })
}

async fn read_setting(pool: &SqlitePool, key: &str) -> Result<Option<String>, String> {
    let row = sqlx::query("SELECT value FROM settings WHERE key = $1")
        .bind(key)
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("无法读取设置 {key}: {error}"))?;

    row.map(|value| {
        value
            .try_get("value")
            .map_err(|error| format!("无法解析设置 {key}: {error}"))
    })
    .transpose()
}

async fn save_setting(pool: &SqlitePool, key: &str, value: &str) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await
    .map_err(|error| format!("无法保存设置 {key}: {error}"))?;
    Ok(())
}

fn deepseek_key_status(key: Option<&str>) -> DeepSeekKeyStatus {
    let key = key.unwrap_or_default().trim();
    DeepSeekKeyStatus {
        configured: !key.is_empty(),
        masked: mask_api_key(key),
    }
}

fn mask_api_key(key: &str) -> Option<String> {
    let key = key.trim();
    if key.is_empty() {
        return None;
    }

    let chars = key.chars().collect::<Vec<_>>();
    if chars.len() <= 8 {
        return Some("••••".to_string());
    }

    let head = chars.iter().take(4).collect::<String>();
    let tail = chars
        .iter()
        .skip(chars.len().saturating_sub(4))
        .collect::<String>();
    Some(format!("{head}••••{tail}"))
}

async fn request_deepseek_archive(api_key: &str, context: &str) -> Result<String, String> {
    let request = DeepSeekRequest {
        model: DEEPSEEK_MODEL,
        messages: vec![
            DeepSeekMessage {
                role: "system".to_string(),
                content: SYSTEM_PROMPT.to_string(),
            },
            DeepSeekMessage {
                role: "user".to_string(),
                content: format!("请根据以下项目上下文生成项目档案。\n\n{context}"),
            },
        ],
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| format!("无法初始化 DeepSeek HTTP 客户端: {error}"))?;
    let response = client
        .post(DEEPSEEK_ENDPOINT)
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|error| format!("DeepSeek 请求失败: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "DeepSeek 调用失败({status}): {}",
            truncate_chars(&body, MAX_ERROR_CHARS)
        ));
    }

    let body = response
        .json::<DeepSeekResponse>()
        .await
        .map_err(|error| format!("DeepSeek 响应解析失败: {error}"))?;
    body.choices
        .into_iter()
        .next()
        .map(|choice| choice.message.content.trim().to_string())
        .filter(|content| !content.is_empty())
        .ok_or_else(|| "DeepSeek 未返回档案内容".to_string())
}

fn canonical_project_dir(raw_path: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(raw_path)
        .map_err(|error| format!("无法访问项目目录 {}: {error}", raw_path))?;
    if !path.is_dir() {
        return Err(format!("项目路径不是目录: {}", path.display()));
    }
    Ok(path)
}

fn collect_project_context(root: &Path) -> Result<ProjectContext, String> {
    let root = fs::canonicalize(root)
        .map_err(|error| format!("无法访问项目目录 {}: {error}", root.display()))?;
    let tree = collect_file_tree(&root)?;
    let key_files = collect_key_files(&root);
    let mut source_files = Vec::new();
    let mut prompt = format!("项目根目录: {}\n\n## 文件树\n{}", root.display(), tree);

    if key_files.is_empty() {
        prompt.push_str("\n\n## 关键文件\n未找到 README 或常见配置文件。");
    } else {
        prompt.push_str("\n\n## 关键文件");
    }

    for (relative_path, content) in key_files {
        let block = format!(
            "\n\n### {relative_path}\n```text\n{}\n```",
            truncate_chars(&content, MAX_FILE_CHARS)
        );
        if prompt.chars().count() + block.chars().count() > MAX_CONTEXT_CHARS {
            prompt.push_str("\n\n[后续关键文件已因长度限制裁剪]");
            break;
        }
        prompt.push_str(&block);
        source_files.push(relative_path);
    }

    Ok(ProjectContext {
        prompt: truncate_chars(&prompt, MAX_CONTEXT_CHARS),
        source_files,
    })
}

fn collect_file_tree(root: &Path) -> Result<String, String> {
    let mut lines = Vec::new();
    let mut nodes = 0usize;
    push_tree_lines(root, root, 0, &mut nodes, &mut lines)?;
    Ok(lines.join("\n"))
}

fn push_tree_lines(
    root: &Path,
    dir: &Path,
    depth: usize,
    nodes: &mut usize,
    lines: &mut Vec<String>,
) -> Result<(), String> {
    if depth > MAX_TREE_DEPTH || *nodes >= MAX_TREE_NODES {
        return Ok(());
    }

    let entries = sorted_tree_entries(dir)?;
    for entry in entries {
        if *nodes >= MAX_TREE_NODES {
            lines.push("  ...[文件树已裁剪]".to_string());
            return Ok(());
        }

        *nodes += 1;
        let relative = relative_slash_path(root, &entry.path)?;
        let indent = "  ".repeat(depth);
        let suffix = if entry.is_dir { "/" } else { "" };
        lines.push(format!("{indent}- {relative}{suffix}"));
        if entry.is_dir {
            push_tree_lines(root, &entry.path, depth + 1, nodes, lines)?;
        }
    }

    Ok(())
}

fn sorted_tree_entries(dir: &Path) -> Result<Vec<TreeEntry>, String> {
    let entries =
        fs::read_dir(dir).map_err(|error| format!("无法读取目录 {}: {error}", dir.display()))?;
    let mut children = Vec::new();

    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }

        let path = entry.path();
        if file_type.is_dir() && crate::projects::should_skip_dir(&path) {
            continue;
        }

        children.push(TreeEntry {
            path,
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: file_type.is_dir(),
        });
    }

    children.sort_by(|left, right| match (left.is_dir, right.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
    });
    Ok(children)
}

fn collect_key_files(root: &Path) -> Vec<(String, String)> {
    let mut seen = BTreeSet::new();
    let mut files = Vec::new();

    for candidate in KEY_FILE_CANDIDATES {
        let path = root.join(candidate);
        if !path.is_file() {
            continue;
        }
        let Ok(canonical_path) = fs::canonicalize(&path) else {
            continue;
        };
        if !seen.insert(canonical_path.clone()) {
            continue;
        }
        let Ok(relative_path) = relative_slash_path(root, &canonical_path) else {
            continue;
        };
        let Ok(bytes) = fs::read(&canonical_path) else {
            continue;
        };
        if bytes.contains(&0) {
            continue;
        }
        let Ok(text) = String::from_utf8(bytes) else {
            continue;
        };
        files.push((relative_path, text));
    }

    files
}

fn relative_slash_path(base: &Path, path: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(base)
        .map_err(|error| format!("无法计算相对路径 {}: {error}", path.display()))?;
    let parts = relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(value) => Some(value.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Vec<_>>();
    Ok(parts.join("/"))
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    let char_count = value.chars().count();
    if char_count <= max_chars {
        return value.to_string();
    }

    let mut truncated = value.chars().take(max_chars).collect::<String>();
    truncated.push_str("\n...[已裁剪]");
    truncated
}

fn parse_ai_archive_markdown(markdown: &str) -> ArchiveAiSections {
    let mut sections = ArchiveAiSections::empty();
    let mut current: Option<ArchiveKey> = None;

    for line in markdown.lines() {
        if line.trim_start().starts_with('#') {
            current = archive_key_from_heading(line);
            continue;
        }

        if let Some(key) = &current {
            push_section_line(&mut sections, key, line);
        }
    }

    sections.trimmed()
}

fn archive_key_from_heading(line: &str) -> Option<ArchiveKey> {
    let title = line.trim().trim_start_matches('#').trim();
    if title.contains("项目定位") {
        return Some(ArchiveKey::Positioning);
    }
    if title.contains("技术栈") || title.contains("关键设计") || title.contains("设计决策")
    {
        return Some(ArchiveKey::Tech);
    }
    if title.contains("运行") || title.contains("部署") || title.contains("运维") {
        return Some(ArchiveKey::Deploy);
    }
    if title.contains("待办") || title.contains("已知问题") {
        return Some(ArchiveKey::Todos);
    }
    None
}

fn push_section_line(sections: &mut ArchiveAiSections, key: &ArchiveKey, line: &str) {
    let target = match key {
        ArchiveKey::Positioning => &mut sections.positioning,
        ArchiveKey::Tech => &mut sections.tech,
        ArchiveKey::Deploy => &mut sections.deploy,
        ArchiveKey::Todos => &mut sections.todos,
    };
    if !target.is_empty() {
        target.push('\n');
    }
    target.push_str(line);
}

fn archive_section_count(sections: &ArchiveAiSections) -> usize {
    [
        &sections.positioning,
        &sections.tech,
        &sections.deploy,
        &sections.todos,
    ]
    .iter()
    .filter(|value| !value.trim().is_empty())
    .count()
}

impl ArchiveAiSections {
    fn empty() -> Self {
        Self {
            positioning: String::new(),
            tech: String::new(),
            deploy: String::new(),
            todos: String::new(),
        }
    }

    fn trimmed(self) -> Self {
        Self {
            positioning: self.positioning.trim().to_string(),
            tech: self.tech.trim().to_string(),
            deploy: self.deploy.trim().to_string(),
            todos: self.todos.trim().to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_api_key_without_leaking_full_value() {
        let status = deepseek_key_status(Some("sk-1234567890abcdef"));

        assert!(status.configured);
        assert_eq!(status.masked.as_deref(), Some("sk-1••••cdef"));
        assert!(!status.masked.expect("masked key").contains("4567890ab"));
    }

    #[test]
    fn parses_numbered_archive_markdown() {
        let markdown = "## 1) 项目定位\n\n本地项目记忆库\n\n## 2) 技术栈与关键设计决策\n\nTauri + React\n\n## 3) 如何运行/部署/运维\n\nnpm run tauri dev\n\n## 4) 待办与已知问题\n\n- [ ] T8";
        let sections = parse_ai_archive_markdown(markdown);

        assert_eq!(sections.positioning, "本地项目记忆库");
        assert_eq!(sections.tech, "Tauri + React");
        assert_eq!(sections.deploy, "npm run tauri dev");
        assert_eq!(sections.todos, "- [ ] T8");
    }

    #[test]
    fn collects_context_from_tree_and_key_files() {
        let root = std::env::temp_dir().join(format!("memoir-ai-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("node_modules/pkg")).expect("create skipped dir");
        fs::create_dir_all(root.join("src")).expect("create src");
        fs::write(root.join("README.md"), "# Memoir").expect("write readme");
        fs::write(root.join("src/main.ts"), "console.log('memoir')").expect("write main");
        fs::write(root.join("node_modules/pkg/index.js"), "ignored").expect("write ignored");

        let context = collect_project_context(&root).expect("collect context");

        assert!(context.prompt.contains("README.md"));
        assert!(context.prompt.contains("src/main.ts"));
        assert!(!context.prompt.contains("node_modules/pkg/index.js"));
        assert_eq!(context.source_files, vec!["README.md", "src/main.ts"]);

        let _ = fs::remove_dir_all(root);
    }
}
