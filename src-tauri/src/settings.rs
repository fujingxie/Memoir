use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::{collections::BTreeMap, fs, path::PathBuf, process::Command};
use tauri::{AppHandle, Runtime};

const SCAN_ROOTS_KEY: &str = "scan_roots";
const EDITOR_CMD_KEY: &str = "editor_cmd";
const CATEGORY_EDITORS_KEY: &str = "category_editors";
const THEME_KEY: &str = "theme";
const DEFAULT_EDITOR_CMD: &str = "code";
const DEFAULT_THEME: &str = "dark";

#[derive(Debug, Serialize, PartialEq, Eq)]
pub struct AppSettings {
    scan_roots: Vec<String>,
    editor_cmd: String,
    category_editors: BTreeMap<String, String>,
    theme: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct EditorPreset {
    key: &'static str,
    cli: &'static str,
    mac_apps: &'static [&'static str],
}

#[tauri::command]
pub async fn get_app_settings<R: Runtime>(app: AppHandle<R>) -> Result<AppSettings, String> {
    let pool = crate::projects::database_pool(&app).await?;
    load_app_settings(&pool).await
}

#[tauri::command]
pub async fn add_scan_root<R: Runtime>(
    app: AppHandle<R>,
    root: String,
) -> Result<AppSettings, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let normalized = normalize_existing_dir(&root)?;
    let settings = load_app_settings(&pool).await?;
    let roots = merge_scan_root(settings.scan_roots, normalized);
    save_setting(
        &pool,
        SCAN_ROOTS_KEY,
        &serde_json::to_string(&roots)
            .map_err(|error| format!("无法序列化扫描目录配置: {error}"))?,
    )
    .await?;
    load_app_settings(&pool).await
}

#[tauri::command]
pub async fn remove_scan_root<R: Runtime>(
    app: AppHandle<R>,
    root: String,
) -> Result<AppSettings, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let settings = load_app_settings(&pool).await?;
    let roots = remove_scan_root_value(settings.scan_roots, &root);
    save_setting(
        &pool,
        SCAN_ROOTS_KEY,
        &serde_json::to_string(&roots)
            .map_err(|error| format!("无法序列化扫描目录配置: {error}"))?,
    )
    .await?;
    load_app_settings(&pool).await
}

#[tauri::command]
pub async fn set_editor_cmd<R: Runtime>(
    app: AppHandle<R>,
    editor_cmd: String,
) -> Result<AppSettings, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let editor_cmd = normalize_editor_cmd(&editor_cmd)?;
    save_setting(&pool, EDITOR_CMD_KEY, &editor_cmd).await?;
    load_app_settings(&pool).await
}

#[tauri::command]
pub async fn set_category_editor<R: Runtime>(
    app: AppHandle<R>,
    category: String,
    editor_key: String,
) -> Result<AppSettings, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let category = normalize_category(&category)?;
    let mut category_editors =
        parse_category_editors(read_setting(&pool, CATEGORY_EDITORS_KEY).await?.as_deref())?;

    if editor_key.trim().is_empty() || editor_key.trim() == "inherit" {
        category_editors.remove(&category);
    } else {
        let editor_key = normalize_editor_cmd(&editor_key)?;
        category_editors.insert(category, editor_key);
    }

    save_setting(
        &pool,
        CATEGORY_EDITORS_KEY,
        &serde_json::to_string(&category_editors)
            .map_err(|error| format!("无法序列化分类编辑器设置: {error}"))?,
    )
    .await?;
    load_app_settings(&pool).await
}

#[tauri::command]
pub async fn set_theme_setting<R: Runtime>(
    app: AppHandle<R>,
    theme: String,
) -> Result<AppSettings, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let theme = normalize_theme(&theme)?;
    save_setting(&pool, THEME_KEY, &theme).await?;
    load_app_settings(&pool).await
}

