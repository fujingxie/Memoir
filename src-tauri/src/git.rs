use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    process::Command,
};
use tauri::{AppHandle, Runtime};

const DEFAULT_LOG_LIMIT: usize = 20;
const MAX_LOG_LIMIT: usize = 100;
const RECORD_SEPARATOR: char = '\x1e';
const FIELD_SEPARATOR: char = '\x1f';

#[derive(Debug, Serialize)]
pub struct GitStatus {
    tracked: bool,
    branch: String,
    remote_url: Option<String>,
    ahead: i64,
    behind: i64,
    dirty: bool,
    changes: i64,
    files: Vec<GitChangedFile>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct GitCommit {
    hash: String,
    full_hash: String,
    message: String,
    author: String,
    date: String,
    additions: i64,
    deletions: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GitChangedFile {
    path: String,
    status: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct GitCommandResult {
    message: String,
}

#[derive(Debug, Deserialize)]
pub struct GitHubPublishInput {
    token: Option<String>,
    repo_name: String,
    private: bool,
    description: Option<String>,
    branch: Option<String>,
    commit_message: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct GitHubPublishResult {
    message: String,
    remote_url: String,
    html_url: String,
    branch: String,
}

struct NormalizedGitHubPublishInput {
    token: String,
    repo_name: String,
    private: bool,
    description: Option<String>,
    branch: String,
    commit_message: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRepositoryResponse {
    clone_url: String,
    html_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubErrorResponse {
    message: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct GitDiff {
    files: Vec<GitDiffFile>,
    additions: i64,
    deletions: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GitDiffFile {
    path: String,
    additions: i64,
    deletions: i64,
    lines: Vec<GitDiffLine>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct GitDiffLine {
    kind: String,
    content: String,
}

#[tauri::command]
pub async fn git_status<R: Runtime>(app: AppHandle<R>, id: i64) -> Result<GitStatus, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;

    if !is_git_repository(&root)? {
        clear_git_cache(&pool, id).await?;
        return Ok(GitStatus::untracked());
    }

    let branch = current_branch(&root)?;
    let remote_url = run_git_optional(&root, &["config", "--get", "remote.origin.url"])?;
    let (ahead, behind) = upstream_counts(&root)?;
    let status_output = run_git(&root, &["status", "--porcelain=v1"])?;
    let files = parse_changed_files(&status_output);
    let changes = files.len() as i64;
    let last_commit_at = run_git_optional(&root, &["log", "-1", "--format=%aI"])?;

    let status = GitStatus {
        tracked: true,
        branch,
        remote_url,
        ahead,
        behind,
        dirty: changes > 0,
        changes,
        files,
    };

    upsert_git_cache(&pool, id, &status).await?;
    update_project_git_fields(
        &pool,
        id,
        status.remote_url.as_deref(),
        last_commit_at.as_deref(),
    )
    .await?;
    Ok(status)
}

#[tauri::command]
pub async fn git_log<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    limit: Option<usize>,
) -> Result<Vec<GitCommit>, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;
    if !is_git_repository(&root)? {
        return Ok(Vec::new());
    }
    if run_git_optional(&root, &["rev-parse", "--verify", "HEAD"])?.is_none() {
        return Ok(Vec::new());
    }

    let limit = limit.unwrap_or(DEFAULT_LOG_LIMIT).clamp(1, MAX_LOG_LIMIT);
    let limit_arg = limit.to_string();
    let pretty_arg = format!("--pretty=format:%x1e%h%x1f%H%x1f%an%x1f%aI%x1f%s");
    let output = run_git(
        &root,
        &["log", "-n", &limit_arg, "--numstat", pretty_arg.as_str()],
    )?;
    Ok(parse_git_log(&output))
}

#[tauri::command]
pub async fn git_init<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<GitCommandResult, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = normalize_existing_dir(&path)?;
    let output = run_git(&root, &["init"])?;
    let normalized = root.to_string_lossy().to_string();
    mark_project_as_git_by_path(&pool, &normalized).await?;
    Ok(GitCommandResult {
        message: if output.trim().is_empty() {
            "Git 仓库已初始化".to_string()
        } else {
            output
        },
    })
}

#[tauri::command]
pub async fn git_set_remote<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    url: String,
) -> Result<GitCommandResult, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;
    ensure_git_repository(&root)?;

    let remote_url = url.trim();
    if remote_url.is_empty() {
        return Err("请输入远程仓库地址".to_string());
    }

    set_origin_remote(&root, remote_url)?;
    update_project_remote_url(&pool, id, remote_url).await?;
    Ok(GitCommandResult {
        message: "远程仓库已更新".to_string(),
    })
}

#[tauri::command]
pub async fn git_publish_to_github<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    input: GitHubPublishInput,
) -> Result<GitHubPublishResult, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;
    let input = normalize_github_publish_input(input)?;

    if !is_git_repository(&root)? {
        run_git(&root, &["init"])?;
        let normalized = root.to_string_lossy().to_string();
        mark_project_as_git_by_path(&pool, &normalized).await?;
    }

    run_git(&root, &["add", "-A"])?;
    ensure_publish_commit(&root, &input.commit_message)?;

    let repository = create_github_repository(&input).await?;
    run_git_dynamic(
        &root,
        vec!["branch".to_string(), "-M".to_string(), input.branch.clone()],
    )?;
    set_origin_remote(&root, &repository.clone_url)?;

    let push_url = authenticated_github_url(&repository.clone_url, &input.token)?;
    run_git_dynamic_redacted(
        &root,
        vec![
            "push".to_string(),
            "-u".to_string(),
            push_url,
            input.branch.clone(),
        ],
        vec![
            "push".to_string(),
            "-u".to_string(),
            "<github-token-url>".to_string(),
            input.branch.clone(),
        ],
    )?;

    let last_commit_at = run_git_optional(&root, &["log", "-1", "--format=%aI"])?;
    update_project_git_fields(
        &pool,
        id,
        Some(repository.clone_url.as_str()),
        last_commit_at.as_deref(),
    )
    .await?;

    Ok(GitHubPublishResult {
        message: format!("已创建 GitHub 仓库并推送到 {}", repository.html_url),
        remote_url: repository.clone_url,
        html_url: repository.html_url,
        branch: input.branch,
    })
}

#[tauri::command]
pub async fn git_commit<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    message: String,
    files: Vec<String>,
) -> Result<GitCommandResult, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;
    ensure_git_repository(&root)?;

    let message = message.trim();
    if message.is_empty() {
        return Err("请输入提交信息".to_string());
    }
    if files.is_empty() {
        return Err("请选择至少一个文件".to_string());
    }

    for file in files {
        let safe_file = safe_relative_git_path(&file)?;
        run_git_dynamic(
            &root,
            vec![
                "add".to_string(),
                "--".to_string(),
                safe_file.to_string_lossy().to_string(),
            ],
        )?;
    }

    let output = run_git_dynamic(
        &root,
        vec!["commit".to_string(), "-m".to_string(), message.to_string()],
    )?;
    let last_commit_at = run_git_optional(&root, &["log", "-1", "--format=%aI"])?;
    update_project_last_commit_at(&pool, id, last_commit_at.as_deref()).await?;
    Ok(GitCommandResult { message: output })
}

