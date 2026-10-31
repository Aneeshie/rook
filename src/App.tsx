import { useCallback, useEffect, useState } from "react";
import { ChevronDown, GitBranch, Plus } from "lucide-react";
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
import WorkspaceSwitcher from "./components/WorkspaceSwitcher";

const DEFAULT_FONT_SIZE = 14;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 32;

type Tab = {
  id: string;
  root: PaneNode;
  focusedId: string;
  panes: Record<string, PaneInfo>; // paneId -> what its shell has told us (cwd, branch, status, …)
};

// cwd: the folder the first shell starts in (none means home)
const createTab = (cwd?: string): Tab => {
  const paneId = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    root: { kind: 'leaf', id: paneId },
    focusedId: paneId,
    panes: cwd ? { [paneId]: { cwd } } : {},
  };
}

type Workspace = {
  id: string;
  name: string;
  color: string; // the dot that tells workspaces apart at a glance
  tabs: Tab[];
  activeTabId: string; // each workspace remembers its own active tab
}

// handed out in order, so neighbouring workspaces never share a color
const WORKSPACE_COLORS = ['#e5b05a', '#6ea8fe', '#8ddb8c', '#c297ff', '#56d4dd', '#f47067'];

const createWorkspace = (name: string, color: string): Workspace => {
  const tab = createTab();
  return { id: crypto.randomUUID(), name, color, tabs: [tab], activeTabId: tab.id };
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>(() => [createWorkspace('default', WORKSPACE_COLORS[0])]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => workspaces[0].id);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [overlay, setOverlay] = useState<'shortcuts' | 'workspaces' | null>(null);
  // bumped when an overlay closes, so the active terminal gets the keyboard back
  const [refocus, setRefocus] = useState(0);
  const closeOverlay = useCallback(() => {
    setOverlay(null);
    setRefocus((n) => n + 1);
  }, []);

  const workspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const tabs = workspace.tabs;
  const activeId = workspace.activeTabId;

  // change the workspace on screen
  const updateWorkspace = (change: (w: Workspace) => Workspace) => {
    setWorkspaces((all) => all.map((w) => (w.id === activeWorkspaceId ? change(w) : w)));
  };

  const setActiveId = (tabId: string) => {
    updateWorkspace((w) => ({ ...w, activeTabId: tabId }));
  };

  const updateTab = (tabId: string, change: (tab: Tab) => Tab) => {
    setWorkspaces((all) =>
      all.map((w) =>
        w.tabs.some((t) => t.id === tabId)
          ? { ...w, tabs: w.tabs.map((t) => (t.id === tabId ? change(t) : t)) }
          : w,
      ),
    );
  };
  // a new tab opens where you are, like a new split does
  const addTab = () => {
    const current = workspace.tabs.find((t) => t.id === workspace.activeTabId);
    const tab = createTab(current?.panes[current.focusedId]?.cwd);
    updateWorkspace((w) => ({ ...w, tabs: [...w.tabs, tab], activeTabId: tab.id }));
  };

  const focusPane = (tabId: string, paneId: string) => {
    updateTab(tabId, (tab) => ({ ...tab, focusedId: paneId }));
  };

  const switchWorkspace = (id: string) => {
    setActiveWorkspaceId(id);
    closeOverlay();
  };

  const addWorkspace = (name: string) => {
    const created = createWorkspace(name, WORKSPACE_COLORS[workspaces.length % WORKSPACE_COLORS.length]);
    setWorkspaces((all) => [...all, created]);
    switchWorkspace(created.id);
  };

  const renameWorkspace = (id: string, name: string) => {
    setWorkspaces((all) => all.map((w) => (w.id === id ? { ...w, name } : w)));
  };

  // closes every shell in it: its terminals unmount, and unmounting ends their sessions
  const deleteWorkspace = (id: string) => {
    if (workspaces.length === 1) return; // always keep one

    const position = workspaces.findIndex((w) => w.id === id);
    const remaining = workspaces.filter((w) => w.id !== id);
    setWorkspaces(remaining);

    if (id === activeWorkspaceId) {
      setActiveWorkspaceId(remaining[Math.min(position, remaining.length - 1)].id);
    }
  };


  const splitFocused = (tabId: string, direction: Direction) => {
    const newId = crypto.randomUUID();
    updateTab(tabId, (tab) => ({
      ...tab,
      root: splitPane(tab.root, tab.focusedId, newId, direction),
      focusedId: newId, // the new pane gets focus
      // and starts in the same folder as the pane it was split from
      panes: { ...tab.panes, [newId]: { cwd: tab.panes[tab.focusedId]?.cwd } },
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
    setWorkspaces((all) =>
      all.map((w) => {
        const position = w.tabs.findIndex((tab) => tab.id === id);
        if (position === -1) return w; // not in this workspace

        const remaining = w.tabs.filter((tab) => tab.id !== id);

        // always keep at least one tab
        if (remaining.length === 0) {
          const fresh = createTab();
          return { ...w, tabs: [fresh], activeTabId: fresh.id };
        }

        // prefer the tab that slides into this slot, else the previous one
        const activeTabId =
          w.activeTabId === id ? remaining[Math.min(position, remaining.length - 1)].id : w.activeTabId;

        return { ...w, tabs: remaining, activeTabId };
      }),
    );
  };

  const closePaneInTab = (tabId: string, paneId: string) => {
    const tab = workspaces.flatMap((w) => w.tabs).find((t) => t.id === tabId);
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

      if (action.type === 'shortcuts' || action.type === 'workspaces') {
        if (overlay === action.type) closeOverlay();
        else setOverlay(action.type);
        return;
      }

      if (action.type === 'goToWorkspace') {
        const target = workspaces[action.number - 1];
        if (target) switchWorkspace(target.id);
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
  }, [workspaces, activeWorkspaceId, overlay]);

  const activeTab = tabs.find((tab) => tab.id === activeId);
  const activePane: PaneInfo = activeTab ? activeTab.panes[activeTab.focusedId] ?? {} : {};
  const activeCwd = activePane.cwd ? shortenHome(activePane.cwd) : '';
  const exitCode = activePane.status?.state === 'done' ? activePane.status.exitCode : 0;

  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-[#0b0d12] font-mono text-neutral-300">
      {/* Overlay title bar: the native traffic lights sit on top of this header (hence the left padding). */}
      <header data-tauri-drag-region className="flex h-10 shrink-0 select-none items-stretch pl-[78px]">
        {/* the current workspace; click (or ⌘E) to switch */}
        <button
          type="button"
          onClick={() => setOverlay('workspaces')}
          className="my-2 mr-2 flex cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] text-neutral-300 transition-colors hover:bg-white/5"
        >
          <span className="size-2 rounded-full" style={{ background: workspace.color }} />
          <span className="max-w-32 truncate">{workspace.name}</span>
          <ChevronDown size={12} className="text-neutral-600" />
        </button>

        <span className="my-3 mr-1 w-px bg-white/[0.06]" />

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
        {/* every tab of every workspace stays mounted, so background shells keep running */}
        {workspaces.map((w) =>
          w.tabs.map((tab) => {
            const visible = w.id === activeWorkspaceId && tab.id === w.activeTabId;

            return (
              <div
                key={tab.id}
                className={`absolute inset-0 px-2 ${visible ? '' : 'pointer-events-none invisible'}`}
              >
                <PaneLayout
                  root={tab.root}
                  active={visible}
                  focusedId={tab.focusedId}
                  fontSize={fontSize}
                  refocus={refocus}
                  startCwds={Object.fromEntries(Object.entries(tab.panes).map(([id, pane]) => [id, pane.cwd]))}
                  onFocus={(paneId) => focusPane(tab.id, paneId)}
                  onPaneExit={(paneId) => closePaneInTab(tab.id, paneId)}
                  onRootChange={(root) => setRoot(tab.id, root)}
                  onPaneInfo={(paneId, change) => updatePaneInfo(tab.id, paneId, change)}
                />
              </div>
            );
          }),
        )}
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
          onClick={() => setOverlay('shortcuts')}
          className="ml-auto shrink-0 cursor-pointer text-neutral-600 transition-colors hover:text-neutral-300"
        >
          ⌘/
        </button>
      </footer>

      {overlay === 'shortcuts' && <ShortcutSheet onClose={closeOverlay} />}
      {overlay === 'workspaces' && (
        <WorkspaceSwitcher
          workspaces={workspaces.map((w) => ({ id: w.id, name: w.name, color: w.color }))}
          activeId={activeWorkspaceId}
          onSwitch={switchWorkspace}
          onCreate={addWorkspace}
          onRename={renameWorkspace}
          onDelete={deleteWorkspace}
          onClose={closeOverlay}
        />
      )}
    </main>

  )
}

export default App;
