use serde::Serialize;
use std::{
    cmp::Ordering,
    fs,
    path::{Component, Path, PathBuf},
};
use tauri::{AppHandle, Runtime};

const DEFAULT_DEPTH: usize = 5;
const MAX_DEPTH: usize = 8;
const MAX_PREVIEW_BYTES: u64 = 512 * 1024;

#[derive(Debug, Serialize)]
pub struct FileTreeNode {
    name: String,
    path: String,
    #[serde(rename = "type")]
    node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileTreeNode>>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct FilePreview {
    kind: String,
    text: Option<String>,
    message: Option<String>,
}

struct ChildEntry {
    path: PathBuf,
    name: String,
    is_dir: bool,
}

#[tauri::command]
pub async fn get_file_tree<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    depth: Option<usize>,
) -> Result<FileTreeNode, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let project_path = crate::projects::get_project_path_by_id(&pool, id).await?;
    let base = canonical_project_dir(&project_path)?;
    build_file_tree_node(
        &base,
        &base,
        0,
        depth.unwrap_or(DEFAULT_DEPTH).min(MAX_DEPTH),
    )
}

#[tauri::command]
pub async fn read_project_file<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    path: String,
) -> Result<FilePreview, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let project_path = crate::projects::get_project_path_by_id(&pool, id).await?;
    let base = canonical_project_dir(&project_path)?;
    let relative_path = safe_relative_path(&path)?;
    let target = base.join(relative_path);
    let target =
        fs::canonicalize(&target).map_err(|error| format!("无法访问文件 {}: {error}", path))?;

    if !target.starts_with(&base) {
        return Err(format!("文件路径越界: {path}"));
    }

    let metadata = fs::metadata(&target)
        .map_err(|error| format!("无法读取文件信息 {}: {error}", target.display()))?;
    if !metadata.is_file() {
        return Ok(placeholder_preview("unavailable", "请选择左侧文件进行预览"));
    }
    if metadata.len() > MAX_PREVIEW_BYTES {
        return Ok(placeholder_preview(
            "too_large",
            "文件超过 512 KB,已跳过预览",
        ));
    }

    let bytes =
        fs::read(&target).map_err(|error| format!("无法读取文件 {}: {error}", target.display()))?;
    Ok(preview_from_bytes(bytes))
}

fn canonical_project_dir(raw_path: &str) -> Result<PathBuf, String> {
    let path = fs::canonicalize(raw_path)
        .map_err(|error| format!("无法访问项目目录 {}: {error}", raw_path))?;
    if !path.is_dir() {
        return Err(format!("项目路径不是目录: {}", path.display()));
    }
    Ok(path)
}

fn build_file_tree_node(
    base: &Path,
    path: &Path,
    current_depth: usize,
    depth_limit: usize,
) -> Result<FileTreeNode, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("无法读取路径信息 {}: {error}", path.display()))?;
    let is_dir = metadata.is_dir();
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());

    let children = if is_dir {
        let entries = if current_depth >= depth_limit {
            Vec::new()
        } else {
            match sorted_children(path) {
                Ok(entries) => entries,
                Err(error) if current_depth == 0 => return Err(error),
                Err(_) => Vec::new(),
            }
        };
        Some(
            entries
                .iter()
                .filter_map(|entry| {
                    build_file_tree_node(base, &entry.path, current_depth + 1, depth_limit).ok()
                })
                .collect(),
        )
    } else {
        None
    };

    Ok(FileTreeNode {
        name,
        path: relative_slash_path(base, path)?,
        node_type: if is_dir { "folder" } else { "file" }.to_string(),
        children,
    })
}

fn sorted_children(dir: &Path) -> Result<Vec<ChildEntry>, String> {
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

        children.push(ChildEntry {
            path,
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: file_type.is_dir(),
        });
    }

    children.sort_by(|left, right| match (left.is_dir, right.is_dir) {
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        _ => left.name.to_lowercase().cmp(&right.name.to_lowercase()),
    });
    Ok(children)
}

fn relative_slash_path(base: &Path, path: &Path) -> Result<String, String> {
    if path == base {
        return Ok(String::new());
    }

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

fn safe_relative_path(raw_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw_path);
    if path.is_absolute() {
        return Err(format!("文件路径不能是绝对路径: {raw_path}"));
    }

    let mut safe_path = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => safe_path.push(value),
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(format!("文件路径不安全: {raw_path}"));
            }
        }
    }

    if safe_path.as_os_str().is_empty() {
        return Err("请选择一个文件".to_string());
    }
    Ok(safe_path)
}

fn preview_from_bytes(bytes: Vec<u8>) -> FilePreview {
    if bytes.contains(&0) {
        return placeholder_preview("binary", "二进制文件不可预览");
    }

    match String::from_utf8(bytes) {
        Ok(text) => FilePreview {
            kind: "text".to_string(),
            text: Some(text),
            message: None,
        },
        Err(_) => placeholder_preview("binary", "二进制或非 UTF-8 文件不可预览"),
    }
}

fn placeholder_preview(kind: &str, message: &str) -> FilePreview {
    FilePreview {
        kind: kind.to_string(),
        text: None,
        message: Some(message.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsafe_relative_paths() {
        assert!(safe_relative_path("../Cargo.toml").is_err());
        assert!(safe_relative_path("/tmp/file.txt").is_err());
        assert_eq!(
            safe_relative_path("./src/main.rs").expect("safe path"),
            PathBuf::from("src/main.rs")
        );
    }

    #[test]
    fn detects_binary_preview() {
        assert_eq!(preview_from_bytes(vec![b'a', 0, b'b']).kind, "binary");
        assert_eq!(preview_from_bytes(vec![0xff, 0xfe]).kind, "binary");
        assert_eq!(
            preview_from_bytes("hello".as_bytes().to_vec())
                .text
                .as_deref(),
            Some("hello")
        );
    }

    #[test]
    fn formats_relative_paths_with_slashes() {
        let root =
            std::env::temp_dir().join(format!("memoir-file-tree-test-{}", std::process::id()));
        let nested = root.join("src").join("main.rs");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(nested.parent().expect("nested parent")).expect("create temp tree");
        fs::write(&nested, "fn main() {}").expect("write file");

        assert_eq!(
            relative_slash_path(&root, &nested).expect("relative path"),
            "src/main.rs"
        );

        let _ = fs::remove_dir_all(&root);
    }
}
