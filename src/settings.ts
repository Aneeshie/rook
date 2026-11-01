// user preferences, kept apart from the session (workspaces, tabs) because they outlive it:
// clearing your workspaces shouldn't reset your theme
//
//
export type GpuAcceleration = 'auto' | 'on' | 'off';

export type Settings = {
  theme: string; // AppTheme id
  font: string; // FontOption id, used by the terminal and the UI
  terminalFontSize: number;
  uiFontSize: number;
  gpuAcceleration: GpuAcceleration;
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'nara',
  font: 'jetbrains-mono',
  terminalFontSize: 14,
  uiFontSize: 13,
  gpuAcceleration: 'auto'
};

export const TERMINAL_FONT_SIZE = { min: 10, max: 32 };
export const UI_FONT_SIZE = { min: 11, max: 16 };

const STORAGE_KEY = 'nara:settings';

// unknown or missing fields fall back to the defaults, so older saves keep working
export const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: Settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable: the settings still apply, they just won't be remembered
  }
};
