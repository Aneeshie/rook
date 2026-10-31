import { X } from 'lucide-react';

type TerminalTabProps = {
  index: number;
  title: string; // short: just the folder name
  path?: string; // full path, shown on hover
  active: boolean;
  running: boolean;
  onSelect: () => void;
  onClose: () => void;
}

const TerminalTab = ({ index, title, path, active, running, onSelect, onClose }: TerminalTabProps) => {
  return (
    <div
      role="tab"
      aria-selected={active}
      title={path}
      className="group relative flex h-full items-center"
    >
      <button
        type="button"
        onClick={onSelect}
        className={`flex h-full cursor-pointer items-center gap-2 pl-3 pr-1 text-ui transition-colors ${
          active ? 'text-fg' : 'text-muted hover:text-soft'
        }`}
      >
        {/* a small dot while something runs in this tab, otherwise nothing */}
        <span
          className={`size-1.5 rounded-full transition-opacity ${running ? 'bg-accent opacity-100' : 'opacity-0'}`}
        />
        <span className="max-w-40 truncate">{title}</span>
      </button>

      <button
        type="button"
        aria-label={`Close tab ${index}`}
        onClick={onClose}
        className="mr-1.5 cursor-pointer rounded p-0.5 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-fg/5 hover:text-fg"
      >
        <X size={12} strokeWidth={2} />
      </button>

      {/* the active tab's underline, inset so it reads as a mark rather than a border */}
      {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
    </div>
  )
}

export default TerminalTab