#[tauri::command]
pub async fn git_push<R: Runtime>(app: AppHandle<R>, id: i64) -> Result<GitCommandResult, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;
    ensure_git_repository(&root)?;
    let output = run_git(&root, &["push"])?;
    Ok(GitCommandResult {
        message: if output.trim().is_empty() {
            "Push 完成".to_string()
        } else {
            output
        },
    })
}

#[tauri::command]
pub async fn git_pull<R: Runtime>(app: AppHandle<R>, id: i64) -> Result<GitCommandResult, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;
    ensure_git_repository(&root)?;
    let output = run_git(&root, &["pull", "--ff-only"])?;
    let last_commit_at = run_git_optional(&root, &["log", "-1", "--format=%aI"])?;
    update_project_last_commit_at(&pool, id, last_commit_at.as_deref()).await?;
    Ok(GitCommandResult {
        message: if output.trim().is_empty() {
            "Pull 完成".to_string()
        } else {
            output
        },
    })
}

#[tauri::command]
pub async fn git_diff<R: Runtime>(
    app: AppHandle<R>,
    id: i64,
    file: Option<String>,
    commit: Option<String>,
) -> Result<GitDiff, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let root = project_root(&pool, id).await?;
    ensure_git_repository(&root)?;

    let safe_file = file
        .as_deref()
        .map(safe_relative_git_path)
        .transpose()?
        .map(|path| path.to_string_lossy().to_string());
    let commit = commit.as_deref().map(safe_revision).transpose()?;

    let (numstat, patch) = if let Some(revision) = commit {
        (
            run_git_diff_command(&root, "show", &revision, "--numstat", safe_file.as_deref())?,
            run_git_diff_command(&root, "show", &revision, "--patch", safe_file.as_deref())?,
        )
    } else {
        (
            run_git_worktree_diff_command(&root, "--numstat", safe_file.as_deref())?,
            run_git_worktree_diff_command(&root, "--patch", safe_file.as_deref())?,
        )
    };

    Ok(build_git_diff(&numstat, &patch))
}

