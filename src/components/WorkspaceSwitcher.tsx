import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

export type WorkspaceSummary = {
  id: string;
  name: string;
  color: string;
};

type WorkspaceSwitcherProps = {
  workspaces: WorkspaceSummary[];
  activeId: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

type Item = { kind: 'workspace'; workspace: WorkspaceSummary } | { kind: 'create'; name: string };

// one box that does it all: type to filter, Enter to switch, or Enter on "create" for a new one
const WorkspaceSwitcher = ({
  workspaces,
  activeId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
  onClose,
}: WorkspaceSwitcherProps) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => Math.max(0, workspaces.findIndex((w) => w.id === activeId)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const matches = workspaces.filter((w) => w.name.toLowerCase().includes(trimmed.toLowerCase()));
  const exact = workspaces.some((w) => w.name.toLowerCase() === trimmed.toLowerCase());

  const items: Item[] = [
    ...matches.map((workspace): Item => ({ kind: 'workspace', workspace })),
    ...(trimmed && !exact ? [{ kind: 'create', name: trimmed } as Item] : []),
  ];

  // keep the highlight inside the list as it shrinks while typing
  useEffect(() => {
    setSelected((index) => Math.min(index, Math.max(items.length - 1, 0)));
  }, [items.length]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === 'create') onCreate(item.name);
    else onSwitch(item.workspace.id);
  };

  const startRename = (workspace: WorkspaceSummary) => {
    setEditingId(workspace.id);
    setEditName(workspace.name);
  };

  const finishRename = () => {
    if (editingId && editName.trim()) onRename(editingId, editName.trim());
    setEditingId(null);
    inputRef.current?.focus();
  };

  const confirming = workspaces.find((w) => w.id === confirmDeleteId);

  // deleting closes every shell in the workspace, so it always asks first; the last one can't go
  const askToDelete = (workspace: WorkspaceSummary) => {
    if (workspaces.length > 1) setConfirmDeleteId(workspace.id);
  };

  // focus goes back to the search box after the row re-renders, or the clicked button keeps it
  const refocusSearch = () => requestAnimationFrame(() => inputRef.current?.focus());

  const confirmDelete = () => {
    if (confirming) onDelete(confirming.id);
    setConfirmDeleteId(null);
    refocusSearch();
  };

  const cancelDelete = () => {
    setConfirmDeleteId(null);
    refocusSearch();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    // while a delete is being confirmed, Enter confirms and Esc only cancels it
    if (confirming) {
      if (event.key === 'Enter') {
        event.preventDefault();
        confirmDelete();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelDelete();
      }
      return;
    }

    if (event.metaKey && event.key === 'Backspace') {
      event.preventDefault();
      const item = items[selected];
      if (item?.kind === 'workspace') askToDelete(item.workspace);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'j')) {
      event.preventDefault();
      setSelected((index) => (index + 1) % Math.max(items.length, 1));
    } else if (event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'k')) {
      event.preventDefault();
      setSelected((index) => (index - 1 + items.length) % Math.max(items.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(items[selected]);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/40 pt-[18vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        className="w-[min(30rem,92vw)] overflow-hidden rounded-xl border border-fg/5 bg-surface shadow-2xl shadow-black/50"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Switch or create workspace…"
          spellCheck={false}
          className="w-full border-b border-fg/5 bg-transparent px-4 py-3 text-ui text-fg outline-none placeholder:text-faint"
        />

        <div className="max-h-72 overflow-y-auto p-1.5">
          {items.map((item, index) => {
            const highlighted = index === selected;
            const rowClass = `group flex h-9 cursor-pointer items-center gap-3 rounded-md px-3 text-ui ${
              highlighted ? 'bg-fg/[0.06] text-fg' : 'text-soft'
            }`;

            if (item.kind === 'create') {
              return (
                <div key="create" className={rowClass} onMouseEnter={() => setSelected(index)} onClick={() => choose(item)}>
                  <Plus size={13} className="text-muted" />
                  <span>
                    Create <span className="text-fg">{item.name}</span>
                  </span>
                </div>
              );
            }

            const { workspace } = item;
            const isActive = workspace.id === activeId;

            if (confirming?.id === workspace.id) {
              return (
                <div
                  key={workspace.id}
                  className="flex min-h-9 items-center gap-3 rounded-md bg-danger/10 py-1.5 pr-1.5 pl-3 text-ui"
                >
                  <span className="min-w-0 flex-1 break-words text-soft">
                    Delete <span className="text-fg">{workspace.name}</span>? Its shells will close.
                  </span>
                  <button
                    type="button"
                    onClick={cancelDelete}
                    className="cursor-pointer rounded-md px-2 py-1 text-ui-sm text-soft transition-colors hover:bg-fg/5 hover:text-fg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="cursor-pointer rounded-md bg-danger px-2 py-1 text-ui-sm text-bg transition-opacity hover:opacity-90"
                  >
                    Delete
                  </button>
                </div>
              );
            }

            const position = workspaces.indexOf(workspace) + 1;

            return (
              <div
                key={workspace.id}
                className={rowClass}
                onMouseEnter={() => setSelected(index)}
                onClick={() => editingId !== workspace.id && choose(item)}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: workspace.color }} />

                {editingId === workspace.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={finishRename}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') finishRename();
                      if (event.key === 'Escape') {
                        event.stopPropagation();
                        setEditingId(null);
                        inputRef.current?.focus();
                      }
                    }}
                    spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent text-fg outline-none"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                )}

                {/* actions appear on hover; the tab count and shortcut otherwise */}
                <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={`Rename ${workspace.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      startRename(workspace);
                    }}
                    className="cursor-pointer rounded p-1 text-muted hover:bg-fg/5 hover:text-fg"
                  >
                    <Pencil size={12} />
                  </button>
                  {workspaces.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Delete ${workspace.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        askToDelete(workspace);
                      }}
                      className="cursor-pointer rounded p-1 text-muted hover:bg-fg/5 hover:text-danger"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>

                <span className="w-14 shrink-0 text-right text-ui-sm text-faint group-hover:hidden">
                  {isActive ? 'current' : position <= 9 ? `⌘⌥${position}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSwitcher;
