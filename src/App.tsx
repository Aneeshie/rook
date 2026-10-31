import { useEffect, useState } from "react";
import "./App.css"
import TerminalTab from "./components/TerminalTab";
import {
  closePane,
  computeLayout,
  Direction,
  findNeighbour,
  leaves,
  PaneNode,
  resizePane,
  splitPane,
} from "./layout/paneTree";
import PaneLayout from "./components/PaneLayout";
import { matchAction } from "./keybindings";

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;

type Tab = {
  id: string;
  root: PaneNode;
  focusedId: string;
  cwds: Record<string, string>; // paneId -> that pane's current dir
};

const createTab = (): Tab => {
  const paneId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    root: { kind: 'leaf', id: paneId },
    focusedId: paneId,
    cwds: {}
  };
}

const shortenHome = (path: string) => path.replace(/^\/(Users|home)\/[^/]+/, '~');

// the focused pane's dir
const tabTitle = (tab: Tab) => {
  const cwd = tab.cwds[tab.focusedId];
  return cwd ? shortenHome(cwd) : 'zsh';
}

function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab()]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);
  // shared by every terminal in every tab, so new tabs and panes start at the same size
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  const addTab = () => {
    const tab = createTab();
    setTabs((current) => [...current, tab]);
    setActiveId(tab.id);
  };

  const focusPane = (tabId: string, paneId: string) => {
    setTabs((curr) =>
      curr.map((tab) => (tab.id === tabId ? { ...tab, focusedId: paneId } : tab)
      ))
  }

  // copy-then-change one tab, same pattern as focusPane
  const updateTab = (tabId: string, change: (tab: Tab) => Tab) => {
    setTabs((current) => current.map((tab) => (tab.id === tabId ? change(tab) : tab)));
  };

  const splitFocused = (tabId: string, direction: Direction) => {
    const newId = crypto.randomUUID();
    updateTab(tabId, (tab) => ({
      ...tab,
      root: splitPane(tab.root, tab.focusedId, newId, direction),
      focusedId: newId, // the new pane gets focus
    }));
  };

  const resizeFocused = (tabId: string, direction: Direction) => {
    updateTab(tabId, (tab) => ({
      ...tab,
      root: resizePane(tab.root, tab.focusedId, direction),
    }));
  };

  const moveFocus = (tabId: string, direction: Direction) => {
    updateTab(tabId, (tab) => {
      // which pane sits next to which only depends on the fractions, not the real pixel size,
      // so any big made-up rectangle works and App doesn't need to measure anything
      const { panes } = computeLayout(tab.root, { x: 0, y: 0, width: 10000, height: 10000 });
      const neighbour = findNeighbour(panes, tab.focusedId, direction);
      return neighbour ? { ...tab, focusedId: neighbour } : tab;
    });
  };

  const setRoot = (tabId: string, root: PaneNode) => {
    updateTab(tabId, (tab) => ({ ...tab, root }));
  };

  const setPaneCwd = (tabId: string, paneId: string, cwd: string) => {
    updateTab(tabId, (tab) => ({ ...tab, cwds: { ...tab.cwds, [paneId]: cwd } }));
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

  const closePaneInTab = (tabId: string, paneId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const root = closePane(tab.root, paneId);

    // that was the last pane, so the whole tab goes
    if (!root) {
      closeTab(tabId);
      return;
    }

    // same idea as closeTab: the pane that slides into this slot, else the last one
    const before = leaves(tab.root);
    const after = leaves(root);
    const position = before.indexOf(paneId);
    const focusedId =
      paneId === tab.focusedId ? after[Math.min(position, after.length - 1)] : tab.focusedId;

    updateTab(tabId, (t) => ({ ...t, root, focusedId }));
  };

  // re-registered whenever tabs or activeId change, so the handler never sees stale state
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchAction(event);
      if (!action) return;

      event.preventDefault();

      if (action.type === 'newTab') {
        addTab();
        return;
      }

      if (action.type === 'goToTab') {
        // ⌘9 always means the last tab, like browsers
        const target = action.number === 9 ? tabs[tabs.length - 1] : tabs[action.number - 1];
        if (target) setActiveId(target.id);
        return;
      }

      if (action.type === 'fontSize') {
        setFontSize((size) => {
          if (action.change === 'increase') return Math.min(size + 1, MAX_FONT_SIZE);
          if (action.change === 'decrease') return Math.max(size - 1, MIN_FONT_SIZE);
          return DEFAULT_FONT_SIZE;
        });
        return;
      }

      const tab = tabs.find((t) => t.id === activeId);
      if (!tab) return;

      if (action.type === 'split') splitFocused(tab.id, action.direction);
      else if (action.type === 'focus') moveFocus(tab.id, action.direction);
      else if (action.type === 'resize') resizeFocused(tab.id, action.direction);
      else closePaneInTab(tab.id, tab.focusedId);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tabs, activeId]);

  const activeTab = tabs.find((tab) => tab.id === activeId);

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
              title={tabTitle(tab)}
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
            className={`absolute inset-0 px-5 py-3 ${tab.id === activeId ? '' : 'pointer-events-none invisible'
              }`}
          >
            <PaneLayout
              root={tab.root}
              active={tab.id === activeId}
              focusedId={tab.focusedId}
              fontSize={fontSize}
              onFocus={(paneId) => focusPane(tab.id, paneId)}
              onPaneExit={(paneId) => closePaneInTab(tab.id, paneId)}
              onRootChange={(root) => setRoot(tab.id, root)}
              onPaneCwd={(paneId, cwd) => setPaneCwd(tab.id, paneId, cwd)}
            />
          </div>
        ))}
      </div>

      <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-[#1c212b] text-xs">
        <span className="flex h-full items-center bg-[#e5b05a] px-3 font-bold text-black">TERM</span>
        <span className="flex items-center gap-2 text-neutral-300">
          <span className="size-2 rounded-full bg-[#e5b05a]" />{activeTab ? tabTitle(activeTab) : ''}
        </span>
        <span className="ml-auto pr-4 text-neutral-500">
          {tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}
        </span>
      </footer>
    </main>

  )
}

export default App;