impl GitStatus {
    fn untracked() -> Self {
        Self {
            tracked: false,
            branch: String::new(),
            remote_url: None,
            ahead: 0,
            behind: 0,
            dirty: false,
            changes: 0,
            files: Vec::new(),
        }
    }
}

fn ensure_git_repository(root: &Path) -> Result<(), String> {
    if is_git_repository(root)? {
        return Ok(());
    }
    Err(format!("{} 不是 Git 仓库", root.display()))
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

async fn project_root(pool: &SqlitePool, id: i64) -> Result<PathBuf, String> {
    let project_path = crate::projects::get_project_path_by_id(pool, id).await?;
    let root = fs::canonicalize(&project_path)
        .map_err(|error| format!("无法访问项目目录 {}: {error}", project_path))?;
    if !root.is_dir() {
        return Err(format!("项目路径不是目录: {}", root.display()));
    }
    Ok(root)
}

fn is_git_repository(root: &Path) -> Result<bool, String> {
    let Some(output) = run_git_optional(root, &["rev-parse", "--is-inside-work-tree"])? else {
        return Ok(false);
    };
    Ok(output.trim() == "true")
}

fn current_branch(root: &Path) -> Result<String, String> {
    if let Some(branch) = run_git_optional(root, &["branch", "--show-current"])? {
        if !branch.trim().is_empty() {
            return Ok(branch);
        }
    }

    let hash = run_git_optional(root, &["rev-parse", "--short", "HEAD"])?
        .unwrap_or_else(|| "HEAD".to_string());
    Ok(format!("detached@{hash}"))
}

fn upstream_counts(root: &Path) -> Result<(i64, i64), String> {
    let Some(output) = run_git_optional(
        root,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    )?
    else {
        return Ok((0, 0));
    };
    parse_ahead_behind(&output)
}

fn parse_ahead_behind(output: &str) -> Result<(i64, i64), String> {
    let mut parts = output.split_whitespace();
    let ahead = parts
        .next()
        .unwrap_or("0")
        .parse::<i64>()
        .map_err(|error| format!("无法解析 ahead 数量: {error}"))?;
    let behind = parts
        .next()
        .unwrap_or("0")
        .parse::<i64>()
        .map_err(|error| format!("无法解析 behind 数量: {error}"))?;
    Ok((ahead, behind))
}

fn parse_changed_files(output: &str) -> Vec<GitChangedFile> {
    output.lines().filter_map(parse_changed_file).collect()
}

fn parse_changed_file(line: &str) -> Option<GitChangedFile> {
    if line.trim().is_empty() || line.len() < 4 {
        return None;
    }

    let status = line.get(0..2)?.trim().to_string();
    let raw_path = line.get(3..)?.trim();
    let path = raw_path
        .rsplit_once(" -> ")
        .map(|(_, next)| next)
        .unwrap_or(raw_path)
        .to_string();

    Some(GitChangedFile { path, status })
}

fn normalize_github_publish_input(
    input: GitHubPublishInput,
) -> Result<NormalizedGitHubPublishInput, String> {
    let token = resolve_github_publish_token(input.token.as_deref())?;

    let repo_name = normalize_github_repo_name(&input.repo_name)?;
    let branch = input
        .branch
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(safe_revision)
        .transpose()?
        .unwrap_or_else(|| "main".to_string());
    let commit_message = input
        .commit_message
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Initial commit")
        .to_string();
    let description = input
        .description
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    Ok(NormalizedGitHubPublishInput {
        token,
        repo_name,
        private: input.private,
        description,
        branch,
        commit_message,
    })
}

fn normalize_github_repo_name(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() {
        return Err("请输入 GitHub 仓库名".to_string());
    }
    if value.contains('/') || value.contains('\\') || value.starts_with('.') {
        return Err(format!("GitHub 仓库名不合法: {value}"));
    }
    if !value
        .chars()
        .all(|item| item.is_ascii_alphanumeric() || matches!(item, '-' | '_' | '.'))
    {
        return Err(format!("GitHub 仓库名不合法: {value}"));
    }
    Ok(value.to_string())
}

fn resolve_github_publish_token(token: Option<&str>) -> Result<String, String> {
    let token = token.unwrap_or_default().trim();
    if !token.is_empty() {
        return Ok(token.to_string());
    }

    crate::secrets::load_github_token()?
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "请先在设置页保存 GitHub Token,或在发布表单中临时输入 Token".to_string())
}

