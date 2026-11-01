import { afterEach, describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';

const installStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
  return data;
};

afterEach(() => {
  // @ts-expect-error
  delete globalThis.localStorage;
});

describe('settings', () => {
  test('defaults when nothing is saved', () => {
    installStorage();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('saving and loading round-trips', () => {
    installStorage();
    const settings = { ...DEFAULT_SETTINGS, theme: 'other', terminalFontSize: 18, gpuAcceleration: 'off' as const };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  test('older saves get defaults for fields added later', () => {
    installStorage({ 'nara:settings': JSON.stringify({ theme: 'other' }) });
    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: 'other' });
    expect(loadSettings().gpuAcceleration).toBe('auto');
  });

  test('corrupt JSON falls back to the defaults', () => {
    installStorage({ 'nara:settings': '{not json' });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('no storage at all still works', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});
