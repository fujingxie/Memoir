use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Runtime};

const ARCHIVE_DIR: &str = ".memoir";
const ARCHIVE_FILE: &str = "archive.md";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ArchiveSections {
    positioning: String,
    tech: String,
    deploy: String,
    todos: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct ArchiveRecord {
    sections: ArchiveSections,
    completeness: i64,
    md_path: String,
}

#[derive(Debug, Serialize)]
struct ArchiveSectionState {
    positioning: bool,
    tech: bool,
    deploy: bool,
    todos: bool,
}

enum ArchiveKey {
    Positioning,
    Tech,
    Deploy,
    Todos,
}

#[tauri::command]
pub async fn read_archive<R: Runtime>(app: AppHandle<R>, id: i64) -> Result<ArchiveRecord, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;
    let md_path = archive_md_path(&root);

    if !md_path.exists() {
        return Ok(ArchiveRecord {
            sections: ArchiveSections::empty(),
            completeness: 0,
            md_path: md_path.to_string_lossy().to_string(),
        });
    }

    let markdown = fs::read_to_string(&md_path)
        .map_err(|error| format!("无法读取项目档案 {}: {error}", md_path.display()))?;
    let sections = parse_archive_markdown(&markdown);
    let completeness = archive_completeness(&sections);
    upsert_archive_record(&pool, id, &md_path, &sections, completeness).await?;
    Ok(ArchiveRecord {
        sections,
        completeness,
        md_path: md_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn save_archive<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    sections: ArchiveSections,
) -> Result<ArchiveRecord, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;
    let md_path = write_archive_file(&root, &sections)?;
    let completeness = archive_completeness(&sections);
    upsert_archive_record(&pool, id, &md_path, &sections, completeness).await?;
    Ok(ArchiveRecord {
        sections,
        completeness,
        md_path: md_path.to_string_lossy().to_string(),
    })
}

impl ArchiveSections {
    fn empty() -> Self {
        Self {
            positioning: String::new(),
            tech: String::new(),
            deploy: String::new(),
            todos: String::new(),
        }
    }
}

async fn project_root(pool: &SqlitePool, id: i64) -> Result<PathBuf, String> {
    let project_path = crate::projects::get_project_path_by_id(pool, id).await?;
    let root = fs::canonicalize(&project_path)
        .map_err(|error| format!("无法访问项目目录 {}: {error}", project_path))?;
    if !root.is_dir() {
        return Err(format!("项目路径不是目录: {}", root.display()));
    }
    Ok(root)
}

fn archive_md_path(root: &Path) -> PathBuf {
    root.join(ARCHIVE_DIR).join(ARCHIVE_FILE)
}

fn write_archive_file(root: &Path, sections: &ArchiveSections) -> Result<PathBuf, String> {
    let archive_dir = root.join(ARCHIVE_DIR);
    let md_path = archive_dir.join(ARCHIVE_FILE);
    fs::create_dir_all(&archive_dir)
        .map_err(|error| format!("无法创建项目档案目录 {}: {error}", archive_dir.display()))?;

    let markdown = render_archive_markdown(sections);
    fs::write(&md_path, markdown)
        .map_err(|error| format!("无法写入项目档案 {}: {error}", md_path.display()))?;
    Ok(md_path)
}

fn render_archive_markdown(sections: &ArchiveSections) -> String {
    [
        ("项目定位", sections.positioning.as_str()),
        ("技术栈与设计", sections.tech.as_str()),
        ("运行部署运维", sections.deploy.as_str()),
        ("待办与已知问题", sections.todos.as_str()),
    ]
    .iter()
    .map(|(title, text)| format!("## {title}\n\n{}\n", text.trim()))
    .collect::<Vec<_>>()
    .join("\n")
}

fn parse_archive_markdown(markdown: &str) -> ArchiveSections {
    let mut sections = ArchiveSections::empty();
    let mut current: Option<ArchiveKey> = None;

    for line in markdown.lines() {
        if line.starts_with("## ") {
            current = archive_key_from_heading(line);
            continue;
        }

        if let Some(key) = &current {
            push_section_line(&mut sections, key, line);
        }
    }

    sections.positioning = sections.positioning.trim().to_string();
    sections.tech = sections.tech.trim().to_string();
    sections.deploy = sections.deploy.trim().to_string();
    sections.todos = sections.todos.trim().to_string();
    sections
}

fn archive_key_from_heading(line: &str) -> Option<ArchiveKey> {
    let title = line.strip_prefix("## ")?.trim();
    match title {
        "项目定位" => Some(ArchiveKey::Positioning),
        "技术栈与设计" => Some(ArchiveKey::Tech),
        "运行部署运维" => Some(ArchiveKey::Deploy),
        "待办与已知问题" => Some(ArchiveKey::Todos),
        _ => None,
    }
}

fn push_section_line(sections: &mut ArchiveSections, key: &ArchiveKey, line: &str) {
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

fn archive_completeness(sections: &ArchiveSections) -> i64 {
    let filled = [
        &sections.positioning,
        &sections.tech,
        &sections.deploy,
        &sections.todos,
    ]
    .iter()
    .filter(|value| !value.trim().is_empty())
    .count() as i64;
    filled * 25
}

fn sections_state_json(sections: &ArchiveSections) -> Result<String, String> {
    let state = ArchiveSectionState {
        positioning: !sections.positioning.trim().is_empty(),
        tech: !sections.tech.trim().is_empty(),
        deploy: !sections.deploy.trim().is_empty(),
        todos: !sections.todos.trim().is_empty(),
    };
    serde_json::to_string(&state).map_err(|error| format!("无法序列化档案状态: {error}"))
}

async fn upsert_archive_record(
    pool: &SqlitePool,
    project_id: i64,
    md_path: &Path,
    sections: &ArchiveSections,
    completeness: i64,
) -> Result<(), String> {
    let sections_state = sections_state_json(sections)?;
    let md_path = md_path.to_string_lossy().to_string();
    sqlx::query(
        "INSERT INTO archives (project_id, md_path, sections_state, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT(project_id) DO UPDATE SET
           md_path = excluded.md_path,
           sections_state = excluded.sections_state,
           updated_at = CURRENT_TIMESTAMP",
    )
    .bind(project_id)
    .bind(md_path)
    .bind(sections_state)
    .execute(pool)
    .await
    .map_err(|error| format!("无法写入档案索引: {error}"))?;

    sqlx::query("UPDATE projects SET archive_completeness = $1 WHERE id = $2")
        .bind(completeness)
        .bind(project_id)
        .execute(pool)
        .await
        .map_err(|error| format!("无法更新档案完整度: {error}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_and_parses_archive_markdown() {
        let sections = ArchiveSections {
            positioning: "本地项目记忆库".to_string(),
            tech: "Tauri + React".to_string(),
            deploy: "pnpm tauri dev".to_string(),
            todos: "- [ ] T7".to_string(),
        };

        let markdown = render_archive_markdown(&sections);
        assert!(markdown.contains("## 项目定位"));
        assert_eq!(parse_archive_markdown(&markdown), sections);
    }

    #[test]
    fn computes_completeness_from_four_sections() {
        let sections = ArchiveSections {
            positioning: "x".to_string(),
            tech: String::new(),
            deploy: "y".to_string(),
            todos: String::new(),
        };

        assert_eq!(archive_completeness(&sections), 50);
    }

    #[test]
    fn writes_archive_markdown_file() {
        let root = std::env::temp_dir().join(format!("memoir-archive-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create temp root");
        let sections = ArchiveSections {
            positioning: "本地项目记忆库".to_string(),
            tech: "Tauri + React".to_string(),
            deploy: "npm run tauri dev".to_string(),
            todos: "- [ ] T8".to_string(),
        };

        let md_path = write_archive_file(&root, &sections).expect("write archive");
        let markdown = fs::read_to_string(&md_path).expect("read archive");

        assert_eq!(md_path, root.join(".memoir").join("archive.md"));
        assert!(markdown.contains("## 项目定位"));
        assert!(markdown.contains("本地项目记忆库"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn ignores_unknown_markdown_sections() {
        let markdown = "## 项目定位\n\nhello\n\n## 其他\n\nignored\n\n## 待办与已知问题\n\n- todo";
        let sections = parse_archive_markdown(markdown);

        assert_eq!(sections.positioning, "hello");
        assert_eq!(sections.todos, "- todo");
        assert!(sections.tech.is_empty());
    }
}
