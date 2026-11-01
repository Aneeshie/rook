import { describe, expect, test } from 'bun:test';
import { matchAction } from './keybindings';

const key = (code: string, mods: { meta?: boolean; alt?: boolean; ctrl?: boolean; shift?: boolean } = {}) =>
  ({
    code,
    metaKey: mods.meta ?? true,
    altKey: mods.alt ?? false,
    ctrlKey: mods.ctrl ?? false,
    shiftKey: mods.shift ?? false,
  }) as KeyboardEvent;

describe('matchAction', () => {
  test('ignores keys without ⌘, so they reach the shell', () => {
    expect(matchAction(key('KeyW', { meta: false }))).toBeNull();
    expect(matchAction(key('KeyH', { meta: false, ctrl: true }))).toBeNull();
  });

  test('single ⌘ shortcuts', () => {
    expect(matchAction(key('KeyW'))).toEqual({ type: 'close' });
    expect(matchAction(key('KeyT'))).toEqual({ type: 'newTab' });
    expect(matchAction(key('Slash'))).toEqual({ type: 'shortcuts' });
    expect(matchAction(key('KeyE'))).toEqual({ type: 'workspaces' });
    expect(matchAction(key('Comma'))).toEqual({ type: 'settings' });
  });

  test('⌘ shortcuts need ⌘ alone', () => {
    expect(matchAction(key('KeyW', { shift: true }))).toBeNull();
    expect(matchAction(key('KeyT', { alt: true }))).toBeNull();
  });

  test('⌘1–9 go to a tab, ⌘⌥1–9 to a workspace', () => {
    expect(matchAction(key('Digit1'))).toEqual({ type: 'goToTab', number: 1 });
    expect(matchAction(key('Digit9'))).toEqual({ type: 'goToTab', number: 9 });
    expect(matchAction(key('Digit3', { alt: true }))).toEqual({ type: 'goToWorkspace', number: 3 });
  });

  test('font size: ⌘= and ⌘+ increase, ⌘- decreases, ⌘0 resets', () => {
    expect(matchAction(key('Equal'))).toEqual({ type: 'fontSize', change: 'increase' });
    expect(matchAction(key('Equal', { shift: true }))).toEqual({ type: 'fontSize', change: 'increase' });
    expect(matchAction(key('Minus'))).toEqual({ type: 'fontSize', change: 'decrease' });
    expect(matchAction(key('Digit0'))).toEqual({ type: 'fontSize', change: 'reset' });
  });

  test('hjkl with ⌘⌥ splits, ⌘⌃ resizes, ⌘⇧ moves focus', () => {
    expect(matchAction(key('KeyH', { alt: true }))).toEqual({ type: 'split', direction: 'left' });
    expect(matchAction(key('KeyJ', { ctrl: true }))).toEqual({ type: 'resize', direction: 'down' });
    expect(matchAction(key('KeyK', { shift: true }))).toEqual({ type: 'focus', direction: 'up' });
    expect(matchAction(key('KeyL', { alt: true }))).toEqual({ type: 'split', direction: 'right' });
  });

  test('uses the physical key, so ⌥ changing the character does not matter', () => {
    expect(matchAction({ ...key('KeyH', { alt: true }), key: '˙' } as KeyboardEvent)).toEqual({
      type: 'split',
      direction: 'left',
    });
  });

  test('plain ⌘ + hjkl and unknown keys are not ours', () => {
    expect(matchAction(key('KeyH'))).toBeNull();
    expect(matchAction(key('KeyQ'))).toBeNull();
  });
});
