type TerminalTabProps = {
  index: number;
  title: string;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}

const TerminalTab = ({ index, title, active, onSelect, onClose }: TerminalTabProps) => {
  return (
    <div
      role="tab"
      aria-selected={active}
      className={`group flex h-full items-center border-l border-r border-[#1c212b] text-sm ${
        active
          ? 'border-b-2 border-b-[#e5b05a] bg-[#11141b]'
          : 'border-b-2 border-b-transparent border-l-transparent border-r-transparent'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className={`flex h-full cursor-pointer items-center gap-2 pl-4 pr-2 ${
          active ? 'text-neutral-100' : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <span className={active ? 'text-[#e5b05a]' : ''}>{index}</span>
        <span>{title}</span>
      </button>
      <button
        type="button"
        aria-label={`Close tab ${index}`}
        onClick={onClose}
        className="mr-2 cursor-pointer rounded px-1 text-neutral-500 hover:bg-[#1c212b] hover:text-neutral-100"
      >
        ×
      </button>
    </div>
  )
}

export default TerminalTab
