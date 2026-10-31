# Keybindings

Directions use vim keys: **h** left, **j** down, **k** up, **l** right. Press **⌘/** in the app to see this list.

## Workspaces and tabs

| Keys | Action |
|---|---|
| ⌘E | Open the workspace switcher |
| ⌘⌥1 – ⌘⌥9 | Go to workspace 1–9 |
| ⌘T | New tab, in the current folder |
| ⌘1 – ⌘8 | Go to tab 1–8 |
| ⌘9 | Go to the last tab |

## Panes

| Keys | Action |
|---|---|
| ⌘⌥ h / j / k / l | Split left / down / up / right, in the current folder |
| ⌘⇧ h / j / k / l | Move focus to the neighbouring pane |
| ⌘⌃ h / j / k / l | Move the nearest divider in that direction |
| ⌘W | Close the focused pane (closing the last one closes the tab) |

Dividers can also be dragged with the mouse, and typing `exit` closes a pane.

## Appearance

| Keys | Action |
|---|---|
| ⌘, | Settings |
| ⌘+ / ⌘− | Terminal font size up / down |
| ⌘0 | Reset the terminal font size |
| ⌘/ | Shortcut sheet |

## Workspace switcher

| Keys | Action |
|---|---|
| type | Filter, or name a new workspace |
| ↑ ↓ or ⌃J ⌃K | Move the selection |
| Enter | Switch to the selection, or create it |
| ⌘⌫ | Delete the selected workspace (asks first: Enter to confirm, Esc to cancel) |
| Esc | Close |

Hovering a workspace shows rename and delete. Delete always asks first, because it closes every shell in that workspace. The last workspace can't be deleted.

## How shortcuts reach the app

`src/keybindings.ts` has a single `matchAction(event)` that decides whether a key press is an app shortcut. xterm.js asks it first and ignores matching keys, so they never reach the shell; `App` asks it again in a window `keydown` listener and runs the action. Keys are matched by `event.code` (the physical key), so ⌥ turning `h` into `˙` doesn't matter.

To add a shortcut, extend `Action` and `matchAction`, handle it in `App.tsx`, and add it to `SHORTCUTS` so it shows up in the ⌘/ sheet.