#[tauri::command]
pub async fn open_project_dir<R: Runtime>(app: AppHandle<R>, id: i64) -> Result<String, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let path = crate::projects::get_project_path_by_id(&pool, id).await?;
    let dir = normalize_existing_dir(&path)?;
    open_target(&dir.to_string_lossy())?;
    Ok(format!("已打开 {}", dir.display()))
}

#[tauri::command]
pub async fn open_project_editor<R: Runtime>(app: AppHandle<R>, id: i64) -> Result<String, String> {
    let pool = crate::projects::database_pool(&app).await?;
    let settings = load_app_settings(&pool).await?;
    let (path, category) = crate::projects::get_project_path_and_category_by_id(&pool, id).await?;
    let editor_key = resolve_editor_key(&settings, &category);
    let preset =
        editor_preset(&editor_key).ok_or_else(|| format!("无法识别编辑器配置: {editor_key}"))?;
    let dir = normalize_existing_dir(&path)?;
    launch_editor(preset, &dir)
        .map_err(|error| format!("无法用 {editor_key} 打开 {}: {error}", dir.display()))?;
    Ok(format!("已用 {} 打开 {}", preset.key, dir.display()))
}

#[tauri::command]
pub fn pick_directory(initial_path: String) -> Result<Option<String>, String> {
    pick_directory_platform(&initial_path)
}

#[tauri::command]
pub fn pick_file(initial_path: String) -> Result<Option<String>, String> {
    pick_file_platform(&initial_path)
}

