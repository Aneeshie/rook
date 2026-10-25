type TerminalTabProps = {
  index: number;
  title: string;
  active?: boolean;
}

const TerminalTab = ({ index, title, active = false }: TerminalTabProps) => {
  return (
    <div
      className={`flex h-full items-center gap-2 px-4 text-sm ${
        active
          ? 'border-b-2 border-[#e5b05a] bg-[#11141b] text-[#e5b05a]'
          : 'text-neutral-400'
      }`}
    >
      <span>{index}</span>
      <span className={active ? 'text-neutral-100' : ''}>{title}</span>
    </div>
  )
}

export default TerminalTab
