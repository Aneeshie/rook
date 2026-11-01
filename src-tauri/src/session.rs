use std::{
    collections::HashMap,
    sync::{Arc, Mutex, mpsc::Receiver},
};

use crate::pty::PtySession;
use portable_pty::PtySize;
use tauri::{
    Emitter,
    ipc::{Channel, InvokeResponseBody},
};

type SharedSession = Arc<Mutex<PtySession>>;

const MAX_MESSAGE: usize = 256 * 1024;

// try_recv never waits, so typing gets no extra latency
fn take_queued(mut bytes: Vec<u8>, rx: &Receiver<Vec<u8>>) -> Vec<u8> {
    while bytes.len() < MAX_MESSAGE {
        match rx.try_recv() {
            Ok(more) => bytes.extend_from_slice(&more),
            Err(_) => break,
        }
    }
    bytes
}

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
            while let Ok(bytes) = output_rx.recv() {
                let bytes = take_queued(bytes, &output_rx);

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
