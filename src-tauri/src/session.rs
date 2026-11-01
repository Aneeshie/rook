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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::channel;
    use std::time::{Duration, Instant};

    #[test]
    fn appends_chunks_that_are_already_queued() {
        let (tx, rx) = channel();
        tx.send(b"b".to_vec()).unwrap();
        tx.send(b"c".to_vec()).unwrap();

        assert_eq!(take_queued(b"a".to_vec(), &rx), b"abc");
        assert!(rx.try_recv().is_err(), "everything queued was taken");
    }

    #[test]
    fn returns_at_once_when_nothing_is_queued() {
        let (_tx, rx) = channel::<Vec<u8>>();
        let start = Instant::now();

        assert_eq!(take_queued(b"a".to_vec(), &rx), b"a");
        assert!(start.elapsed() < Duration::from_millis(50), "must never wait for more output");
    }

    #[test]
    fn stops_at_the_message_size_cap() {
        let (tx, rx) = channel();
        for _ in 0..4 {
            tx.send(vec![0u8; MAX_MESSAGE / 2]).unwrap();
        }

        let first = take_queued(Vec::new(), &rx);
        assert_eq!(first.len(), MAX_MESSAGE);

        let rest = take_queued(rx.recv().unwrap(), &rx);
        assert_eq!(rest.len(), MAX_MESSAGE, "the leftovers come out in the next message");
    }

    #[test]
    fn keeps_what_it_has_when_the_reader_is_gone() {
        let (tx, rx) = channel();
        tx.send(b"b".to_vec()).unwrap();
        drop(tx);

        assert_eq!(take_queued(b"a".to_vec(), &rx), b"ab");
    }
}
