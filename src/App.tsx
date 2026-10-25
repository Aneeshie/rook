import "./App.css"
import TerminalTab from "./components/TerminalTab";
import TerminalView from "./components/TerminalView";

function App() {

  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden bg-[#0b0d12] font-mono text-neutral-300">
      <header className="flex h-12 shrink-0 items-stretch border-b border-[#1c212b]">
        <div className="flex items-center gap-2 px-5 text-sm text-neutral-100">
          <span className="size-2 rounded-full bg-[#e5b05a]" />
          <span>work</span>
        </div>
        <TerminalTab index={1} title="~" active />
      </header>

      <div className="flex min-h-0 flex-1 px-5 py-3">
        <TerminalView />
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-[#1c212b] text-xs">
        <span className="flex h-full items-center bg-[#e5b05a] px-3 font-bold text-black">TERM</span>
        <span className="text-neutral-500">work</span>
      </footer>
    </main>

  )
}

export default App;
