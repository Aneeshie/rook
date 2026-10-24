use std::{any, collections::HashMap};

use crate::pty::{self, PtySession};

pub struct SessionManager {
    sessions: HashMap<String, PtySession>,
}

impl SessionManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn create_session(&mut self) -> anyhow::Result<String> {
        let id = uuid::Uuid::new_v4().to_string();

        let pty_session = PtySession::new()?;

        self.sessions.insert(id.clone(), pty_session);

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

    pub fn read_from_session(&self, id: &str) -> anyhow::Result<Vec<u8>> {
        let fetched_session = self
            .sessions
            .get(id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {id}"))?;

        fetched_session
            .read_output()
            .ok_or_else(|| anyhow::anyhow!("Output channel closed."))
    }
}
