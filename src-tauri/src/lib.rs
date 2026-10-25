use crate::session::SessionManager;
use std::sync::Mutex;
mod pty;
mod session;

#[tauri::command]
fn resize_session(
    state: tauri::State<'_, Mutex<SessionManager>>,
    id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let session = {
        let manager = state.lock().map_err(|e| e.to_string())?;
        manager.get_session(&id).map_err(|e| e.to_string())?
    }; // manager lock released

    let session = session.lock().map_err(|e| e.to_string())?;

    session.resize(rows, cols).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_session(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<SessionManager>>,
    rows: u16,
    cols: u16,
) -> Result<String, String> {
    let mut manager = state.lock().map_err(|e| e.to_string())?;

    manager
        .create_session(app, rows, cols)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn write_to_session(
    state: tauri::State<'_, Mutex<SessionManager>>,
    id: String,
    input: String,
) -> Result<(), String> {
    let session = {
        let manager = state.lock().map_err(|e| e.to_string())?;
        manager.get_session(&id).map_err(|e| e.to_string())?
    }; // manager lock is released here.

    let mut session = session.lock().map_err(|e| e.to_string())?;

    session
        .write_input(input.as_bytes())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_session(
    state: tauri::State<'_, Mutex<SessionManager>>,
    id: String,
) -> Result<(), String> {
    let session = {
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        manager.remove_session(&id).map_err(|e| e.to_string())?
    };

    let mut session = session.lock().map_err(|e| e.to_string())?;

    session.close().map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(SessionManager::new()))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            create_session,
            write_to_session,
            resize_session,
            remove_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
