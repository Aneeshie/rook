use std::io::Result;
use std::path::PathBuf;
use std::sync::mpsc::Receiver;
use std::{
    io::{Read, Write},
    sync::mpsc::channel,
};

use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};

const ZSHENV: &str = include_str!("../shell/zshenv");
const ZSHRC: &str = include_str!("../shell/zshrc");

fn shell_integration_dir() -> anyhow::Result<PathBuf> {
    let dir = std::env::temp_dir().join("nara-shell-integration");
    std::fs::create_dir_all(&dir)?;
    std::fs::write(dir.join(".zshenv"), ZSHENV)?;
    std::fs::write(dir.join(".zshrc"), ZSHRC)?;
    Ok(dir)
}

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    reader_thread: Option<std::thread::JoinHandle<()>>,
}

impl PtySession {
    pub fn new(size: PtySize) -> anyhow::Result<(Self, Receiver<Vec<u8>>)> {
        //use the native pty implementation for the system
        let pty_system = native_pty_system();

        //create a new pty
        let pair = pty_system.openpty(size)?;

        let user_zdotdir = std::env::var("ZDOTDIR")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_default();

        let mut cmd = CommandBuilder::new("zsh");

        cmd.env("NARA_USER_ZDOTDIR", user_zdotdir);
        cmd.env("ZDOTDIR", shell_integration_dir()?);

        let child = pair.slave.spawn_command(cmd)?;

        drop(pair.slave); // make sure we don't hold the slave open ourselves

        let mut reader = pair.master.try_clone_reader()?;

        let (tx, rx) = channel();
        let reader_thread = std::thread::spawn(move || {
            let mut buffer = [0u8; 1024];

            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(n) => {
                        let bytes = buffer[..n].to_vec();
                        if tx.send(bytes).is_err() {
                            break;
                        }
                    }
                    Err(error) => {
                        eprintln!("PTY read error: {error}");
                        break;
                    }
                }
            }
        });

        let writer = pair.master.take_writer()?;

        let session = Self {
            master: pair.master,
            writer,
            child,
            reader_thread: Some(reader_thread),
        };

        Ok((session, rx))
    }

    pub fn write_input(&mut self, input: &[u8]) -> Result<()> {
        self.writer.write_all(input)?;
        self.writer.flush()?;
        Ok(())
    }

    pub fn resize(&self, rows: u16, cols: u16) -> anyhow::Result<()> {
        self.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        Ok(())
    }

    pub fn close(&mut self) -> anyhow::Result<()> {
        // terminate and reap the child process; ignore errors if it already exited
        let _ = self.child.kill();
        let _ = self.child.wait();

        // Only join if the reader has already seen EOF. A background process
        // still holding the slave fd would otherwise block join() forever.
        if let Some(handle) = self.reader_thread.take() {
            let deadline = std::time::Instant::now() + std::time::Duration::from_millis(100);
            while !handle.is_finished() && std::time::Instant::now() < deadline {
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
            if handle.is_finished() {
                handle
                    .join()
                    .map_err(|_| anyhow::anyhow!("PTY reader thread panicked"))?;
            }
            // otherwise the handle is dropped, detaching the thread; it exits
            // once the PTY closes or the receiver is dropped.
        }
        Ok(())
    }
}
