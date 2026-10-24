use std::collections::HashMap;

use tauri::Emitter;

use crate::pty::PtySession;

pub struct SessionManager {
    sessions: HashMap<String, PtySession>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn create_session(&mut self, app: tauri::AppHandle) -> anyhow::Result<String> {
        let id = uuid::Uuid::new_v4().to_string();

        let (pty_session, output_rx) = PtySession::new()?;

        self.sessions.insert(id.clone(), pty_session);

        let app = app.clone();
        let terminal_id = id.clone();

        std::thread::spawn(move || {
            while let Ok(bytes) = output_rx.recv() {
                //emit these to react...
                let payload = serde_json::json!({
                    "terminal_id": terminal_id,
                    "data": bytes,
                });

                if let Err(error) = app.emit("terminal_output", payload) {
                    eprintln!("Failed to emit terminal output: {error}");
                    break;
                }
            }
        });

        Ok(id)
    }

    pub fn write_to_session(&mut self, id: &str, input: &[u8]) -> anyhow::Result<()> {
        let fetched_session = self
            .sessions
            .get_mut(id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {id}"))?;

        fetched_session.write_input(input)?;

        Ok(())
    }
}
