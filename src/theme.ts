import type { ITheme } from '@xterm/xterm';

// bundled with the app (@fontsource-variable/jetbrains-mono), with system fallbacks
export const FONT_FAMILY = "'JetBrains Mono Variable', ui-monospace, Menlo, monospace";

// the full 16-color ANSI palette, so `ok`, `WARN`, `ERR`, git status etc. get proper colors
// instead of xterm's defaults; the UI chrome uses the same accents
export const TERMINAL_THEME: ITheme = {
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
};
