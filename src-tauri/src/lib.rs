mod ai;
mod archive;
mod chats;
mod db;
mod docs;
mod file_tree;
mod git;
mod projects;
mod secrets;
mod settings;

#[tauri::command]
fn get_memoir_status() -> Result<String, String> {
    Ok("Rust 命令已连接".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_memoir_status,
            projects::scan_projects,
            projects::add_project,
            projects::list_projects,
            projects::get_project,
            projects::set_project_category,
            file_tree::get_file_tree,
            file_tree::read_project_file,
            git::git_status,
            git::git_log,
            git::git_init,
            git::git_set_remote,
            git::git_publish_to_github,
            git::git_commit,
            git::git_push,
            git::git_pull,
            git::git_diff,
            archive::read_archive,
            archive::save_archive,
            ai::get_deepseek_key_status,
            ai::save_deepseek_api_key,
            ai::generate_archive_ai,
            secrets::get_github_token_status,
            secrets::save_github_token,
            docs::list_documents,
            docs::add_document,
            docs::delete_document,
            docs::open_document,
            chats::list_chat_links,
            chats::add_chat_link,
            chats::delete_chat_link,
            chats::open_chat_link,
            chats::read_chat_link_detail,
            chats::import_chat_export,
            chats::scan_local_chat_exports,
            settings::get_app_settings,
            settings::add_scan_root,
            settings::remove_scan_root,
            settings::set_editor_cmd,
            settings::set_category_editor,
            settings::set_theme_setting,
            settings::pick_file,
            settings::pick_directory,
            settings::open_project_dir,
            settings::open_project_editor
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Memoir");
}
