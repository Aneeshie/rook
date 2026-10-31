# Configuration

Open settings with **⌘,** or the gear in the status line. Every change applies immediately and is remembered.

## Themes

| Theme | Accent |
|---|---|
| Nara | gold |
| Tokyo Night | blue |
| Rosé Pine | rose |
| Catppuccin Mocha | mauve |

A theme sets both the 16-color ANSI palette used by the terminal and the colors of the interface around it.

## Fonts

| Font | Notes |
|---|---|
| JetBrains Mono | default |
| Geist Mono | |
| Fira Code | ligatures |
| IBM Plex Mono | |
| SF Mono | the system font, not bundled |

The bundled fonts come from [Fontsource](https://fontsource.org) and work offline. The chosen font is used by both the terminal and the interface.

## Sizes

| Setting | Range | Default |
|---|---|---|
| Terminal | 10–32 | 14 |
| Interface | 11–16 | 13 |

⌘+, ⌘− and ⌘0 change the terminal size from anywhere.

## Adding a theme

Themes live in `src/theme.ts`. Add an `AppTheme` to `THEMES`:

```ts
const myTheme: AppTheme = {
  id: 'my-theme',
  name: 'My Theme',
  ui: {
    bg, surface, fg, soft, muted, faint, // backgrounds and text, from strongest to quietest
    accent, danger, info,                // active tab and focus, failures, git branch
  },
  terminal: {
    background, foreground, cursor, cursorAccent, selectionBackground,
    black, red, green, yellow, blue, magenta, cyan, white,
    brightBlack, brightRed, brightGreen, brightYellow,
    brightBlue, brightMagenta, brightCyan, brightWhite,
  },
};
```

The `ui` colors are written to CSS variables (`--ui-bg`, `--ui-fg`, …), which `src/App.css` exposes to Tailwind as `bg-bg`, `text-fg`, `text-muted`, `bg-accent` and so on. Components only use those classes, never hard-coded colors, so a new theme needs no other changes.

## Adding a font

Install it from Fontsource, import it in `src/main.tsx`, and add a `FontOption` to `FONTS` in `src/theme.ts` with its CSS `font-family` (keep monospace fallbacks at the end).

## Where things are stored

Settings are saved in the app's `localStorage` under `nara:settings`, separately from workspaces (`nara:session`), so clearing one never resets the other. Unknown or missing fields fall back to the defaults.
