use std::io::Result;
use std::sync::mpsc::Receiver;
use std::{
    io::{Read, Write},
    sync::mpsc::channel,
};

use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
    output_rx: Receiver<Vec<u8>>,
    reader_thread: std::thread::JoinHandle<()>,
}

impl PtySession {
    fn new() -> anyhow::Result<Self> {
        //use the native pty implementation for the system
        let pty_system = native_pty_system();

        //create a new pty
        let pair = pty_system.openpty(PtySize {
            rows: 30,
            cols: 80,
            pixel_height: 0,
            pixel_width: 0,
        })?;

        let cmd = CommandBuilder::new("zsh");
        let child = pair.slave.spawn_command(cmd)?;

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

        Ok(Self {
            master: pair.master,
            writer,
            child,
            reader_thread,
            output_rx: rx,
        })
    }

    fn read_output(&self) -> Option<Vec<u8>> {
        self.output_rx.recv().ok()
    }

    fn write_input(&mut self, input: &[u8]) -> Result<()> {
        self.writer.write_all(input)?;
        self.writer.flush()?;
        Ok(())
    }
}
