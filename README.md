# Rook

A minimal, keyboard-driven terminal for macOS, built with Tauri, React and Rust.

Rook stays out of the way: no toolbars, no status clutter, just your shells, with splits, workspaces and a little help from the shell when it's useful.

## Features

- **Split panes.** Split in any direction, move between panes and resize them with vim keys, or drag the dividers. Splits are an n-ary tree, so three panes side by side stay three equal columns.
- **Tabs and workspaces.** Group tabs into named workspaces and switch with ⌘E. Background workspaces keep their shells running.
- **Picks up where you left off.** Workspaces, tabs, splits and each pane's folder are restored on launch.
- **Shell integration.** Tabs show the current folder, the status line shows the git branch, and failed commands are marked right in the output. New splits and tabs open where you are.
- **Themes and fonts.** Nara, Tokyo Night, Rosé Pine and Catppuccin Mocha; JetBrains Mono, Geist Mono, Fira Code, IBM Plex Mono or SF Mono; separate terminal and interface sizes.
- **Your config, untouched.** Your `.zshrc`, prompt and aliases work as usual. Rook adds its hooks without editing them.

## Getting started

You'll need [Bun](https://bun.sh), [Rust](https://rustup.rs) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for macOS.

```bash
git clone git@github.com:Aneeshie/rook.git
```

```bash
cd rook && bun install
```

```bash
bun run tauri dev
```

To build a release bundle:

```bash
bun run tauri build
```

## Keyboard

| Keys | Action |
|---|---|
| ⌘T / ⌘W | New tab / close pane |
| ⌘1 – ⌘9 | Go to tab |
| ⌘⌥ h j k l | Split |
| ⌘⇧ h j k l | Move focus |
| ⌘⌃ h j k l | Resize |
| ⌘E | Workspaces |
| ⌘, | Settings |
| ⌘/ | All shortcuts |

The full list is in [docs/keybindings.md](docs/keybindings.md).

## Documentation

| | |
|---|---|
| [Architecture](docs/architecture.md) | How the Rust backend and React frontend fit together |
| [Pane layout](docs/pane-layout.md) | The split tree and the math that lays it out |
| [Shell integration](docs/shell-integration.md) | How zsh reports folders, branches and command results |
| [Keybindings](docs/keybindings.md) | Every shortcut, and how to add one |
| [Configuration](docs/configuration.md) | Themes, fonts, sizes, and adding your own theme |
| [Development](docs/development.md) | Setup, project structure and conventions |

## Status

Rook is early and macOS-only for now. Every pane runs `zsh`.

## Contributing

Issues and pull requests are welcome. Before opening one, run `bun run build` and `cargo check --manifest-path src-tauri/Cargo.toml`, and try your change in `bun run tauri dev`. See [Development](docs/development.md) for conventions.

## License

[MIT](LICENSE)
