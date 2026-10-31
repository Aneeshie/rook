import { Direction } from './layout/paneTree';

export type PaneAction =
  | { type: 'split'; direction: Direction }
  | { type: 'resize'; direction: Direction }
  | { type: 'close' };

// vim directions; event.code is the physical key, so ⌥ turning h into ˙ doesn't matter
const VIM_DIRECTIONS: Record<string, Direction> = {
  KeyH: 'left',
  KeyJ: 'down',
  KeyK: 'up',
  KeyL: 'right',
};

// null means "not ours", so the key goes to the shell as usual
export function matchPaneAction(event: KeyboardEvent): PaneAction | null {
  if (!event.metaKey) return null; // every pane shortcut uses ⌘

  if (event.code === 'KeyW' && !event.altKey && !event.ctrlKey && !event.shiftKey) {
    return { type: 'close' };
  }

  const direction = VIM_DIRECTIONS[event.code];
  if (!direction) return null;

  if (event.altKey && !event.ctrlKey) return { type: 'split', direction }; // ⌘⌥ + hjkl
  if (event.ctrlKey && !event.altKey) return { type: 'resize', direction }; // ⌘⌃ + hjkl

  return null;
}
