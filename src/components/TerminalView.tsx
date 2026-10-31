import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import type { IDisposable } from '@xterm/xterm';
import { useEffect, useRef} from 'react'
import { matchAction } from '../keybindings';

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
  fontSize: number;
  onExit: () => void;
}

const TerminalView = ({ active, fontSize, onExit }: TerminalViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // read once by the lifecycle effect so a new terminal starts at the current size
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  const terminalRef = useRef<Terminal | null>(null);

  // set by the lifecycle effect; refits and focuses this terminal when it becomes visible
  const activateRef = useRef<(() => void) | undefined>(undefined);

  // set by the lifecycle effect; refits the grid and tells the PTY, e.g. after a font change
  const refitRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {

    if (!containerRef.current) return;
    let unlisten: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let pendingExits: string[] = [];
    let inputSubscription: IDisposable | undefined;
    let pendingOutput: TerminalOutput[] = [];
    let cancelled = false;

    // Effect-local on purpose: a shared ref could be overwritten by a later
    // effect run (e.g. StrictMode remount) and cause the wrong session to close.
    let sessionId: string | null = null;

    let lastRows = 0;
    let lastCols = 0;

    const initializeTerminal = () => {
      const terminal = new Terminal({
              fontSize: fontSizeRef.current,
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

    // app shortcuts belong to App, so xterm must not send them to the shell
    terminal.attachCustomKeyEventHandler((event) => !matchAction(event));

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

    refitRef.current = () => {
      if (cancelled) return;

      fitAddon.fit();
      resizePty();
    };

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
      refitRef.current = undefined;

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

  // the font size is app-wide; the box doesn't change size, so the ResizeObserver won't refit for us
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal || terminal.options.fontSize === fontSize) return;

    terminal.options.fontSize = fontSize;
    refitRef.current?.();
  }, [fontSize])

  return (
    <div ref={containerRef} className='h-full w-full min-h-0 min-w-0 overflow-hidden' />
  )
}

export default TerminalView