async fn create_github_repository(
    input: &NormalizedGitHubPublishInput,
) -> Result<GitHubRepositoryResponse, String> {
    let client = reqwest::Client::builder()
        .user_agent("Memoir/0.1.0")
        .build()
        .map_err(|error| format!("无法初始化 GitHub HTTP 客户端: {error}"))?;
    let body = serde_json::json!({
        "name": input.repo_name,
        "private": input.private,
        "description": input.description.as_deref(),
        "auto_init": false,
    });

    let response = client
        .post("https://api.github.com/user/repos")
        .bearer_auth(&input.token)
        .header("Accept", "application/vnd.github+json")
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("GitHub 创建仓库请求失败: {error}"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("GitHub 响应读取失败: {error}"))?;

    if !status.is_success() {
        let message = serde_json::from_str::<GitHubErrorResponse>(&text)
            .ok()
            .and_then(|error| error.message)
            .filter(|message| !message.trim().is_empty())
            .unwrap_or(text);
        return Err(format!("GitHub 创建仓库失败({status}): {message}"));
    }

    serde_json::from_str(&text).map_err(|error| format!("GitHub 响应解析失败: {error}"))
}

fn ensure_publish_commit(root: &Path, message: &str) -> Result<(), String> {
    let has_head = run_git_optional(root, &["rev-parse", "--verify", "HEAD"])?.is_some();
    let has_staged = has_staged_changes(root)?;

    if has_head && !has_staged {
        return Ok(());
    }

    if has_staged {
        run_git_dynamic(
            root,
            vec!["commit".to_string(), "-m".to_string(), message.to_string()],
        )?;
        return Ok(());
    }

    run_git_dynamic(
        root,
        vec![
            "commit".to_string(),
            "--allow-empty".to_string(),
            "-m".to_string(),
            message.to_string(),
        ],
    )?;
    Ok(())
}

fn has_staged_changes(root: &Path) -> Result<bool, String> {
    let output = Command::new("git")
        .args(["diff", "--cached", "--quiet"])
        .current_dir(root)
        .output()
        .map_err(|error| format!("无法执行 git: {error}"))?;

    match output.status.code() {
        Some(0) => Ok(false),
        Some(1) => Ok(true),
        _ => {
            let stderr = trim_command_output(&output.stderr);
            let stdout = trim_command_output(&output.stdout);
            let detail = if !stderr.is_empty() { stderr } else { stdout };
            Err(format!("git diff --cached --quiet 执行失败: {detail}"))
        }
    }
}

fn set_origin_remote(root: &Path, remote_url: &str) -> Result<(), String> {
    if run_git_optional(root, &["remote", "get-url", "origin"])?.is_some() {
        run_git_dynamic(
            root,
            vec![
                "remote".to_string(),
                "set-url".to_string(),
                "origin".to_string(),
                remote_url.to_string(),
            ],
        )?;
        return Ok(());
    }

    run_git_dynamic(
        root,
        vec![
            "remote".to_string(),
            "add".to_string(),
            "origin".to_string(),
            remote_url.to_string(),
        ],
    )?;
    Ok(())
}

