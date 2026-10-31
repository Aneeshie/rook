import { useCallback, useEffect, useState } from "react";
import { GitBranch, Plus } from "lucide-react";
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
import PaneLayout, { PaneInfo } from "./components/PaneLayout";
import { matchAction } from "./keybindings";
import ShortcutSheet from "./components/ShortcutSheet";

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;

type Tab = {
  id: string;
  root: PaneNode;
  focusedId: string;
  panes: Record<string, PaneInfo>; // paneId -> what its shell has told us (cwd, branch, status, …)
};

const createTab = (): Tab => {
  const paneId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    root: { kind: 'leaf', id: paneId },
    focusedId: paneId,
    panes: {},
  };
}

const shortenHome = (path: string) => path.replace(/^\/(Users|home)\/[^/]+/, '~');

// just the folder name for the tab: /Users/aneesh/work/api → "api", home → "~"
const folderName = (path: string) => {
  const short = shortenHome(path);
  if (short === '~' || short === '/') return short;
  return short.split('/').filter(Boolean).pop() ?? short;
};

// the focused pane's folder, or "zsh" until the shell has told us
const tabTitle = (tab: Tab) => {
  const cwd = tab.panes[tab.focusedId]?.cwd;
  return cwd ? folderName(cwd) : 'zsh';
};

const isRunning = (tab: Tab) => Object.values(tab.panes).some((pane) => pane.status?.state === 'running');

function App() {
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab()]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);
  // shared by every terminal in every tab, so new tabs and panes start at the same size
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const closeShortcuts = useCallback(() => setShowShortcuts(false), []);

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

  // merge what a pane just told us into what we already know about it
  const updatePaneInfo = (tabId: string, paneId: string, change: PaneInfo) => {
    updateTab(tabId, (tab) => ({
      ...tab,
      panes: { ...tab.panes, [paneId]: { ...tab.panes[paneId], ...change } },
    }));
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

    // forget the closed pane's info
    updateTab(tabId, (t) => {
      const { [paneId]: _closed, ...panes } = t.panes;
      return { ...t, root, focusedId, panes };
    });
  };

  // re-registered whenever tabs or activeId change, so the handler never sees stale state
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchAction(event);
      if (!action) return;

      event.preventDefault();

      if (action.type === 'shortcuts') {
        setShowShortcuts((open) => !open);
        return;
      }

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
  const activePane: PaneInfo = activeTab ? activeTab.panes[activeTab.focusedId] ?? {} : {};
  const activeCwd = activePane.cwd ? shortenHome(activePane.cwd) : '';
  const exitCode = activePane.status?.state === 'done' ? activePane.status.exitCode : 0;

  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-[#0b0d12] font-mono text-neutral-300">
      {/* Overlay title bar: the native traffic lights sit on top of this header (hence the left padding). */}
      <header data-tauri-drag-region className="flex h-10 shrink-0 select-none items-stretch pl-[78px]">
        <div role="tablist" className="flex items-stretch">
          {tabs.map((tab, position) => (
            <TerminalTab
              key={tab.id}
              index={position + 1}
              title={tabTitle(tab)}
              path={tab.panes[tab.focusedId]?.cwd}
              active={tab.id === activeId}
              running={isRunning(tab)}
              onSelect={() => setActiveId(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="New tab"
          onClick={addTab}
          className="flex cursor-pointer items-center px-2 text-neutral-600 transition-colors hover:text-neutral-200"
        >
          <Plus size={14} />
        </button>

        <div data-tauri-drag-region className="flex-1" />
      </header>

      <div className="relative min-h-0 flex-1">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`absolute inset-0 px-2 ${tab.id === activeId ? '' : 'pointer-events-none invisible'}`}
          >
            <PaneLayout
              root={tab.root}
              active={tab.id === activeId}
              focusedId={tab.focusedId}
              fontSize={fontSize}
              onFocus={(paneId) => focusPane(tab.id, paneId)}
              onPaneExit={(paneId) => closePaneInTab(tab.id, paneId)}
              onRootChange={(root) => setRoot(tab.id, root)}
              onPaneInfo={(paneId, change) => updatePaneInfo(tab.id, paneId, change)}
            />
          </div>
        ))}
      </div>

      {/* one quiet line: where you are, which branch, and a failure only when there is one */}
      <footer className="flex h-7 shrink-0 select-none items-center gap-4 px-4 text-[11px] text-neutral-500">
        <span className="truncate">{activeCwd}</span>
        {activePane.branch && (
          <span className="flex shrink-0 items-center gap-1 text-[#6ea8fe]/80">
            <GitBranch size={11} />
            {activePane.branch}
          </span>
        )}
        {exitCode !== 0 && <span className="shrink-0 text-[#f47067]">exit {exitCode}</span>}

        <button
          type="button"
          onClick={() => setShowShortcuts(true)}
          className="ml-auto shrink-0 cursor-pointer text-neutral-600 transition-colors hover:text-neutral-300"
        >
          ⌘/
        </button>
      </footer>

      {showShortcuts && <ShortcutSheet onClose={closeShortcuts} />}
    </main>

  )
}

export default App;
