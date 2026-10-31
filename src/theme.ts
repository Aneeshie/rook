import type { ITheme } from '@xterm/xterm';

// colors for the app around the terminal; App writes them to CSS variables that the
// Tailwind classes (bg-bg, text-fg, text-muted, …) read, so a theme switch repaints everything
export type UiColors = {
  bg: string; // window and terminal background
  surface: string; // floating panels: settings, switcher, shortcut sheet
  fg: string; // primary text
  soft: string; // secondary text
  muted: string; // quiet labels
  faint: string; // barely-there hints
  accent: string; // active tab, focus, highlights
  danger: string; // failures
  info: string; // git branch
};

export type AppTheme = {
  id: string;
  name: string;
  ui: UiColors;
  terminal: ITheme; // the full 16-color ANSI palette, so `ok`, `WARN`, `ERR`, git status etc. get proper colors
};

const nara: AppTheme = {
  id: 'nara',
  name: 'Nara',
  ui: {
    bg: '#0b0d12',
    surface: '#12151c',
    fg: '#e6e8eb',
    soft: '#a3a8b0',
    muted: '#737880',
    faint: '#4b5058',
    accent: '#e5b05a',
    danger: '#f47067',
    info: '#6ea8fe',
  },
  terminal: {
    background: '#0b0d12',
    foreground: '#c9d1d9',
    cursor: '#c9d1d9',
    cursorAccent: '#0b0d12',
    selectionBackground: 'rgba(110, 168, 254, 0.3)',
    black: '#1c212b',
    red: '#f47067',
    green: '#8ddb8c',
    yellow: '#e5b05a',
    blue: '#6ea8fe',
    magenta: '#c297ff',
    cyan: '#56d4dd',
    white: '#c9d1d9',
    brightBlack: '#636e7b',
    brightRed: '#ff938a',
    brightGreen: '#b4f1b4',
    brightYellow: '#f5c97a',
    brightBlue: '#96c0ff',
    brightMagenta: '#dcbdfb',
    brightCyan: '#7ee3ea',
    brightWhite: '#f0f3f6',
  },
};

const tokyoNight: AppTheme = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  ui: {
    bg: '#1a1b26',
    surface: '#1f2335',
    fg: '#c0caf5',
    soft: '#a9b1d6',
    muted: '#737aa2',
    faint: '#414868',
    accent: '#7aa2f7',
    danger: '#f7768e',
    info: '#7dcfff',
  },
  terminal: {
    background: '#1a1b26',
    foreground: '#c0caf5',
    cursor: '#c0caf5',
    cursorAccent: '#1a1b26',
    selectionBackground: 'rgba(122, 162, 247, 0.3)',
    black: '#15161e',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
    brightBlack: '#414868',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#7aa2f7',
    brightMagenta: '#bb9af7',
    brightCyan: '#7dcfff',
    brightWhite: '#c0caf5',
  },
};

const rosePine: AppTheme = {
  id: 'rose-pine',
  name: 'Rosé Pine',
  ui: {
    bg: '#191724',
    surface: '#1f1d2e',
    fg: '#e0def4',
    soft: '#908caa',
    muted: '#6e6a86',
    faint: '#403d52',
    accent: '#ebbcba',
    danger: '#eb6f92',
    info: '#9ccfd8',
  },
  terminal: {
    background: '#191724',
    foreground: '#e0def4',
    cursor: '#e0def4',
    cursorAccent: '#191724',
    selectionBackground: 'rgba(196, 167, 231, 0.25)',
    black: '#26233a',
    red: '#eb6f92',
    green: '#31748f',
    yellow: '#f6c177',
    blue: '#9ccfd8',
    magenta: '#c4a7e7',
    cyan: '#ebbcba',
    white: '#e0def4',
    brightBlack: '#6e6a86',
    brightRed: '#eb6f92',
    brightGreen: '#31748f',
    brightYellow: '#f6c177',
    brightBlue: '#9ccfd8',
    brightMagenta: '#c4a7e7',
    brightCyan: '#ebbcba',
    brightWhite: '#e0def4',
  },
};

const catppuccin: AppTheme = {
  id: 'catppuccin',
  name: 'Catppuccin Mocha',
  ui: {
    bg: '#1e1e2e',
    surface: '#181825',
    fg: '#cdd6f4',
    soft: '#a6adc8',
    muted: '#7f849c',
    faint: '#45475a',
    accent: '#cba6f7',
    danger: '#f38ba8',
    info: '#89b4fa',
  },
  terminal: {
    background: '#1e1e2e',
    foreground: '#cdd6f4',
    cursor: '#f5e0dc',
    cursorAccent: '#1e1e2e',
    selectionBackground: 'rgba(147, 153, 178, 0.3)',
    black: '#45475a',
    red: '#f38ba8',
    green: '#a6e3a1',
    yellow: '#f9e2af',
    blue: '#89b4fa',
    magenta: '#f5c2e7',
    cyan: '#94e2d5',
    white: '#bac2de',
    brightBlack: '#585b70',
    brightRed: '#f38ba8',
    brightGreen: '#a6e3a1',
    brightYellow: '#f9e2af',
    brightBlue: '#89b4fa',
    brightMagenta: '#f5c2e7',
    brightCyan: '#94e2d5',
    brightWhite: '#a6adc8',
  },
};

export const THEMES: AppTheme[] = [nara, tokyoNight, rosePine, catppuccin];

export const themeById = (id: string) => THEMES.find((theme) => theme.id === id) ?? nara;

// writes the UI colors where the Tailwind theme (App.css) picks them up
export const applyUiTheme = (theme: AppTheme) => {
  const root = document.documentElement.style;
  for (const [name, value] of Object.entries(theme.ui)) {
    root.setProperty(`--ui-${name}`, value);
  }
};

export type FontOption = { id: string; name: string; family: string };

// all bundled with the app (@fontsource packages imported in main.tsx), except the system one
export const FONTS: FontOption[] = [
  { id: 'jetbrains-mono', name: 'JetBrains Mono', family: "'JetBrains Mono Variable', ui-monospace, Menlo, monospace" },
  { id: 'geist-mono', name: 'Geist Mono', family: "'Geist Mono Variable', ui-monospace, Menlo, monospace" },
  { id: 'fira-code', name: 'Fira Code', family: "'Fira Code Variable', ui-monospace, Menlo, monospace" },
  { id: 'ibm-plex-mono', name: 'IBM Plex Mono', family: "'IBM Plex Mono', ui-monospace, Menlo, monospace" },
  { id: 'system', name: 'SF Mono', family: "ui-monospace, 'SF Mono', Menlo, monospace" },
];

export const fontById = (id: string) => FONTS.find((font) => font.id === id) ?? FONTS[0];
