use std::io::Write;
use std::sync::mpsc::Receiver;
use std::time::{Duration, Instant};

use nara_code_lib::pty::PtySession;
use portable_pty::PtySize;

const SIZE: PtySize = PtySize {
    rows: 50,
    cols: 200,
    pixel_width: 0,
    pixel_height: 0,
};
const FILE_BYTES: usize = 32 * 1024 * 1024;
const THROUGHPUT_RUNS: usize = 8;
const ECHO_SAMPLES: usize = 2000;

fn wait_for(rx: &Receiver<Vec<u8>>, needle: &[u8]) {
    let deadline = Instant::now() + Duration::from_secs(60);
    let mut tail: Vec<u8> = Vec::new();
    while Instant::now() < deadline {
        if let Ok(bytes) = rx.recv_timeout(Duration::from_millis(100)) {
            tail.extend_from_slice(&bytes);
            if tail.windows(needle.len()).any(|w| w == needle) {
                return;
            }
            let keep = tail.len().saturating_sub(needle.len());
            tail.drain(..keep);
        }
    }
    panic!("never saw {:?}", String::from_utf8_lossy(needle));
}

fn drain(rx: &Receiver<Vec<u8>>) {
    while rx.recv_timeout(Duration::from_millis(200)).is_ok() {}
}

fn start() -> (PtySession, Receiver<Vec<u8>>) {
    let (mut session, rx) = PtySession::new(SIZE, None).unwrap();
    session.write_input(b"printf 'bench-%s\\n' ready\r").unwrap();
    wait_for(&rx, b"bench-ready");
    drain(&rx);
    (session, rx)
}

fn quantile(values: &[f64], q: f64) -> f64 {
    let mut s = values.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let at = (s.len() - 1) as f64 * q;
    let (lo, hi) = (at.floor() as usize, at.ceil() as usize);
    s[lo] + (s[hi] - s[lo]) * (at - lo as f64)
}

fn result(name: &str, unit: &str, higher_is_better: bool, values: &[f64]) -> String {
    let (fast, near_fast) = if higher_is_better { (0.9, 0.75) } else { (0.1, 0.25) };
    let best = quantile(values, fast);
    let median = quantile(values, 0.5);
    let spread = (best - quantile(values, near_fast)).abs() / best;
    let list: Vec<String> = values.iter().map(|v| v.to_string()).collect();
    format!(
        r#"{{"name":"{name}","unit":"{unit}","higherIsBetter":{higher_is_better},"best":{best},"median":{median},"spread":{spread},"samples":{},"values":[{}]}}"#,
        values.len(),
        list.join(",")
    )
}

fn throughput() -> String {
    let path = std::env::temp_dir().join("rook-bench-output.txt");
    let mut file = std::fs::File::create(&path).unwrap();
    let mut written = 0;
    let mut n = 1u64;
    while written < FILE_BYTES {
        let line = format!("{n}\n");
        written += line.len();
        file.write_all(line.as_bytes()).unwrap();
        n += 1;
    }
    drop(file);

    let (mut session, rx) = start();
    let command = format!("cat {}; printf 'bench-%s\\n' done\r", path.display());

    let mut values = Vec::new();
    for run in 0..=THROUGHPUT_RUNS {
        let t0 = Instant::now();
        session.write_input(command.as_bytes()).unwrap();
        wait_for(&rx, b"bench-done");
        let seconds = t0.elapsed().as_secs_f64();
        if run > 0 {
            values.push(written as f64 / 1e6 / seconds);
        }
        drain(&rx);
    }

    session.close().unwrap();
    let _ = std::fs::remove_file(&path);
    result("pty: cat 32 MB", "MB/s", true, &values)
}

fn echo_latency() -> String {
    let (mut session, rx) = start();
    session.write_input(b"stty raw -echo; cat\r").unwrap();
    std::thread::sleep(Duration::from_millis(300));
    drain(&rx);

    let mut values = Vec::new();
    for sample in 0..ECHO_SAMPLES + 100 {
        let t0 = Instant::now();
        session.write_input(b"x").unwrap();
        let mut got = 0;
        while got == 0 {
            got = rx
                .recv_timeout(Duration::from_secs(5))
                .expect("no echo")
                .iter()
                .filter(|&&b| b == b'x')
                .count();
        }
        if sample >= 100 {
            values.push(t0.elapsed().as_secs_f64() * 1e6);
        }
    }

    session.close().unwrap();
    result("pty: keystroke echo", "µs", false, &values)
}

fn main() {
    if std::env::args().any(|arg| arg == "--list") {
        return;
    }

    let empty = std::env::temp_dir().join("rook-bench-zdotdir");
    std::fs::create_dir_all(&empty).unwrap();
    unsafe { std::env::set_var("ZDOTDIR", &empty) };

    let results = [throughput(), echo_latency()];
    println!("BENCH_JSON [{}]", results.join(","));
}
