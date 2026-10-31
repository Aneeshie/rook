# Shell integration

Rook knows each pane's folder, git branch and running command, and when commands start and fail, because zsh tells it. The shell prints small, invisible escape sequences into its normal output, and the terminal reacts to them instead of displaying them.

## How zsh gets the hooks

Rook never edits your `~/.zshrc`. Instead, `pty.rs` starts zsh with two environment variables:

| Variable | Value |
|---|---|
| `ZDOTDIR` | a temp folder holding Rook's own `.zshenv` and `.zshrc` |
| `NARA_USER_ZDOTDIR` | where your real config lives (your `ZDOTDIR`, or `$HOME`) |

zsh reads its startup files from `ZDOTDIR`, so it reads Rook's. Those files:

1. load your real `.zshenv` and `.zshrc`, so your prompt, theme and aliases work as usual;
2. put `ZDOTDIR` back to your real folder;
3. add Rook's hooks.

The scripts live in `src-tauri/shell/` and are compiled into the app with `include_str!`, then written to the temp folder each time a pane starts.

## The messages

All of them are OSC sequences: `ESC ] <number> ; <data> BEL`.

| Sequence | Sent | Meaning |
|---|---|---|
| `OSC 7 ; file://host/path` | before every prompt | the current folder |
| `OSC 7777 ; branch=<name>` | before every prompt | the git branch, empty outside a repository |
| `OSC 7777 ; command=<text>` | when a command starts, and empty when it ends | the running command |
| `OSC 133 ; C` | when a command starts | output begins here |
| `OSC 133 ; D ; <exit code>` | when a command ends | output ends here, with this exit code |
| `OSC 133 ; A` | before every prompt | a prompt starts here |

`OSC 7` and `OSC 133` are standard, shared with iTerm2, VS Code, WezTerm and others. `7777` is Rook's own.

The `precmd` hook that sends `D` runs first among `precmd` hooks, so it reads `$?` before a prompt theme can overwrite it. It only sends `D` when a command actually ran, not for an empty Enter.

## What the frontend does with them

`TerminalView` registers a handler per OSC number with `terminal.parser.registerOscHandler` and reports up to `App`:

- **Folder** → tab title (the folder name), status line (the full path), and where new splits and tabs open. It's also saved, so restored panes reopen there.
- **Branch** → status line.
- **Command status** → a dot on the tab while something runs, and `exit N` in the status line when it fails.
- **Failed commands** → a tinted block over the command and its output, with an `✗ exit N` badge, drawn with xterm.js decorations pinned to markers so they scroll with the text. Ctrl-C (exit 130) isn't marked.

Decorations are still a proposed xterm.js API, so terminals are created with `allowProposedApi: true`.

## Trying it by hand

You can see the messages with `cat -v`, which prints invisible characters instead of acting on them:

```bash
printf '\e]7;file://%s%s\a' "$HOST" "$PWD" | cat -v
```