async fn load_app_settings(pool: &SqlitePool) -> Result<AppSettings, String> {
    let scan_roots = parse_scan_roots(read_setting(pool, SCAN_ROOTS_KEY).await?.as_deref())?;
    let editor_cmd = read_setting(pool, EDITOR_CMD_KEY)
        .await?
        .and_then(|value| normalize_editor_cmd(&value).ok())
        .unwrap_or_else(|| DEFAULT_EDITOR_CMD.to_string());
    let category_editors =
        parse_category_editors(read_setting(pool, CATEGORY_EDITORS_KEY).await?.as_deref())?;
    let theme = read_setting(pool, THEME_KEY)
        .await?
        .and_then(|value| normalize_theme(&value).ok())
        .unwrap_or_else(|| DEFAULT_THEME.to_string());
    Ok(AppSettings {
        scan_roots,
        editor_cmd,
        category_editors,
        theme,
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

fn parse_scan_roots(value: Option<&str>) -> Result<Vec<String>, String> {
    let Some(value) = value.filter(|item| !item.trim().is_empty()) else {
        return Ok(Vec::new());
    };
    serde_json::from_str::<Vec<String>>(value)
        .map_err(|error| format!("无法解析扫描目录配置: {error}"))
}

fn merge_scan_root(mut roots: Vec<String>, root: PathBuf) -> Vec<String> {
    let normalized = root.to_string_lossy().to_string();
    if !roots.iter().any(|item| item == &normalized) {
        roots.push(normalized);
    }
    roots
}

fn remove_scan_root_value(roots: Vec<String>, root: &str) -> Vec<String> {
    roots.into_iter().filter(|item| item != root).collect()
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

fn normalize_editor_cmd(value: &str) -> Result<String, String> {
    let value = value.trim();
    if editor_preset(value).is_some() {
        return Ok(value.to_string());
    }
    Err(format!("不支持的编辑器: {value}"))
}

fn normalize_category(category: &str) -> Result<String, String> {
    let category = category.trim();
    if crate::projects::valid_categories().contains(&category) {
        return Ok(category.to_string());
    }
    Err(format!("不支持的项目分类: {category}"))
}

fn parse_category_editors(value: Option<&str>) -> Result<BTreeMap<String, String>, String> {
    let Some(value) = value.filter(|item| !item.trim().is_empty()) else {
        return Ok(BTreeMap::new());
    };
    let raw = serde_json::from_str::<BTreeMap<String, String>>(value)
        .map_err(|error| format!("无法解析分类编辑器设置: {error}"))?;
    let mut normalized = BTreeMap::new();
    for (category, editor_key) in raw {
        let category = normalize_category(&category)?;
        let editor_key = normalize_editor_cmd(&editor_key)?;
        normalized.insert(category, editor_key);
    }
    Ok(normalized)
}

fn resolve_editor_key(settings: &AppSettings, category: &str) -> String {
    settings
        .category_editors
        .get(category)
        .cloned()
        .unwrap_or_else(|| settings.editor_cmd.clone())
}

fn editor_preset(key: &str) -> Option<EditorPreset> {
    editor_presets()
        .iter()
        .copied()
        .find(|preset| preset.key == key)
}

fn editor_presets() -> &'static [EditorPreset] {
    &[
        EditorPreset {
            key: "code",
            cli: "code",
            mac_apps: &["Visual Studio Code"],
        },
        EditorPreset {
            key: "cursor",
            cli: "cursor",
            mac_apps: &["Cursor"],
        },
        EditorPreset {
            key: "webstorm",
            cli: "webstorm",
            mac_apps: &["WebStorm"],
        },
        EditorPreset {
            key: "zed",
            cli: "zed",
            mac_apps: &["Zed"],
        },
        EditorPreset {
            key: "android_studio",
            cli: "studio",
            mac_apps: &["Android Studio"],
        },
        EditorPreset {
            key: "xcode",
            cli: "xed",
            mac_apps: &["Xcode"],
        },
        EditorPreset {
            key: "wechat_devtools",
            cli: "wechatwebdevtools",
            mac_apps: &["微信开发者工具", "WeChat DevTools"],
        },
    ]
}

fn normalize_theme(value: &str) -> Result<String, String> {
    match value.trim() {
        "dark" => Ok("dark".to_string()),
        "light" => Ok("light".to_string()),
        other => Err(format!("不支持的主题: {other}")),
    }
}

fn open_target(target: &str) -> Result<(), String> {
    let mut command = open_command(target);
    command
        .spawn()
        .map_err(|error| format!("无法打开 {target}: {error}"))?;
    Ok(())
}

fn launch_editor(preset: EditorPreset, dir: &PathBuf) -> Result<(), String> {
    let mut errors = Vec::new();

    for command in editor_launch_commands(preset, dir) {
        match run_editor_launch_command(&command) {
            Ok(()) => return Ok(()),
            Err(error) => errors.push(error),
        }
    }

    Err(errors.join("; "))
}

#[derive(Debug, PartialEq, Eq)]
struct EditorLaunchCommand {
    program: String,
    args: Vec<String>,
    wait_for_status: bool,
}

fn editor_launch_commands(preset: EditorPreset, dir: &PathBuf) -> Vec<EditorLaunchCommand> {
    let mut commands = Vec::new();
    #[cfg(target_os = "macos")]
    {
        for app in preset.mac_apps {
            commands.push(EditorLaunchCommand {
                program: "open".to_string(),
                args: vec![
                    "-a".to_string(),
                    (*app).to_string(),
                    dir.to_string_lossy().to_string(),
                ],
                wait_for_status: true,
            });
        }
    }
    commands.push(EditorLaunchCommand {
        program: preset.cli.to_string(),
        args: vec![dir.to_string_lossy().to_string()],
        wait_for_status: false,
    });
    commands
}

fn run_editor_launch_command(command: &EditorLaunchCommand) -> Result<(), String> {
    let mut process = Command::new(&command.program);
    process.args(&command.args);
    if command.wait_for_status {
        let output = process
            .output()
            .map_err(|error| format!("{} {:?}: {error}", command.program, command.args))?;
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(format!(
            "{} {:?} 失败: {}",
            command.program, command.args, stderr
        ));
    }
    process
        .spawn()
        .map_err(|error| format!("{} {:?}: {error}", command.program, command.args))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn pick_directory_platform(initial_path: &str) -> Result<Option<String>, String> {
    let default_path = pick_directory_default_path(initial_path);
    let script = format!(
        "try\n\
         set chosenFolder to choose folder default location POSIX file \"{}\"\n\
         return POSIX path of chosenFolder\n\
         on error errorMessage number errorNumber\n\
         if errorNumber is -128 then return \"__MEMOIR_CANCELLED__\"\n\
         error errorMessage number errorNumber\n\
         end try",
        escape_applescript_string(&default_path.to_string_lossy())
    );
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|error| format!("无法打开目录选择器: {error}"))?;
    parse_directory_picker_output(output.status.success(), &output.stdout, &output.stderr)
}

#[cfg(target_os = "macos")]
fn pick_file_platform(initial_path: &str) -> Result<Option<String>, String> {
    let default_path = pick_directory_default_path(initial_path);
    let script = format!(
        "try\n\
         set chosenFile to choose file default location POSIX file \"{}\"\n\
         return POSIX path of chosenFile\n\
         on error errorMessage number errorNumber\n\
         if errorNumber is -128 then return \"__MEMOIR_CANCELLED__\"\n\
         error errorMessage number errorNumber\n\
         end try",
        escape_applescript_string(&default_path.to_string_lossy())
    );
    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|error| format!("无法打开文件选择器: {error}"))?;
    parse_picker_output(
        "文件选择失败",
        output.status.success(),
        &output.stdout,
        &output.stderr,
    )
}

#[cfg(target_os = "windows")]
fn pick_directory_platform(initial_path: &str) -> Result<Option<String>, String> {
    let default_path = pick_directory_default_path(initial_path);
    let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "选择扫描根目录"
$dialog.ShowNewFolderButton = $true
if ($args.Count -gt 0 -and $args[0]) {
  $dialog.SelectedPath = $args[0]
}
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath
}
"#;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(script)
        .arg(default_path)
        .output()
        .map_err(|error| format!("无法打开目录选择器: {error}"))?;
    parse_directory_picker_output(output.status.success(), &output.stdout, &output.stderr)
}

#[cfg(target_os = "windows")]
fn pick_file_platform(initial_path: &str) -> Result<Option<String>, String> {
    let default_path = pick_directory_default_path(initial_path);
    let script = r#"
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = "选择本地资料文件"
$dialog.CheckFileExists = $true
if ($args.Count -gt 0 -and $args[0]) {
  $dialog.InitialDirectory = $args[0]
}
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.FileName
}
"#;
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-Command")
        .arg(script)
        .arg(default_path)
        .output()
        .map_err(|error| format!("无法打开文件选择器: {error}"))?;
    parse_picker_output(
        "文件选择失败",
        output.status.success(),
        &output.stdout,
        &output.stderr,
    )
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn pick_directory_platform(initial_path: &str) -> Result<Option<String>, String> {
    let default_path = pick_directory_default_path(initial_path);
    let output = Command::new("zenity")
        .arg("--file-selection")
        .arg("--directory")
        .arg("--title=选择扫描根目录")
        .arg(format!("--filename={}/", default_path.display()))
        .output()
        .map_err(|error| format!("无法打开目录选择器: {error}"))?;
    parse_directory_picker_output(output.status.success(), &output.stdout, &output.stderr)
}

#[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
fn pick_file_platform(initial_path: &str) -> Result<Option<String>, String> {
    let default_path = pick_directory_default_path(initial_path);
    let output = Command::new("zenity")
        .arg("--file-selection")
        .arg("--title=选择本地资料文件")
        .arg(format!("--filename={}/", default_path.display()))
        .output()
        .map_err(|error| format!("无法打开文件选择器: {error}"))?;
    parse_picker_output(
        "文件选择失败",
        output.status.success(),
        &output.stdout,
        &output.stderr,
    )
}

fn pick_directory_default_path(initial_path: &str) -> PathBuf {
    let expanded = expand_home(initial_path);
    if expanded.is_dir() {
        return expanded;
    }
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn parse_directory_picker_output(
    success: bool,
    stdout: &[u8],
    stderr: &[u8],
) -> Result<Option<String>, String> {
    parse_picker_output("目录选择失败", success, stdout, stderr)
}

fn parse_picker_output(
    failure_label: &str,
    success: bool,
    stdout: &[u8],
    stderr: &[u8],
) -> Result<Option<String>, String> {
    let selected = String::from_utf8_lossy(stdout).trim().to_string();
    if success {
        if selected.is_empty() || selected == "__MEMOIR_CANCELLED__" {
            return Ok(None);
        }
        return Ok(Some(selected));
    }

    let detail = String::from_utf8_lossy(stderr).trim().to_string();
    if detail.contains("-128") || detail.contains("User canceled") {
        return Ok(None);
    }
    Err(format!("{failure_label}: {detail}"))
}

fn escape_applescript_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[cfg(target_os = "macos")]
fn open_command(target: &str) -> Command {
    let mut command = Command::new("open");
    command.arg(target);
    command
}

#[cfg(target_os = "windows")]
fn open_command(target: &str) -> Command {
    let mut command = Command::new("explorer");
    command.arg(target);
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
    fn parses_and_updates_scan_roots() {
        let roots = parse_scan_roots(Some(r#"["/tmp/a"]"#)).expect("parse roots");
        let roots = merge_scan_root(roots, PathBuf::from("/tmp/b"));
        let roots = merge_scan_root(roots, PathBuf::from("/tmp/b"));
        assert_eq!(roots, vec!["/tmp/a", "/tmp/b"]);
        assert_eq!(remove_scan_root_value(roots, "/tmp/a"), vec!["/tmp/b"]);
    }

    #[test]
    fn validates_editor_and_theme_values() {
        assert_eq!(normalize_editor_cmd("code").as_deref(), Ok("code"));
        assert_eq!(
            normalize_editor_cmd("android_studio").as_deref(),
            Ok("android_studio")
        );
        assert!(normalize_editor_cmd("rm -rf").is_err());
        assert_eq!(normalize_theme("light").as_deref(), Ok("light"));
        assert!(normalize_theme("sepia").is_err());
    }

    #[test]
    fn parses_directory_picker_result() {
        assert_eq!(
            parse_directory_picker_output(true, b"/tmp/project\n", b"").expect("selected"),
            Some("/tmp/project".to_string())
        );
        assert_eq!(
            parse_directory_picker_output(true, b"__MEMOIR_CANCELLED__\n", b"").expect("cancelled"),
            None
        );
        assert_eq!(
            escape_applescript_string(r#"/tmp/a"b\c"#),
            r#"/tmp/a\"b\\c"#
        );
    }

    #[test]
    fn parses_category_editors_and_resolves_project_editor() {
        let editors = parse_category_editors(Some(
            r#"{"android":"android_studio","ios":"xcode","web":"cursor"}"#,
        ))
        .expect("parse category editors");
        assert_eq!(
            editors.get("android").map(String::as_str),
            Some("android_studio")
        );
        assert!(parse_category_editors(Some(r#"{"android":"rm -rf"}"#)).is_err());
        assert!(parse_category_editors(Some(r#"{"unknown":"code"}"#)).is_err());

        let settings = AppSettings {
            scan_roots: Vec::new(),
            editor_cmd: "code".to_string(),
            category_editors: editors,
            theme: "dark".to_string(),
        };

        assert_eq!(resolve_editor_key(&settings, "android"), "android_studio");
        assert_eq!(resolve_editor_key(&settings, "backend"), "code");
    }

    #[test]
    fn builds_editor_launch_commands_without_shell_strings() {
        let preset = editor_preset("code").expect("code preset");
        let dir = PathBuf::from("/tmp/memoir project");
        let commands = editor_launch_commands(preset, &dir);

        #[cfg(target_os = "macos")]
        {
            assert_eq!(commands[0].program, "open");
            assert_eq!(
                commands[0].args,
                vec!["-a", "Visual Studio Code", "/tmp/memoir project"]
            );
            assert!(commands[0].wait_for_status);
        }

        let fallback = commands.last().expect("fallback command");
        assert_eq!(fallback.program, "code");
        assert_eq!(fallback.args, vec!["/tmp/memoir project"]);
        assert!(!fallback.wait_for_status);
    }
}
