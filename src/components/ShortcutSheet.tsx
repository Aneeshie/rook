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
        className="w-80 rounded-xl border border-white/5 bg-[#12151c] p-2 shadow-2xl shadow-black/50"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {SHORTCUTS.map(({ keys, label }) => (
          <div key={label} className="flex items-center justify-between rounded-md px-3 py-2 text-[13px]">
            <span className="text-neutral-400">{label}</span>
            <kbd className="font-mono text-xs text-neutral-200">{keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShortcutSheet;
