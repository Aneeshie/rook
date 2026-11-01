use std::io::Result;
use std::path::PathBuf;
use std::sync::mpsc::Receiver;
use std::{
    io::{Read, Write},
    sync::mpsc::channel,
};

use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};

const ZSHENV: &str = include_str!("../shell/zshenv");
const ZSHPROFILE: &str = include_str!("../shell/zprofile");
const ZSHRC: &str = include_str!("../shell/zshrc");

fn shell_integration_dir() -> anyhow::Result<PathBuf> {
    let dir = std::env::temp_dir().join("nara-shell-integration");
    std::fs::create_dir_all(&dir)?;
    std::fs::write(dir.join(".zshenv"), ZSHENV)?;
    std::fs::write(dir.join(".zprofile"), ZSHPROFILE)?;
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
    pub fn new(size: PtySize, cwd: Option<String>) -> anyhow::Result<(Self, Receiver<Vec<u8>>)> {
        //use the native pty implementation for the system
        let pty_system = native_pty_system();

        //create a new pty
        let pair = pty_system.openpty(size)?;

        let user_zdotdir = std::env::var("ZDOTDIR")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_default();

        let mut cmd = CommandBuilder::new("zsh");

        // a login shell, like Terminal and iTerm start: it reads /etc/zprofile (which sets up
        // PATH with path_helper) and the user's .zprofile (often where Homebrew's PATH lives)
        cmd.arg("-l");

        // an app opened from Finder or the Dock inherits almost no environment, so describe
        // the terminal ourselves; without these zsh can't measure the prompt and redraws
        // what you type in the wrong place
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.env("TERM_PROGRAM", "Rook");
        if std::env::var_os("LANG").is_none() {
            cmd.env("LANG", "en_US.UTF-8");
        }

        cmd.env("NARA_USER_ZDOTDIR", user_zdotdir);
        cmd.env("ZDOTDIR", shell_integration_dir()?);

        // start in the folder the frontend asked for, if it still exists; otherwise zsh starts at home
        if let Some(dir) = cwd {
            if std::path::Path::new(&dir).is_dir() {
                cmd.cwd(dir);
            }
        }

        let child = pair.slave.spawn_command(cmd)?;

        drop(pair.slave); // make sure we don't hold the slave open ourselves

        let mut reader = pair.master.try_clone_reader()?;

        let (tx, rx) = channel();
        let reader_thread = std::thread::spawn(move || {
            let mut buffer = [0u8; 64 * 1024];

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    const SIZE: PtySize = PtySize {
        rows: 24,
        cols: 80,
        pixel_width: 0,
        pixel_height: 0,
    };

    fn wait_for(rx: &Receiver<Vec<u8>>, needle: &str) -> String {
        let deadline = Instant::now() + Duration::from_secs(20);
        let mut output = Vec::new();
        while Instant::now() < deadline {
            if let Ok(bytes) = rx.recv_timeout(Duration::from_millis(100)) {
                output.extend_from_slice(&bytes);
                let text = String::from_utf8_lossy(&output);
                if text.contains(needle) {
                    return text.into_owned();
                }
            }
        }
        panic!(
            "never saw {needle:?}; got: {:?}",
            String::from_utf8_lossy(&output)
        );
    }

    #[test]
    fn runs_a_command_and_returns_its_output() {
        let (mut session, rx) = PtySession::new(SIZE, None).unwrap();

        session.write_input(b"printf 'rook-%s\\n' ok\r").unwrap();
        wait_for(&rx, "rook-ok");

        session.close().unwrap();
    }

    #[test]
    fn starts_in_the_requested_folder() {
        let dir = std::env::temp_dir().canonicalize().unwrap();
        let (mut session, rx) = PtySession::new(SIZE, Some(dir.display().to_string())).unwrap();

        session.write_input(b"printf 'cwd=%s;\\n' \"$PWD\"\r").unwrap();
        let output = wait_for(&rx, ";\r\n");
        assert!(
            output.contains(&format!("cwd={};", dir.display())),
            "shell started elsewhere: {output:?}"
        );

        session.close().unwrap();
    }

    #[test]
    fn a_missing_folder_falls_back_instead_of_failing() {
        let (mut session, rx) =
            PtySession::new(SIZE, Some("/no/such/folder/rook-test".into())).unwrap();

        session.write_input(b"printf 'rook-%s\\n' alive\r").unwrap();
        wait_for(&rx, "rook-alive");

        session.close().unwrap();
    }

    #[test]
    fn resize_reaches_the_shell() {
        let (mut session, rx) = PtySession::new(SIZE, None).unwrap();

        session.resize(40, 132).unwrap();
        session.write_input(b"printf 'size=%s;\\n' \"$(stty size)\"\r").unwrap();
        wait_for(&rx, "size=40 132;");

        session.close().unwrap();
    }

    #[test]
    fn describes_the_terminal_to_programs() {
        let (mut session, rx) = PtySession::new(SIZE, None).unwrap();

        session.write_input(b"printf 'env=%s,%s;\\n' \"$TERM\" \"$TERM_PROGRAM\"\r").unwrap();
        wait_for(&rx, "env=xterm-256color,Rook;");

        session.close().unwrap();
    }

    #[test]
    fn close_ends_the_output_stream_quickly() {
        let (mut session, rx) = PtySession::new(SIZE, None).unwrap();
        session.write_input(b"printf 'rook-%s\\n' ready\r").unwrap();
        wait_for(&rx, "rook-ready");

        let start = Instant::now();
        session.close().unwrap();
        assert!(start.elapsed() < Duration::from_secs(2), "close() hung");

        let deadline = Instant::now() + Duration::from_secs(5);
        loop {
            match rx.recv_timeout(Duration::from_millis(100)) {
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                _ if Instant::now() > deadline => panic!("output stream never ended"),
                _ => {}
            }
        }
    }
}
