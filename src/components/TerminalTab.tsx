
type TerminalTab = {
  sessionId: string;
  title: string;
}

const TerminalTab = ({ sessionId, title }: TerminalTab) => {
  return (
    <div>
      {title}
    </div>
  )
}

export default TerminalTab
