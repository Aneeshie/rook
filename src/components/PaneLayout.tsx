import { useEffect, useRef, useState } from "react";
import { computeLayout, PaneNode } from "../layout/paneTree"
import TerminalView from "./TerminalView";


type PaneLayoutProps = {
  root: PaneNode;
  active: boolean;
  focusedId: string;
  fontSize: number;
  onFocus: (paneId: string) => void;
  onPaneExit: (paneId: string) => void;
}

const PaneLayout = ({ root, active, focusedId, fontSize, onFocus, onPaneExit }: PaneLayoutProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 })

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

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {[...panes].map(([paneId, rect]) => (
        <div
          key={paneId}
          className="absolute"
          style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
          onMouseDown={() => onFocus(paneId)}
        >
          <TerminalView
            active={active && paneId === focusedId}
            fontSize={fontSize}
            onExit={() => onPaneExit(paneId)}
          />
        </div>
      ))}

      {dividers.map((divider) => (
        <div
          key={`${divider.path.join('.')}:${divider.index}`}
          className="absolute bg-[#1c212b]"
          style={{
            left: divider.rect.x,
            top: divider.rect.y,
            width: divider.rect.width,
            height: divider.rect.height,
          }}
        />
      ))}
    </div>
  )

}

export default PaneLayout