import { Direction } from './layout/paneTree';

export type Action =
  | { type: 'split'; direction: Direction }
  | { type: 'resize'; direction: Direction }
  | { type: 'focus'; direction: Direction }
  | { type: 'close' }
  | { type: 'newTab' }
  | { type: 'goToTab'; number: number } // 1–9, where 9 means the last tab
  | { type: 'fontSize'; change: 'increase' | 'decrease' | 'reset' }
  | { type: 'shortcuts' }
  | { type: 'workspaces' }
  | { type: 'settings' }
  | { type: 'goToWorkspace'; number: number }; // 1–9

// what the ⌘/ sheet lists, in groups; each key is one keycap. Keep in sync with matchAction below
export type Shortcut = { keys: string[]; label: string };

export const SHORTCUT_GROUPS: { title: string; shortcuts: Shortcut[] }[] = [
  {
    title: 'Panes',
    shortcuts: [
      { keys: ['⌘', '⌥', 'h j k l'], label: 'Split' },
      { keys: ['⌘', '⇧', 'h j k l'], label: 'Move focus' },
      { keys: ['⌘', '⌃', 'h j k l'], label: 'Resize' },
      { keys: ['⌘', 'W'], label: 'Close pane' },
    ],
  },
  {
    title: 'Tabs & workspaces',
    shortcuts: [
      { keys: ['⌘', 'T'], label: 'New tab' },
      { keys: ['⌘', '1–9'], label: 'Go to tab' },
      { keys: ['⌘', 'E'], label: 'Workspaces' },
      { keys: ['⌘', '⌥', '1–9'], label: 'Go to workspace' },
    ],
  },
  {
    title: 'App',
    shortcuts: [
      { keys: ['⌘', ','], label: 'Settings' },
      { keys: ['⌘', '+'], label: 'Bigger text' },
      { keys: ['⌘', '−'], label: 'Smaller text' },
      { keys: ['⌘', '0'], label: 'Reset text size' },
      { keys: ['⌘', '/'], label: 'This sheet' },
    ],
  },
];

// vim directions; event.code is the physical key, so ⌥ turning h into ˙ doesn't matter
const VIM_DIRECTIONS: Record<string, Direction> = {
  KeyH: 'left',
  KeyJ: 'down',
  KeyK: 'up',
  KeyL: 'right',
};

// null means "not ours", so the key goes to the shell as usual
export function matchAction(event: KeyboardEvent): Action | null {
  if (!event.metaKey) return null; // every app shortcut uses ⌘

  const onlyMeta = !event.altKey && !event.ctrlKey && !event.shiftKey;

  if (onlyMeta && event.code === 'KeyW') return { type: 'close' };
  if (onlyMeta && event.code === 'KeyT') return { type: 'newTab' };
  if (onlyMeta && event.code === 'Slash') return { type: 'shortcuts' };
  if (onlyMeta && event.code === 'KeyE') return { type: 'workspaces' };
  if (onlyMeta && event.code === 'Comma') return { type: 'settings' };

  // ⌘⌥1 … ⌘⌥9
  if (event.altKey && !event.ctrlKey && !event.shiftKey && /^Digit[1-9]$/.test(event.code)) {
    return { type: 'goToWorkspace', number: Number(event.code.slice(5)) };
  }

  // ⌘1 … ⌘9
  if (onlyMeta && /^Digit[1-9]$/.test(event.code)) {
    return { type: 'goToTab', number: Number(event.code.slice(5)) };
  }

  // ⌘= and ⌘+ (⇧=) both increase, ⌘- decreases, ⌘0 resets
  if (!event.altKey && !event.ctrlKey) {
    if (event.code === 'Equal') return { type: 'fontSize', change: 'increase' };
    if (event.code === 'Minus') return { type: 'fontSize', change: 'decrease' };
    if (event.code === 'Digit0' && !event.shiftKey) return { type: 'fontSize', change: 'reset' };
  }

  const direction = VIM_DIRECTIONS[event.code];
  if (!direction) return null;

  if (event.altKey && !event.ctrlKey) return { type: 'split', direction }; // ⌘⌥ + hjkl
  if (event.ctrlKey && !event.altKey) return { type: 'resize', direction }; // ⌘⌃ + hjkl
  if (event.shiftKey) return { type: 'focus', direction }; // ⌘⇧ + hjkl

  return null;
}
