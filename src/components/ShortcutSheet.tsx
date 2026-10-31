import { useEffect } from 'react';
import { X } from 'lucide-react';
import { SHORTCUT_GROUPS } from '../keybindings';
import type { Shortcut } from '../keybindings';

type ShortcutSheetProps = {
  onClose: () => void;
};

// the shortcut list lives behind ⌘/ instead of on screen all the time
const ShortcutSheet = ({ onClose }: ShortcutSheetProps) => {
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
        className="flex max-h-[86vh] w-[min(720px,92vw)] flex-col overflow-hidden rounded-2xl border border-fg/5 bg-surface shadow-2xl shadow-black/50"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-fg/5 px-8 py-5">
          <h2 className="text-[length:calc(var(--ui-size,13px)+3px)] text-fg">Keyboard shortcuts</h2>
          <button
            type="button"
            aria-label="Close shortcuts"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:bg-fg/5 hover:text-fg"
          >
            <X size={14} />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-x-10 gap-y-8 overflow-y-auto px-8 pt-6 pb-8 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="flex flex-col gap-1">
              <h3 className="mb-2 text-ui-sm text-muted">{group.title}</h3>
              {group.shortcuts.map((shortcut) => (
                <ShortcutRow key={shortcut.label} shortcut={shortcut} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

const ShortcutRow = ({ shortcut }: { shortcut: Shortcut }) => (
  <div className="flex h-10 items-center justify-between gap-4">
    <span className="text-ui text-soft">{shortcut.label}</span>
    <span className="flex shrink-0 items-center gap-1">
      {shortcut.keys.map((key) => (
        // one keycap per key, so ⌘ ⌥ h j k l reads as keys to press, not a string
        <kbd
          key={key}
          className="flex h-6 min-w-6 items-center justify-center rounded-md border border-fg/10 bg-fg/[0.04] px-1.5 font-mono text-ui-sm text-fg shadow-[0_1px_0_0] shadow-fg/10"
        >
          {key}
        </kbd>
      ))}
    </span>
  </div>
);

export default ShortcutSheet;
