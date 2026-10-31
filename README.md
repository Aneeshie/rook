<div align="center">

<img src="src-tauri/icons/128x128@2x.png" alt="Rook icon" width="128" height="128">

# Rook

**A minimal, keyboard-driven terminal Emulator for macOS.**

Splits, tabs and workspaces that stay out of your way, with just enough help from your shell.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)
![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB.svg?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-backend-CE422B.svg?logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)

**[Download for macOS (Apple silicon)](https://github.com/Aneeshie/rook/releases/download/v0.1.3/Rook_0.1.3_aarch64.dmg)**

[Features](#features) · [Installation](#installation) · [Usage](#usage) · [Configuration](#configuration) · [Documentation](#documentation) · [Contributing](#contributing)

</div>

<!-- Add a screenshot here, e.g. ![Rook](docs/assets/screenshot.png) -->

---

## Why Rook

Most terminals either do too little or put everything on screen at once. Rook keeps the window to your shells and moves everything else behind the keyboard: no toolbars, no panels you didn't ask for, and a status line that only speaks up when something matters.

## Features

### Panes, tabs and workspaces

- **Split in any direction** and move, resize or close panes with vim keys, or drag the dividers with the mouse.
- **Even splits that stay even.** Panes form an n-ary tree, so three panes side by side are three equal columns rather than a nested chain.
- **Workspaces** group tabs by project. Switch with ⌘E or ⌘⌥1–9; shells in background workspaces keep running.
- **Session restore.** Workspaces, tabs, splits, divider positions and each pane's folder come back exactly as you left them.

### Shell integration

- Tabs are titled with the **current folder**; the status line shows the full path and **git branch**.
- **Failed commands are marked in place,** with the command and its output highlighted and the exit code beside it.
- **New splits and tabs open in the folder you're in.**
- A dot on a tab shows when **something is running** in it.
- Works with your existing `.zshrc`, prompt and plugins. Rook loads them as usual and adds its hooks without editing any of your files.

### Appearance

- **Four themes:** Nara, Tokyo Night, Rosé Pine and Catppuccin Mocha, each covering both the terminal palette and the interface.
- **Five fonts:** JetBrains Mono, Geist Mono, Fira Code (with ligatures), IBM Plex Mono and SF Mono, bundled so they work offline.
- **Separate sizes** for the terminal and the interface, like an editor's buffer and UI fonts.
- Changes apply live, to every open terminal, without restarting a shell.

## Installation

### Download

Download **[Rook_0.1.3_aarch64.dmg](https://github.com/Aneeshie/rook/releases/download/v0.1.3/Rook_0.1.3_aarch64.dmg)** (Apple silicon), open it, and drag **Rook** into **Applications**. Other versions are on the [Releases](https://github.com/Aneeshie/rook/releases) page.

Rook isn't notarized by Apple yet, so macOS blocks the first launch with a warning that it can't verify the app. To open it anyway:

1. Open **Rook** from Applications once, and dismiss the warning.
2. Go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to the message about Rook.

Or clear the quarantine flag from a terminal, which skips the warning entirely:

```bash
xattr -dr com.apple.quarantine /Applications/Rook.app
```

Copy Rook into Applications before opening it; don't run it from the disk image.

### Build from source

You'll need:

- macOS
- [Bun](https://bun.sh)
- [Rust](https://rustup.rs) (stable)
- The [Tauri prerequisites](https://tauri.app/start/prerequisites/) for macOS (the Xcode Command Line Tools)

Clone the repository and install dependencies:

```bash
git clone git@github.com:Aneeshie/rook.git
```

```bash
cd rook && bun install
```

Run it in development mode:

```bash
bun run tauri dev
```

Build a disk image (`.dmg`) for your Mac's architecture:

```bash
bun run build:dmg
```

The image is written to `src-tauri/target/release/bundle/dmg/`, for example `Rook_0.1.3_aarch64.dmg` on Apple silicon. To also keep the `.app` (in `bundle/macos/`), build every bundle format instead with `bun run tauri build`.

## Usage

Rook is designed to be driven from the keyboard. Directions use vim keys: **h** left, **j** down, **k** up, **l** right.

| Keys | Action |
|---|---|
| ⌘T | New tab |
| ⌘1 – ⌘9 | Go to tab (⌘9 is the last) |
| ⌘⌥ h j k l | Split the pane in that direction |
| ⌘⇧ h j k l | Move focus to the neighbouring pane |
| ⌘⌃ h j k l | Resize: move the nearest divider |
| ⌘W | Close the pane |
| ⌘E | Switch, create or rename workspaces |
| ⌘⌥1 – ⌘⌥9 | Go to workspace |
| ⌘+ / ⌘− / ⌘0 | Terminal font size up / down / reset |
| ⌘, | Settings |
| ⌘/ | Show all shortcuts |

See [docs/keybindings.md](docs/keybindings.md) for the complete reference.

## Configuration

Open **Settings** with ⌘, or the gear in the status line to choose a theme, a font, and the terminal and interface sizes. Everything applies immediately and is remembered between launches.

Adding a theme takes a single object in `src/theme.ts`; see [docs/configuration.md](docs/configuration.md).

## Documentation

| Guide | Contents |
|---|---|
| [Architecture](docs/architecture.md) | How the Rust backend and React frontend fit together: commands, events and state |
| [Pane layout](docs/pane-layout.md) | The split tree, its invariants, and the math that lays it out |
| [Shell integration](docs/shell-integration.md) | How zsh reports folders, branches and command results |
| [Keybindings](docs/keybindings.md) | Every shortcut, and how to add one |
| [Configuration](docs/configuration.md) | Themes, fonts and sizes, and adding your own |
| [Development](docs/development.md) | Project structure, commands and conventions |

## How it works

Rook is a [Tauri 2](https://tauri.app) application. A Rust backend starts each shell in a pseudo-terminal with [`portable-pty`](https://crates.io/crates/portable-pty) and streams its output to a React frontend, which renders it with [xterm.js](https://xtermjs.org). Shells report their folder, branch and command results through standard escape sequences (`OSC 7` and `OSC 133`), the same mechanism used by iTerm2 and VS Code. The [architecture guide](docs/architecture.md) covers the details.

## Roadmap

- [x] Split panes, tabs and workspaces
- [x] Session restore
- [x] Shell integration: folders, branches, command status
- [x] Themes, fonts and settings
- [x] macOS disk image
- [ ] Signed and notarized releases
- [ ] Search in scrollback
- [ ] Command palette
- [ ] AI assistant: explain a failed command and suggest a fix
- [ ] Sessions that keep running after the app quits
- [ ] Support for shells other than zsh

## Contributing

Contributions are welcome. To propose a change:

1. Fork the repository and create a branch.
2. Make your change, following the conventions in [docs/development.md](docs/development.md).
3. Check that it builds:

   ```bash
   bun run build
   ```

   ```bash
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

4. Try it in `bun run tauri dev`, then open a pull request describing what changed and how you tested it. Include a screenshot for visual changes.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `chore:`.

## License

Rook is released under the [MIT License](LICENSE).
