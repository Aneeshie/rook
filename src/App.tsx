import { useState } from "react";
import "./App.css"
import TerminalTab from "./components/TerminalTab";
import TerminalView from "./components/TerminalView";

type Tab = {
  id: string;
  title: string;
};

const createTab = (): Tab => ({ id: crypto.randomUUID(), title: "zsh" });

function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab()]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);

  const addTab = () => {
    const tab = createTab();
    setTabs((current) => [...current, tab]);
    setActiveId(tab.id);
  };

  const closeTab = (id: string) => {
    const position = tabs.findIndex((tab) => tab.id === id);
    if (position === -1) return;

    const remaining = tabs.filter((tab) => tab.id !== id);

    // always keep at least one tab
    if (remaining.length === 0) {
      const fresh = createTab();
      setTabs([fresh]);
      setActiveId(fresh.id);
      return;
    }

    setTabs(remaining);

    if (id === activeId) {
      // prefer the tab that slides into this slot, else the previous one
      setActiveId(remaining[Math.min(position, remaining.length - 1)].id);
    }
  };

  return (
    <main className="flex h-dvh w-screen flex-col overflow-hidden bg-[#0b0d12] font-mono text-neutral-300">
      {/* Overlay title bar: the native traffic lights sit on top of this header (hence the left padding). */}
      <header
        data-tauri-drag-region
        className="flex h-10 shrink-0 select-none items-stretch border-b border-[#1c212b] pl-[78px]"
      >

        <div role="tablist" className="flex items-stretch">
          {tabs.map((tab, position) => (
            <TerminalTab
              key={tab.id}
              index={position + 1}
              title={tab.title}
              active={tab.id === activeId}
              onSelect={() => setActiveId(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="New tab"
          onClick={addTab}
          className="cursor-pointer px-3 text-sm text-neutral-500 hover:text-neutral-100"
        >
          +
        </button>

        <div data-tauri-drag-region className="flex-1" />
      </header>

      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 px-5 py-3 ${
              tab.id === activeId ? '' : 'pointer-events-none invisible'
            }`}
          >
            <TerminalView active={tab.id === activeId} />
          </div>
        ))}
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-[#1c212b] text-xs">
        <span className="flex h-full items-center bg-[#e5b05a] px-3 font-bold text-black">TERM</span>
        <span className="flex items-center gap-2 text-neutral-300">
          <span className="size-2 rounded-full bg-[#e5b05a]" />
          work ▸ api
        </span>
        <span className="ml-auto pr-4 text-neutral-500">
          {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
        </span>
      </footer>
    </main>

  )
}

export default App;
