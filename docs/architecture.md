# Architecture

Nara is a [Tauri 2](https://tauri.app) app: a Rust backend owns the shells, and a React + TypeScript frontend draws them with [xterm.js](https://xtermjs.org).

```
┌──────────────────────── frontend (src/) ────────────────────────┐
│ App.tsx          workspaces → tabs → pane tree, settings, keys  │
│ PaneLayout.tsx   tree → rectangles, dividers, focus             │
│ TerminalView.tsx one xterm.js instance ↔ one backend session    │
└──────────────┬───────────────────────────────▲──────────────────┘
               │ invoke (commands)              │ emit (events)
┌──────────────▼───────────────────────────────┴──────────────────┐
│ lib.rs       Tauri commands                                     │
│ session.rs   SessionManager: id → PtySession, output forwarding │
│ pty.rs       PtySession: spawns zsh in a pseudo-terminal        │
└──────────────────────── backend (src-tauri/src/) ───────────────┘
```

## Backend

| File | Responsibility |
|---|---|
| `lib.rs` | Registers the Tauri commands and a global `Mutex<SessionManager>`. |
| `session.rs` | Maps session ids (UUIDs) to `Arc<Mutex<PtySession>>`. On creation it starts a thread that forwards PTY output to the frontend. |
| `pty.rs` | Opens a PTY with `portable-pty`, starts `zsh` with Nara's [shell integration](shell-integration.md), and handles writes, resizes and shutdown. |

### Commands

| Command | Arguments | Returns |
|---|---|---|
| `create_session` | `rows`, `cols`, `cwd?` | session id |
| `write_to_session` | `id`, `input` | — |
| `resize_session` | `id`, `rows`, `cols` | — |
| `remove_session` | `id` | — |

`cwd` is optional: when it's missing, or the folder no longer exists, the shell starts in the home directory.

### Events

| Event | Payload | When |
|---|---|---|
| `terminal-output` | `{ terminal_id, data: number[] }` | the shell printed something |
| `terminal-exit` | `{ terminal_id }` | the shell's output stream ended |

### Locking

Commands lock the session manager only long enough to clone a session's `Arc`, release it, and then lock that one session. PTY I/O never happens while the global lock is held, so a slow or busy shell can't stall every other pane.

## Frontend

### State

All state lives in `App.tsx`, nested the same way the UI is:

```
workspaces[]              each: name, color, activeTabId
  └─ tabs[]               each: focusedId
       ├─ root            the pane tree (see pane-layout.md)
       └─ panes{}         paneId → what its shell reported: cwd, branch, status, command, size
settings                  theme, font, terminal and interface sizes
```

Updates are immutable (copy, then change), so React re-renders reliably. Functions that react to a shell (a `cd`, an exit) look the tab up in **every** workspace, because background workspaces keep running.

### Rendering

- Every tab of every workspace stays mounted; hidden ones are `invisible`. That's what keeps shells and scrollback alive when you switch tabs or workspaces.
- Panes are rendered as a **flat list keyed by pane id**, not as nested components. When the tree changes shape (a split wraps a pane in a new node), React keeps the same `TerminalView` instead of remounting it and killing its shell.
- `PaneLayout` measures its own box and turns the tree into pixel rectangles with `computeLayout`.

### A terminal's lifecycle

`TerminalView` owns one xterm.js instance and one backend session:

1. Register the `terminal-output` / `terminal-exit` listeners first, so no early output is lost.
2. Fit the terminal to its box, then call `create_session` with that size and the starting folder.
3. Forward keystrokes with `write_to_session`; refit and call `resize_session` whenever the box changes size.
4. On unmount, call `remove_session`. Closing a pane, tab or workspace ends its shells this way.

### Persistence

| Key (`localStorage`) | Contents |
|---|---|
| `nara:session` | workspaces, tabs, pane trees and each pane's folder |
| `nara:settings` | theme, font, terminal and interface size |

The session is saved 300ms after it last changed. On launch, panes are recreated from the saved tree and each shell starts in its saved folder. Running programs aren't restored, only the layout and folders. A missing or unreadable save falls back to a fresh workspace.
