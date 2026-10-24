use std::io::Write;

use portable_pty::{Child, CommandBuilder, MasterPty, PtySize, native_pty_system};

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
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

        let cmd = CommandBuilder::new("bash");
        let child = pair.slave.spawn_command(cmd)?;

        let writer = pair.master.take_writer()?;

        Ok(Self {
            master: pair.master,
            writer,
            child,
        })
    }
}
