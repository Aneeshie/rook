use crate::session::SessionManager;
use std::sync::Mutex;
mod pty;
mod session;

#[tauri::command]
fn create_session(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<SessionManager>>,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|e| e.to_string())?;

    manager.create_session(app).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_to_session(
    state: tauri::State<'_, Mutex<SessionManager>>,
    id: String,
    input: String,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|e| e.to_string())?;

    manager
        .write_to_session(&id, input.as_bytes())
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(SessionManager::new()))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![create_session, write_to_session])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
