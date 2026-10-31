import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import type { IDisposable } from '@xterm/xterm';
import { useEffect, useRef} from 'react'
import { matchPaneAction } from '../keybindings';

type TerminalOutput = {
  terminal_id: string;
  data: number[];
}

const closeSession = (id: string) =>
  invoke("remove_session", { id }).catch((error) => {
    console.error("Failed to close terminal session:", error);
  });

type TerminalExit = {
  terminal_id: string;
}

type TerminalViewProps = {
  active: boolean;
  onExit: () => void;
}

const TerminalView = ({ active, onExit }: TerminalViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  const terminalRef = useRef<Terminal | null>(null);

  // set by the lifecycle effect; refits and focuses this terminal when it becomes visible
  const activateRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {

    if (!containerRef.current) return;
    let unlisten: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let pendingExits: string[] = [];
    let inputSubscription: IDisposable | undefined;
    let pendingOutput: TerminalOutput[] = [];
    let cancelled = false;
    let fontSize = 14;

    // Effect-local on purpose: a shared ref could be overwritten by a later
    // effect run (e.g. StrictMode remount) and cause the wrong session to close.
    let sessionId: string | null = null;

    let lastRows = 0;
    let lastCols = 0;

    const initializeTerminal = () => {
      const terminal = new Terminal({
              fontSize,
              fontFamily: 'ui-monospace, Menlo, monospace',
              cursorBlink: true,
              theme: { background: '#0b0d12', foreground: '#c9d1d9', cursor: '#c9d1d9' },
            });
      const fitAddon = new FitAddon();

      terminalRef.current = terminal;
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current!);

      return { terminal, fitAddon };
    };

    const {terminal, fitAddon} = initializeTerminal();

    const handleFontSizeChange = () => {
      terminal.attachCustomKeyEventHandler((event) => {
        // pane shortcuts belong to App, so xterm must not send them to the shell
        if (matchPaneAction(event)) return false;

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

        return false;
      });
    };

    const resizePty = () => {
      const id = sessionId;
      if (!id || cancelled) return;

      const rows = terminal.rows;
      const cols = terminal.cols;

      if (rows === lastRows && cols === lastCols) return;

      lastRows = rows;
      lastCols = cols;

      invoke("resize_session", {
        id,
        rows,
        cols,
      }).catch((error) => {
        console.error("resize_session", error);
      })
    };

    handleFontSizeChange();

    activateRef.current = () => {
      if (cancelled) return;

      fitAddon.fit();
      resizePty();
      terminal.focus();
    };

    const observer = new ResizeObserver(() => {
      if (cancelled) return;

      fitAddon.fit();

      resizePty();
    });

    observer.observe(containerRef.current);

    // Idempotent teardown, used for unmount and for setup failures.
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      cancelled = true;
      activateRef.current = undefined;

      unlisten?.();
      unlisten = undefined;
      unlistenExit?.();
      unlistenExit = undefined;
      pendingExits = [];
      observer.disconnect();
      inputSubscription?.dispose();
      inputSubscription = undefined;
      pendingOutput = [];

      const id = sessionId;
      sessionId = null;
      if (id) {
        void closeSession(id);
      }

      terminal.dispose();
      if (terminalRef.current === terminal) {
        terminalRef.current = null;
      }
    };

    const setup = async () => {
      try {
        //register the listener first, before session creation.
        const stopListening = await listen<TerminalOutput>("terminal-output", (event) => {
          if (cancelled) return;

          const output = event.payload

          if (sessionId === null) {
            pendingOutput.push(output);
            return;
          }
          if (output.terminal_id !== sessionId) return;

          terminal.write(new Uint8Array(output.data))
        });
        if (cancelled) {
          stopListening();
          return;
        }

        unlisten = stopListening;

        const stopListeningExit = await listen<TerminalExit>("terminal-exit", (event) => {
          if (cancelled) return;

          if (sessionId === null) {
            pendingExits.push(event.payload.terminal_id);
            return;
          }
          if (event.payload.terminal_id !== sessionId) return;

          onExitRef.current();
        });

        if (cancelled) {
          stopListeningExit();
          return;
        }

        unlistenExit = stopListeningExit;

        // size the terminal before asking the backend for a PTY
        fitAddon.fit();
        const rows = terminal.rows;
        const cols = terminal.cols;

        const createdId = await invoke<string>("create_session", { rows, cols });

        if (cancelled) {
          // unmounted while the session was being created: close it ourselves
          void closeSession(createdId);
          return;
        }

        sessionId = createdId;
        lastRows = rows;
        lastCols = cols;

        for (const output of pendingOutput) {
          if (output.terminal_id !== createdId) continue;

          terminal.write(new Uint8Array(output.data))
        }

        pendingOutput = [];

        // the shell may have exited before we knew our session id
        if (pendingExits.includes(createdId)) {
          onExitRef.current();
          return;
        }

        // send keyboard input to rust
        inputSubscription = terminal.onData((data: string) => {
          invoke("write_to_session", {
            id: createdId,
            input: data,
          }).catch((error) => {
            console.error("Failed to send terminal input:", error)
          })
        })

        // the container may have been resized while the session was starting
        resizePty();
      } catch (err) {
        console.error("Failed to initialize terminal session:", err);
        cleanup();
      }
    }

    setup();

    return cleanup;
  }, [])

  useEffect(() => {
    if (active) activateRef.current?.();
  }, [active])

  return (
    <div ref={containerRef} className='h-full w-full min-h-0 min-w-0 overflow-hidden' />
  )
}

export default TerminalView
