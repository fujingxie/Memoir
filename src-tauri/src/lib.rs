#[tauri::command]
fn get_memoir_status() -> Result<String, String> {
    Ok("Rust 命令已连接".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_memoir_status])
        .run(tauri::generate_context!())
        .expect("failed to run Memoir");
}
