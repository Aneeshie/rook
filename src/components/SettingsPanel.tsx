import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import { FONTS, THEMES } from '../theme';
import type { AppTheme } from '../theme';
import { Settings, TERMINAL_FONT_SIZE, UI_FONT_SIZE } from '../settings';

type SettingsPanelProps = {
  settings: Settings;
  onChange: (change: Partial<Settings>) => void;
  onClose: () => void;
};

// every change applies immediately, so there's no save button: what you see is what you get
const SettingsPanel = ({ settings, onChange, onClose }: SettingsPanelProps) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[86vh] w-[min(760px,92vw)] flex-col overflow-hidden rounded-2xl border border-fg/5 bg-surface shadow-2xl shadow-black/50"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-fg/5 px-10 py-6">
          <h2 className="text-[length:calc(var(--ui-size,13px)+3px)] text-fg">Settings</h2>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:bg-fg/5 hover:text-fg"
          >
            <X size={14} />
          </button>
        </header>

        <div className="flex flex-col gap-12 overflow-y-auto px-10 pt-8 pb-10">
          <Section title="Theme">
            <div className="grid grid-cols-2 gap-5">
              {THEMES.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  selected={theme.id === settings.theme}
                  onSelect={() => onChange({ theme: theme.id })}
                />
              ))}
            </div>
          </Section>

          <Section title="Font">
            <div className="flex flex-col gap-1">
              {FONTS.map((font) => {
                const selected = font.id === settings.font;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => onChange({ font: font.id })}
                    style={{ fontFamily: font.family }}
                    className={`flex h-12 cursor-pointer items-center gap-6 rounded-xl px-4 text-left transition-colors ${
                      selected ? 'bg-fg/[0.06] text-fg' : 'text-soft hover:bg-fg/[0.03]'
                    }`}
                  >
                    <span className="w-44 shrink-0 text-ui">{font.name}</span>
                    {/* the characters that tell monospace fonts apart */}
                    <span className="flex-1 truncate text-ui-sm text-faint">0O 1lI {'{}'} =&gt; !=</span>
                    {selected && <Check size={13} className="shrink-0 text-accent" />}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Size">
            <div className="flex flex-col gap-2">
              <Stepper
                label="Terminal"
                hint="⌘+  ⌘−"
                value={settings.terminalFontSize}
                {...TERMINAL_FONT_SIZE}
                onChange={(terminalFontSize) => onChange({ terminalFontSize })}
              />
              <Stepper
                label="Interface"
                value={settings.uiFontSize}
                {...UI_FONT_SIZE}
                onChange={(uiFontSize) => onChange({ uiFontSize })}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="flex flex-col gap-5">
    <h3 className="text-ui-sm text-muted">{title}</h3>
    {children}
  </section>
);

// a tiny terminal drawn in the theme's own colors, so you see it before you pick it
const ThemeCard = ({ theme, selected, onSelect }: { theme: AppTheme; selected: boolean; onSelect: () => void }) => {
  const t = theme.terminal;
  const swatches = [t.red, t.green, t.yellow, t.blue, t.magenta, t.cyan];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`cursor-pointer overflow-hidden rounded-2xl text-left ring-1 transition-all ${
        selected ? 'ring-2 ring-accent' : 'ring-fg/[0.06] hover:ring-fg/20'
      }`}
    >
      <div className="flex flex-col gap-1 px-5 py-5 text-[11px] leading-5" style={{ background: t.background }}>
        <div>
          <span style={{ color: t.green }}>❯</span> <span style={{ color: t.blue }}>git</span>{' '}
          <span style={{ color: t.foreground }}>status</span>
        </div>
        <div style={{ color: t.brightBlack }}>## main...origin/main</div>
        <div>
          <span style={{ color: t.yellow }}>M</span> <span style={{ color: t.foreground }}>src/app.tsx</span>
        </div>
        <div>
          <span style={{ color: t.red }}>??</span> <span style={{ color: t.foreground }}>notes.md</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {swatches.map((color, index) => (
            <span key={index} className="size-2 rounded-full" style={{ background: color }} />
          ))}
        </div>
      </div>

      <div
        className="flex items-center justify-between px-5 py-3.5 text-ui-sm"
        style={{ background: theme.ui.surface, color: theme.ui.fg }}
      >
        {theme.name}
        {selected && <Check size={12} style={{ color: theme.ui.accent }} />}
      </div>
    </button>
  );
};

type StepperProps = {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

const Stepper = ({ label, hint, value, min, max, onChange }: StepperProps) => (
  <div className="flex h-14 items-center justify-between rounded-xl bg-fg/[0.02] px-4">
    <span className="flex items-baseline gap-3">
      <span className="text-ui text-soft">{label}</span>
      {hint && <span className="text-ui-sm text-faint">{hint}</span>}
    </span>

    <span className="flex items-center gap-1 rounded-lg bg-fg/[0.04] p-0.5">
      <button
        type="button"
        aria-label={`Smaller ${label.toLowerCase()} text`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-soft transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Minus size={12} />
      </button>
      <span className="w-8 text-center text-ui tabular-nums text-fg">{value}</span>
      <button
        type="button"
        aria-label={`Larger ${label.toLowerCase()} text`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-soft transition-colors hover:bg-fg/[0.06] hover:text-fg disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Plus size={12} />
      </button>
    </span>
  </div>
);

export default SettingsPanel;
