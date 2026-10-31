import { Direction } from './layout/paneTree';

export type Action =
  | { type: 'split'; direction: Direction }
  | { type: 'resize'; direction: Direction }
  | { type: 'focus'; direction: Direction }
  | { type: 'close' }
  | { type: 'newTab' }
  | { type: 'goToTab'; number: number } // 1–9, where 9 means the last tab
  | { type: 'fontSize'; change: 'increase' | 'decrease' | 'reset' };

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
