#[tauri::command]
pub fn my_command() -> String {
    format!("invoked in typescript")
}
