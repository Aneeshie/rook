use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

use crate::pty::PtySession;
use portable_pty::PtySize;
use tauri::{
    Emitter,
    ipc::{Channel, InvokeResponseBody},
};

type SharedSession = Arc<Mutex<PtySession>>;

pub struct SessionManager {
    sessions: HashMap<String, SharedSession>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn create_session(
        &mut self,
        app: tauri::AppHandle,
        rows: u16,
        cols: u16,
        cwd: Option<String>,
        on_output: Channel<InvokeResponseBody>,
    ) -> anyhow::Result<String> {
        let id = uuid::Uuid::new_v4().to_string();

        let size = PtySize {
            rows,
            cols,
            pixel_height: 0,
            pixel_width: 0,
        };

        let (pty_session, output_rx) = PtySession::new(size, cwd)?;

        self.sessions
            .insert(id.clone(), Arc::new(Mutex::new(pty_session)));

        let app = app.clone();
        let terminal_id = id.clone();

        std::thread::spawn(move || {
            while let Ok(mut bytes) = output_rx.recv() {
                //under load, more chunks are already queued: send them as one message

                // try_recv never waits, so typing no extra latency
                while bytes.len() < 256 * 1024 {
                    match output_rx.try_recv() {
                        Ok(more) => bytes.extend_from_slice(&more),
                        Err(_) => break,
                    }
                }

                // raw bytes reach JS as an arraybuffer with no json in between

                if let Err(error) = on_output.send(InvokeResponseBody::Raw(bytes)) {
                    eprintln!("Failed to send terminal output: {error}");
                    break;
                }
            }

            let _ = app.emit(
                "terminal-exit",
                serde_json::json!({ "terminal_id": terminal_id }),
            );
        });

        Ok(id)
    }

    pub fn get_session(&self, id: &str) -> anyhow::Result<Arc<Mutex<PtySession>>> {
        let session = self
            .sessions
            .get(id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {id}"))?;

        Ok(Arc::clone(session))
    }

    pub fn remove_session(&mut self, id: &str) -> anyhow::Result<Arc<Mutex<PtySession>>> {
        let session = self
            .sessions
            .remove(id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {id}"))?;

        Ok(session)
    }
}
