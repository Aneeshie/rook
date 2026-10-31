import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import type { IDisposable, IMarker } from '@xterm/xterm';
import { useEffect, useRef } from 'react'
import { matchAction } from '../keybindings';
import { FONT_FAMILY, TERMINAL_THEME } from '../theme';

const FAILED_COLOR = '#f47067';
const FAILED_TINT = 'rgba(244, 112, 103, 0.07)';
const FAILED_ACCENT = 'rgba(244, 112, 103, 0.7)';
const FAILED_BADGE = 'rgba(244, 112, 103, 0.15)';


export type CommandStatus = | { state: 'running' } | { state: 'done', exitCode: number };
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
  onCwdChange: (cwd: string) => void;
  onBranchChange: (branch: string) => void;
  onCommandStatus: (status: CommandStatus) => void;
  onCommandChange: (command: string) => void;
  onSizeChange: (cols: number, rows: number) => void;
}

const TerminalView = ({
  active,
  fontSize,
  onExit,
  onCwdChange,
  onBranchChange,
  onCommandStatus,
  onCommandChange,
  onSizeChange,
}: TerminalViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // read once by the lifecycle effect so a new terminal starts at the current size
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  const onCwdChangeRef = useRef(onCwdChange);
  onCwdChangeRef.current = onCwdChange

  const onBranchChangeRef = useRef(onBranchChange)
  onBranchChangeRef.current = onBranchChange

  const onCommandStatusRef = useRef(onCommandStatus);
  onCommandStatusRef.current = onCommandStatus

  const onCommandChangeRef = useRef(onCommandChange);
  onCommandChangeRef.current = onCommandChange;

  const onSizeChangeRef = useRef(onSizeChange);
  onSizeChangeRef.current = onSizeChange;

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
    let commandStart: IMarker | undefined;

    // Effect-local on purpose: a shared ref could be overwritten by a later
    // effect run (e.g. StrictMode remount) and cause the wrong session to close.
    let sessionId: string | null = null;

    let lastRows = 0;
    let lastCols = 0;

    const initializeTerminal = () => {
      const terminal = new Terminal({
        fontSize: fontSizeRef.current,
        fontFamily: FONT_FAMILY,
        cursorBlink: true,
        theme: TERMINAL_THEME,
        // registerDecoration is still "proposed" API and throws without this
        allowProposedApi: true,
      });
      const fitAddon = new FitAddon();

      terminalRef.current = terminal;
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current!);

      return { terminal, fitAddon };
    };

    const { terminal, fitAddon } = initializeTerminal();

    // app shortcuts belong to App, so xterm must not send them to the shell
    terminal.attachCustomKeyEventHandler((event) => !matchAction(event));

    // cols × rows for the footer; fires whenever a fit changes the grid
    terminal.onResize(({ cols, rows }) => onSizeChangeRef.current(cols, rows));

    terminal.parser.registerOscHandler(7, (data) => {
      try {
        const path = decodeURIComponent(new URL(data).pathname);
        onCwdChangeRef.current(path);
      } catch {
        // not a valid file ignore it
      }
      return true;
    })

    terminal.parser.registerOscHandler(7777, (data) => {
      if (data.startsWith('branch=')) {
        onBranchChangeRef.current(data.slice('branch='.length))
      } else if (data.startsWith('command=')) {
        onCommandChangeRef.current(data.slice('command='.length));
      }

      return true
    })

    const markFailedCommand = (start: IMarker, exitCode: number) => {
      const buffer = terminal.buffer.active;
      const cursorLine = buffer.baseY + buffer.cursorY;

      const endLine = cursorLine + (buffer.cursorX > 0 ? 1 : 0);

      // the block starts at the command line (the line above the output), so it covers command + output
      const commandLine = terminal.registerMarker(start.line - 1 - cursorLine);
      const height = endLine - commandLine.line;
      start.dispose(); // commandLine marks the block from here on

      // layer 'bottom' draws behind the text, so the tint never dims what's written on top
      const block = terminal.registerDecoration({
        marker: commandLine,
        width: terminal.cols,
        height,
        layer: 'bottom',
      });
      block?.onRender((element) => {
        element.style.background = FAILED_TINT;
        element.style.boxShadow = `inset 3px 0 0 ${FAILED_ACCENT}`; // a left accent bar that takes no space
        element.style.borderRadius = '4px';
        element.style.pointerEvents = 'none'; // don't block selecting the text underneath
      });

      const label = `✗ exit ${exitCode}`;
      const badge = terminal.registerDecoration({
        marker: commandLine,
        anchor: 'right',
        width: label.length + 2,
      });
      badge?.onRender((element) => {
        element.textContent = label;
        element.style.right = '0'; // anchor: 'right' alone doesn't place it without an x offset
        element.style.fontFamily = FONT_FAMILY;
        element.style.fontSize = `${Math.max((terminal.options.fontSize ?? 14) - 2, 10)}px`;
        element.style.color = FAILED_COLOR;
        element.style.background = FAILED_BADGE;
        element.style.borderRadius = '4px';
        element.style.textAlign = 'center';
        element.style.pointerEvents = 'none';
      });
    }

    terminal.parser.registerOscHandler(133, (data) => {
      const [kind, exitCode] = data.split(';');

      if (kind === 'C') {
        commandStart?.dispose();
        commandStart = terminal.registerMarker(0);
        onCommandStatusRef.current({ state: 'running' });
      } else if (kind === 'D') {
        const code = Number(exitCode);
        onCommandStatusRef.current({ state: 'done', exitCode: code });


        if (commandStart && code !== 0 && code !== 130) {
          markFailedCommand(commandStart, code);
        } else {
          commandStart?.dispose();
        }
        commandStart = undefined;
      }

      return true;
    });


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
        onSizeChangeRef.current(terminal.cols, terminal.rows); // onResize doesn't fire if the fit changed nothing
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
