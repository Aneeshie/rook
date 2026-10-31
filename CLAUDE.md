# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also `AGENTS.md` for style and commit conventions (Conventional Commit subjects like `feat: ...`, `fix: ...`, `chore: ...`).

## Commands

- `bun install` — install JS deps (bun is the package manager; `bun.lock`).
- `bun run tauri dev` — run the full desktop app (Vite + Rust backend).
- `bun run dev` — Vite frontend only (Tauri `invoke`/`listen` calls will fail outside the app shell).
- `bun run build` — `tsc` typecheck + Vite production build.
- `cargo check --manifest-path src-tauri/Cargo.toml` — check the Rust backend.
- `bun run tauri build` — package the app.

There is no test suite or linter configured. Validate changes with `bun run build` and `cargo check`, and for UI changes manually exercise terminal creation, I/O, resizing, and tab close in `bun run tauri dev`.

## Architecture

A Tauri 2 terminal emulator: React 19 + xterm.js frontend, Rust `portable-pty` backend. Styling is Tailwind v4 (via `@tailwindcss/vite`) with utility classes inline in JSX.

**Backend (`src-tauri/src/`)**
- `lib.rs` registers all Tauri commands (`create_session`, `write_to_session`, `resize_session`, `remove_session`) and manages a global `Mutex<SessionManager>`. `commands.rs` is currently empty — commands live in `lib.rs`.
- `session.rs`: `SessionManager` maps UUID → `Arc<Mutex<PtySession>>`. On creation it spawns a thread that forwards PTY output as `terminal-output` events (`{ terminal_id, data: bytes }`) and emits `terminal-exit` when the stream ends.
- `pty.rs`: `PtySession` wraps the PTY, its reader thread, writer, and resize/close.
- Locking pattern: commands take the manager lock only to clone the session `Arc`, release it, then lock the individual session — keep this to avoid holding the global lock during PTY I/O.

**Frontend (`src/`)**
- `App.tsx` owns tab state (frontend tab ids are independent of backend session ids). All `TerminalView`s stay mounted; inactive tabs are hidden with `invisible`/`pointer-events-none` so their sessions and scrollback persist. Closing the last tab replaces it with a fresh one.
- `components/TerminalView.tsx` owns one xterm instance and one backend session for its lifetime: it registers the `terminal-output`/`terminal-exit` listeners *before* calling `create_session` (filtering events by `terminal_id`) so no early output is lost, handles fit/resize → `resize_session`, font-size shortcuts, and calls `remove_session` on unmount. Shell exit triggers `onExit`, which closes the tab.
- The header uses `data-tauri-drag-region` with left padding for macOS overlay traffic lights (custom title bar; native one removed in `tauri.conf.json`).

When changing the Tauri interface, keep command names, argument names (camelCase in JS ↔ snake_case in Rust per Tauri conversion), and event payload fields aligned on both sides, and review `src-tauri/capabilities/default.json`.

`ui/` holds design mockups (pure terminal, terminal with AI, sessions and groups) indicating planned directions.