fn authenticated_github_url(clone_url: &str, token: &str) -> Result<String, String> {
    let Some(rest) = clone_url.strip_prefix("https://") else {
        return Err(format!("GitHub clone_url 不是 HTTPS 地址: {clone_url}"));
    };
    Ok(format!(
        "https://x-access-token:{}@{}",
        percent_encode_userinfo(token),
        rest
    ))
}

fn percent_encode_userinfo(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

async fn upsert_git_cache(
    pool: &SqlitePool,
    project_id: i64,
    status: &GitStatus,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO git_cache (project_id, branch, ahead, behind, dirty, fetched_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT(project_id) DO UPDATE SET
           branch = excluded.branch,
           ahead = excluded.ahead,
           behind = excluded.behind,
           dirty = excluded.dirty,
           fetched_at = CURRENT_TIMESTAMP",
    )
    .bind(project_id)
    .bind(&status.branch)
    .bind(status.ahead)
    .bind(status.behind)
    .bind(if status.dirty { 1 } else { 0 })
    .execute(pool)
    .await
    .map_err(|error| format!("无法写入 Git 缓存: {error}"))?;
    Ok(())
}

async fn update_project_git_fields(
    pool: &SqlitePool,
    project_id: i64,
    remote_url: Option<&str>,
    last_commit_at: Option<&str>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE projects
         SET vcs_type = 'git', remote_url = $1, last_commit_at = $2
         WHERE id = $3",
    )
    .bind(remote_url)
    .bind(last_commit_at)
    .bind(project_id)
    .execute(pool)
    .await
    .map_err(|error| format!("无法更新项目 Git 信息: {error}"))?;
    Ok(())
}

async fn mark_project_as_git_by_path(pool: &SqlitePool, path: &str) -> Result<(), String> {
    sqlx::query(
        "UPDATE projects
         SET vcs_type = 'git', last_opened_at = CURRENT_TIMESTAMP
         WHERE path = $1",
    )
    .bind(path)
    .execute(pool)
    .await
    .map_err(|error| format!("无法更新项目 Git 状态: {error}"))?;
    Ok(())
}

async fn update_project_remote_url(
    pool: &SqlitePool,
    project_id: i64,
    remote_url: &str,
) -> Result<(), String> {
    sqlx::query("UPDATE projects SET vcs_type = 'git', remote_url = $1 WHERE id = $2")
        .bind(remote_url)
        .bind(project_id)
        .execute(pool)
        .await
        .map_err(|error| format!("无法更新项目远程仓库: {error}"))?;
    Ok(())
}

async fn update_project_last_commit_at(
    pool: &SqlitePool,
    project_id: i64,
    last_commit_at: Option<&str>,
) -> Result<(), String> {
    sqlx::query("UPDATE projects SET vcs_type = 'git', last_commit_at = $1 WHERE id = $2")
        .bind(last_commit_at)
        .bind(project_id)
        .execute(pool)
        .await
        .map_err(|error| format!("无法更新项目最近提交时间: {error}"))?;
    Ok(())
}

async fn clear_git_cache(pool: &SqlitePool, project_id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM git_cache WHERE project_id = $1")
        .bind(project_id)
        .execute(pool)
        .await
        .map_err(|error| format!("无法清理 Git 缓存: {error}"))?;
    sqlx::query(
        "UPDATE projects
         SET vcs_type = 'none', remote_url = NULL, last_commit_at = NULL
         WHERE id = $1",
    )
    .bind(project_id)
    .execute(pool)
    .await
    .map_err(|error| format!("无法更新项目 Git 状态: {error}"))?;
    Ok(())
}

fn run_git(root: &Path, args: &[&str]) -> Result<String, String> {
    let args = args
        .iter()
        .map(|arg| (*arg).to_string())
        .collect::<Vec<_>>();
    run_git_dynamic(root, args)
}

fn run_git_dynamic(root: &Path, args: Vec<String>) -> Result<String, String> {
    run_git_dynamic_with_error_args(root, args.clone(), args)
}

