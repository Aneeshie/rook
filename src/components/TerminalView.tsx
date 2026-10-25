import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef} from 'react'

type TerminalOutput = {
  terminal_id: string;
  data: number[];
}

const TerminalView = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const terminalRef = useRef<Terminal | null>(null);

  const sessionIdRef = useRef<string | null>(null);


  useEffect(() => {

    if (!containerRef.current) return;
    let unlisten: (() => void) | undefined;
    let pendingOutput: TerminalOutput[] = [];
    let cancelled = false;
    let fontSize = 14;

    let lastRows = 0;
    let lastCols = 0;

    const initializeTerminal = () => {
      const terminal = new Terminal({ fontSize });
      const fitAddon = new FitAddon();

      terminalRef.current = terminal;
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current!);

      return { terminal, fitAddon };
    };

    const {terminal, fitAddon} = initializeTerminal();

    const handleFontSizeChange = () => {
      terminal.attachCustomKeyEventHandler((event) => {
        if (!event.metaKey || event.type !== "keydown") {
          return true;
        }

        if (event.key === "+" || event.key === "=") {
          fontSize = Math.min(fontSize + 1, 32);
        } else if (event.key === "-" || event.key === "_") {
          fontSize = Math.max(fontSize - 1, 10);
        } else if (event.key === "0") {
          fontSize = 14;
        } else {
          return true;
        }

        terminal.options.fontSize = fontSize;
        fitAddon.fit();
        resizePty();

        console.log({
          fontSize: terminal.options.fontSize,
          cols: terminal.cols,
          rows: terminal.rows,
        });

        console.log("Font size:", fontSize);

        return false;
      });
    };

    const resizePty = () => {
      const id = sessionIdRef.current;
      if (!id) return;

      const rows = terminal.rows;
      const cols = terminal.cols;

      if (rows === lastRows && cols === lastCols) return;

      lastRows = rows;
      lastCols = cols;

      console.log("Sending PTY resize:", { id, rows, cols });

      invoke("resize_session", {
        id,
        rows,
        cols,
      }).catch((error) => {
        console.error("resize_session", error);
      })
    };

    handleFontSizeChange();

    const observer = new ResizeObserver(() => {
      fitAddon.fit();

      resizePty();
    });

    observer.observe(containerRef.current);

    const setup = async () => {
      try {
        //register the listener first, before session creation.
        const stopListening = await listen<TerminalOutput>("terminal-output", (event) => {
          const output = event.payload

          if (sessionIdRef.current === null) {
            pendingOutput.push(output);
            return;
          }
          if (output.terminal_id !== sessionIdRef.current) return;

          terminal.write(new Uint8Array(output.data))
        });

        if (cancelled) {
          stopListening();
          return;
        }

        unlisten = stopListening;

        const sessionId = await invoke<string>("create_session", { rows: terminal.rows, cols: terminal.cols });
        sessionIdRef.current = sessionId;

        for (const output of pendingOutput) {
          if (output.terminal_id !== sessionId) continue;

          terminal.write(new Uint8Array(output.data))
        }

        pendingOutput = [];

        // send keyboard input to rust
        terminal.onData((data: string) => {
          invoke("write_to_session", {
            id: sessionId,
            input: data,
          }).catch((error) => {
            console.error("Failed to send terminal input:", error)
          })
        })
      } catch (err) {
        console.error("Failed to initialize terminal session:", err);
      }
    }

    setup();

    return () => {
      cancelled = true;
      unlisten?.();
      observer.disconnect();
      terminal.dispose();
      terminalRef.current = null;
    }
  }, [])

  return (
    <div ref={containerRef} className='min-h-0 min-w-0 flex-1 overflow-hidden' />
  )
}

export default TerminalView
