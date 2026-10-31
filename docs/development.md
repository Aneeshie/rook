# Development

## Prerequisites

- [Bun](https://bun.sh)
- [Rust](https://rustup.rs) (stable)
- The [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform (on macOS, the Xcode Command Line Tools)
- `zsh`, which every pane runs

## Commands

| Command | What it does |
|---|---|
| `bun install` | Install JavaScript dependencies |
| `bun run tauri dev` | Run the app with hot reload |
| `bun run tauri build` | Build every release bundle |
| `bun run build:dmg` | Build a macOS disk image into `src-tauri/target/release/bundle/dmg/` |
| `bun run build` | Type-check and build the frontend only |
| `bun run dev` | Frontend only, in a browser (no shells: Tauri commands aren't available there) |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Check the Rust backend |

`bun run tauri dev` rebuilds the Rust side when anything under `src-tauri/` changes, including the shell scripts in `src-tauri/shell/`, which are compiled into the binary.

## Project structure

```
src/
  App.tsx                 workspaces, tabs, keyboard handling, persistence
  main.tsx                fonts, initial theme, mount
  theme.ts                themes and fonts
  settings.ts             settings model and storage
  keybindings.ts          shortcut matching and the shortcut list
  layout/paneTree.ts      the pane tree: layout and operations
  components/
    TerminalView.tsx      one xterm.js terminal and its session
    PaneLayout.tsx        panes and draggable dividers for one tab
    TerminalTab.tsx       a tab in the title bar
    WorkspaceSwitcher.tsx ⌘E
    SettingsPanel.tsx     ⌘,
    ShortcutSheet.tsx     ⌘/
src-tauri/
  src/lib.rs              Tauri commands
  src/session.rs          session manager
  src/pty.rs              PTY and shell startup
  shell/                  zsh integration scripts
  capabilities/           what the frontend is allowed to call
docs/                     this documentation
```

## Conventions

- TypeScript: two-space indentation, single quotes, PascalCase components, camelCase everything else.
- Rust: `rustfmt` formatting, snake_case.
- Keep Tauri command names and argument names aligned between `invoke(...)` calls and Rust. Tauri maps them by name.
- Review `src-tauri/capabilities/default.json` whenever the frontend needs a new backend capability.
- Commits follow Conventional Commits: `feat:`, `fix:`, `chore:`.

## Checking a change

There's no automated test suite yet. Before opening a pull request:

```bash
bun run build
```

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Then run `bun run tauri dev` and try what you changed: creating, splitting, resizing and closing panes, typing in them, switching tabs and workspaces, and restarting to check that the session restores.

`src/layout/paneTree.ts` has no dependencies on React or Tauri, so it's the natural first place for unit tests.