fn run_git_dynamic_redacted(
    root: &Path,
    args: Vec<String>,
    error_args: Vec<String>,
) -> Result<String, String> {
    run_git_dynamic_with_error_args(root, args, error_args)
}

fn run_git_dynamic_with_error_args(
    root: &Path,
    args: Vec<String>,
    error_args: Vec<String>,
) -> Result<String, String> {
    let output = Command::new("git")
        .args(&args)
        .current_dir(root)
        .output()
        .map_err(|error| format!("无法执行 git: {error}"))?;

    if output.status.success() {
        return Ok(trim_command_output(&output.stdout));
    }

    let stderr = trim_command_output(&output.stderr);
    let stdout = trim_command_output(&output.stdout);
    let detail = if !stderr.is_empty() { stderr } else { stdout };
    Err(format!("git {} 执行失败: {detail}", error_args.join(" ")))
}

fn run_git_optional(root: &Path, args: &[&str]) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|error| format!("无法执行 git: {error}"))?;

    if output.status.success() {
        return Ok(Some(trim_command_output(&output.stdout)));
    }
    Ok(None)
}

fn trim_command_output(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes)
        .trim_end_matches(['\r', '\n'])
        .to_string()
}

fn safe_relative_git_path(raw_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(raw_path);
    if path.is_absolute() {
        return Err(format!("Git 文件路径不能是绝对路径: {raw_path}"));
    }

    let mut safe_path = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::Normal(value) => safe_path.push(value),
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir
            | std::path::Component::RootDir
            | std::path::Component::Prefix(_) => {
                return Err(format!("Git 文件路径不安全: {raw_path}"));
            }
        }
    }
    if safe_path.as_os_str().is_empty() {
        return Err("请选择一个文件".to_string());
    }
    Ok(safe_path)
}

fn safe_revision(raw_revision: &str) -> Result<String, String> {
    let revision = raw_revision.trim();
    if revision.is_empty() || revision.starts_with('-') {
        return Err("Git revision 不安全".to_string());
    }
    if !revision
        .chars()
        .all(|value| value.is_ascii_alphanumeric() || matches!(value, '.' | '_' | '-' | '/'))
    {
        return Err(format!("Git revision 不安全: {raw_revision}"));
    }
    Ok(revision.to_string())
}

fn run_git_worktree_diff_command(
    root: &Path,
    format_arg: &str,
    file: Option<&str>,
) -> Result<String, String> {
    let mut args = vec![
        "diff".to_string(),
        "HEAD".to_string(),
        format_arg.to_string(),
        "--".to_string(),
    ];
    if let Some(file) = file {
        args.push(file.to_string());
    }
    run_git_dynamic(root, args)
}

fn run_git_diff_command(
    root: &Path,
    command: &str,
    revision: &str,
    format_arg: &str,
    file: Option<&str>,
) -> Result<String, String> {
    let mut args = vec![
        command.to_string(),
        "--format=".to_string(),
        format_arg.to_string(),
        revision.to_string(),
        "--".to_string(),
    ];
    if let Some(file) = file {
        args.push(file.to_string());
    }
    run_git_dynamic(root, args)
}

fn build_git_diff(numstat: &str, patch: &str) -> GitDiff {
    let stats = parse_numstat(numstat);
    let mut files = parse_patch_files(patch);

    for file in &mut files {
        if let Some((additions, deletions)) = stats.get(&file.path) {
            file.additions = *additions;
            file.deletions = *deletions;
        }
    }

    for (path, (additions, deletions)) in &stats {
        if files.iter().any(|file| &file.path == path) {
            continue;
        }
        files.push(GitDiffFile {
            path: path.clone(),
            additions: *additions,
            deletions: *deletions,
            lines: Vec::new(),
        });
    }

    let additions = files.iter().map(|file| file.additions).sum();
    let deletions = files.iter().map(|file| file.deletions).sum();
    GitDiff {
        files,
        additions,
        deletions,
    }
}

