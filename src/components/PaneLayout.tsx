import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { computeLayout, Divider, PaneNode, resizeDivider } from "../layout/paneTree"
import TerminalView, { CommandStatus } from "./TerminalView";

// extra invisible width on each side of a divider, so the 4px line is easy to grab
const DIVIDER_GRAB = 3;

// everything a pane's shell has told us about itself
export type PaneInfo = {
  cwd?: string;
  branch?: string; // '' outside a repo
  status?: CommandStatus;
  command?: string; // what's running right now, '' at the prompt
  cols?: number;
  rows?: number;
};

type PaneLayoutProps = {
  root: PaneNode;
  active: boolean;
  focusedId: string;
  fontSize: number;
  refocus: number;
  onFocus: (paneId: string) => void;
  onPaneExit: (paneId: string) => void;
  onRootChange: (root: PaneNode) => void;
  onPaneInfo: (paneId: string, change: PaneInfo) => void;
}

type Drag = {
  divider: Divider;
  startRoot: PaneNode; // the tree when the drag began
  startPosition: number; // pointer x (row) or y (column) when the drag began
};

const PaneLayout = ({ root, active, focusedId, fontSize, refocus, onFocus, onPaneExit, onRootChange, onPaneInfo }: PaneLayoutProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 })
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  //measure our own box: this is R
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    })

    observer.observe(element);

    return () => observer.disconnect()
  }, []);

  // L(root, (0,0,width,height))

  const { panes, dividers } = computeLayout(root, { x: 0, y: 0, ...size });

  const dividerKey = (divider: Divider) => `${divider.path.join('.')}:${divider.index}`;
  const pointerPosition = (event: ReactPointerEvent, divider: Divider) =>
    divider.axis === 'row' ? event.clientX : event.clientY;

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, divider: Divider) => {
    event.preventDefault(); // don't start a text selection or steal focus from the terminal
    event.currentTarget.setPointerCapture(event.pointerId); // keep getting moves even off the divider

    dragRef.current = { divider, startRoot: root, startPosition: pointerPosition(event, divider) };
    setDragging(dividerKey(divider));
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    // δ = Δ / available, always measured from where the drag started, so clamping never
    // lets the divider drift away from the pointer
    const moved = pointerPosition(event, drag.divider) - drag.startPosition;
    const delta = moved / drag.divider.available;

    onRootChange(resizeDivider(drag.startRoot, drag.divider.path, drag.divider.index, delta));
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(null);
  };

  // with several panes, the ones not receiving keys fade back; no labels needed
  const dimUnfocused = panes.size > 1;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {[...panes].map(([paneId, rect]) => {
        const focused = paneId === focusedId;

        return (
          <div
            key={paneId}
            className={`absolute px-3 py-2 transition-opacity duration-200 ${ // padding keeps the text off the dividers
              dimUnfocused && !focused ? 'opacity-45' : ''
            }`}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
            onMouseDown={() => onFocus(paneId)}
          >
            <TerminalView
              active={active && focused}
              refocus={refocus}
              fontSize={fontSize}
              onExit={() => onPaneExit(paneId)}
              onCwdChange={(cwd) => onPaneInfo(paneId, { cwd })}
              onBranchChange={(branch) => onPaneInfo(paneId, { branch })}
              onCommandStatus={(status) => onPaneInfo(paneId, { status })}
              onCommandChange={(command) => onPaneInfo(paneId, { command })}
              onSizeChange={(cols, rows) => onPaneInfo(paneId, { cols, rows })}
            />
          </div>
        );
      })}

      {dividers.map((divider) => {
        const key = dividerKey(divider);
        const isRow = divider.axis === 'row';

        return (
          // the outer box is the wider grab area, the inner one is the visible line
          <div
            key={key}
            className={`group absolute z-10 ${isRow ? 'cursor-col-resize' : 'cursor-row-resize'}`}
            style={
              isRow
                ? {
                  left: divider.rect.x - DIVIDER_GRAB,
                  top: divider.rect.y,
                  width: divider.rect.width + DIVIDER_GRAB * 2,
                  height: divider.rect.height,
                }
                : {
                  left: divider.rect.x,
                  top: divider.rect.y - DIVIDER_GRAB,
                  width: divider.rect.width,
                  height: divider.rect.height + DIVIDER_GRAB * 2,
                }
            }
            onPointerDown={(event) => startDrag(event, divider)}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div
              className={`absolute transition-colors ${
                dragging === key ? 'bg-[#e5b05a]' : 'bg-white/[0.06] group-hover:bg-white/20'
              }`}
              // a hairline in the middle of the gap; the gap itself stays as breathing room
              style={
                isRow
                  ? { left: DIVIDER_GRAB + (divider.rect.width - 1) / 2, top: 0, width: 1, height: '100%' }
                  : { left: 0, top: DIVIDER_GRAB + (divider.rect.height - 1) / 2, width: '100%', height: 1 }
              }
            />
          </div>
        );
      })}
    </div>
  )

}

export default PaneLayout
