import { useEffect } from 'react';
import { SHORTCUTS } from '../keybindings';

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
        className="w-80 rounded-xl border border-fg/5 bg-surface p-2 shadow-2xl shadow-black/50"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {SHORTCUTS.map(({ keys, label }) => (
          <div key={label} className="flex items-center justify-between rounded-md px-3 py-2 text-ui">
            <span className="text-soft">{label}</span>
            <kbd className="font-mono text-xs text-fg">{keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShortcutSheet;