fn parse_numstat(output: &str) -> BTreeMap<String, (i64, i64)> {
    let mut stats = BTreeMap::new();
    for line in output.lines() {
        let parts = line.splitn(3, '\t').collect::<Vec<_>>();
        if parts.len() != 3 {
            continue;
        }
        let additions = parts[0].parse::<i64>().unwrap_or(0);
        let deletions = parts[1].parse::<i64>().unwrap_or(0);
        stats.insert(parts[2].to_string(), (additions, deletions));
    }
    stats
}

fn parse_patch_files(output: &str) -> Vec<GitDiffFile> {
    let mut files = Vec::new();
    let mut current: Option<GitDiffFile> = None;

    for line in output.lines() {
        if line.starts_with("diff --git ") {
            if let Some(file) = current.take() {
                files.push(file);
            }
            current = Some(GitDiffFile {
                path: parse_diff_git_path(line).unwrap_or_else(|| "unknown".to_string()),
                additions: 0,
                deletions: 0,
                lines: Vec::new(),
            });
            continue;
        }

        let Some(file) = current.as_mut() else {
            continue;
        };

        let kind = if line.starts_with("@@") {
            "meta"
        } else if line.starts_with('+') && !line.starts_with("+++") {
            "add"
        } else if line.starts_with('-') && !line.starts_with("---") {
            "del"
        } else {
            "ctx"
        };

        file.lines.push(GitDiffLine {
            kind: kind.to_string(),
            content: line.to_string(),
        });
    }

    if let Some(file) = current {
        files.push(file);
    }
    files
}

fn parse_diff_git_path(line: &str) -> Option<String> {
    line.split_whitespace()
        .nth(3)
        .map(|value| value.strip_prefix("b/").unwrap_or(value).to_string())
}

fn parse_git_log(output: &str) -> Vec<GitCommit> {
    output
        .split(RECORD_SEPARATOR)
        .filter_map(parse_git_log_record)
        .collect()
}

fn parse_git_log_record(record: &str) -> Option<GitCommit> {
    let trimmed = record.trim_start_matches('\n').trim_end();
    if trimmed.is_empty() {
        return None;
    }

    let mut lines = trimmed.lines();
    let header = lines.next()?;
    let fields = header.splitn(5, FIELD_SEPARATOR).collect::<Vec<_>>();
    if fields.len() != 5 {
        return None;
    }

    let mut additions = 0;
    let mut deletions = 0;
    for line in lines {
        let columns = line.split('\t').collect::<Vec<_>>();
        if columns.len() < 3 {
            continue;
        }
        if let Ok(value) = columns[0].parse::<i64>() {
            additions += value;
        }
        if let Ok(value) = columns[1].parse::<i64>() {
            deletions += value;
        }
    }

    Some(GitCommit {
        hash: fields[0].to_string(),
        full_hash: fields[1].to_string(),
        author: fields[2].to_string(),
        date: fields[3].to_string(),
        message: fields[4].to_string(),
        additions,
        deletions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn parses_ahead_behind_counts() {
        assert_eq!(parse_ahead_behind("2 3").expect("counts"), (2, 3));
        assert_eq!(parse_ahead_behind("0\t1\n").expect("counts"), (0, 1));
    }

    #[test]
    fn counts_porcelain_changes() {
        let files = parse_changed_files(" M src/main.rs\n?? new.txt\nR  old.rs -> src/new.rs\n\n");
        assert_eq!(files.len(), 3);
        assert_eq!(
            files[2],
            GitChangedFile {
                path: "src/new.rs".to_string(),
                status: "R".to_string(),
            }
        );
    }

    #[test]
    fn parses_git_log_with_numstat() {
        let output = "\x1eabc123\x1ffullhash\x1fyou\x1f2026-06-06T10:00:00+08:00\x1ffeat: wire git\n12\t3\tsrc/main.rs\n-\t-\tassets/logo.png";
        let commits = parse_git_log(output);

        assert_eq!(commits.len(), 1);
        assert_eq!(
            commits[0],
            GitCommit {
                hash: "abc123".to_string(),
                full_hash: "fullhash".to_string(),
                author: "you".to_string(),
                date: "2026-06-06T10:00:00+08:00".to_string(),
                message: "feat: wire git".to_string(),
                additions: 12,
                deletions: 3,
            }
        );
    }

    #[test]
    fn validates_git_paths_and_revisions() {
        assert!(safe_relative_git_path("src/main.rs").is_ok());
        assert!(safe_relative_git_path("../main.rs").is_err());
        assert!(safe_relative_git_path("/tmp/main.rs").is_err());
        assert!(safe_revision("abc123").is_ok());
        assert!(safe_revision("-bad").is_err());
        assert!(safe_revision("bad revision").is_err());
    }

    #[test]
    fn validates_github_publish_inputs() {
        assert_eq!(
            normalize_github_repo_name("memoir-app").as_deref(),
            Ok("memoir-app")
        );
        assert!(normalize_github_repo_name("bad/name").is_err());
        assert!(normalize_github_repo_name("bad name").is_err());
        assert_eq!(
            authenticated_github_url("https://github.com/me/repo.git", "ghp_a+b")
                .expect("auth url"),
            "https://x-access-token:ghp_a%2Bb@github.com/me/repo.git"
        );
    }

    #[test]
    fn builds_structured_diff() {
        let numstat = "2\t1\tsrc/main.rs\n";
        let patch = "diff --git a/src/main.rs b/src/main.rs\nindex 111..222 100644\n--- a/src/main.rs\n+++ b/src/main.rs\n@@ -1,2 +1,3 @@\n fn main() {\n-  old();\n+  new();\n+  more();\n }\n";
        let diff = build_git_diff(numstat, patch);

        assert_eq!(diff.additions, 2);
        assert_eq!(diff.deletions, 1);
        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "src/main.rs");
        assert!(diff.files[0].lines.iter().any(|line| line.kind == "add"));
        assert!(diff.files[0].lines.iter().any(|line| line.kind == "del"));
    }

    #[test]
    fn reads_status_and_log_from_real_git_repo() {
        let root = std::env::temp_dir().join(format!("memoir-git-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).expect("create temp repo");

        run_test_git(&root, &["init"]);
        run_test_git(&root, &["config", "user.email", "memoir@example.local"]);
        run_test_git(&root, &["config", "user.name", "Memoir Test"]);
        fs::write(root.join("README.md"), "hello\n").expect("write readme");
        run_test_git(&root, &["add", "README.md"]);
        run_test_git(&root, &["commit", "-m", "initial commit"]);
        fs::write(root.join("dirty.txt"), "dirty\n").expect("write dirty file");

        assert!(is_git_repository(&root).expect("is git repo"));
        assert!(!current_branch(&root).expect("branch").is_empty());
        let status_output = run_git(&root, &["status", "--porcelain=v1"]).expect("status");
        assert_eq!(parse_changed_files(&status_output).len(), 1);

        let raw_log = run_git(
            &root,
            &[
                "log",
                "-n",
                "1",
                "--numstat",
                "--pretty=format:%x1e%h%x1f%H%x1f%an%x1f%aI%x1f%s",
            ],
        )
        .expect("git log");
        let commits = parse_git_log(&raw_log);
        assert_eq!(commits.len(), 1);
        assert_eq!(commits[0].message, "initial commit");
        assert_eq!(commits[0].author, "Memoir Test");
        assert_eq!(commits[0].additions, 1);

        run_git_dynamic(
            &root,
            vec!["add".to_string(), "--".to_string(), "dirty.txt".to_string()],
        )
        .expect("git add dirty");
        run_git_dynamic(
            &root,
            vec![
                "commit".to_string(),
                "-m".to_string(),
                "add dirty file".to_string(),
            ],
        )
        .expect("git commit dirty");
        let diff = build_git_diff(
            &run_git(
                &root,
                &["show", "--format=", "--numstat", "HEAD", "--", "dirty.txt"],
            )
            .expect("numstat"),
            &run_git(
                &root,
                &["show", "--format=", "--patch", "HEAD", "--", "dirty.txt"],
            )
            .expect("patch"),
        );
        assert_eq!(diff.files.len(), 1);
        assert_eq!(diff.files[0].path, "dirty.txt");

        let _ = fs::remove_dir_all(&root);
    }

    fn run_test_git(root: &Path, args: &[&str]) {
        let output = Command::new("git")
            .args(args)
            .current_dir(root)
            .output()
            .expect("run git command");
        assert!(
            output.status.success(),
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        );
    }
}
