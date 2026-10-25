import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react'

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

        const terminal = new Terminal();
        const fitAddon = new FitAddon();

        terminalRef.current = terminal;
        terminal.loadAddon(fitAddon);
        terminal.open(containerRef.current);
        fitAddon.fit();

        const observer = new ResizeObserver(() => {
            fitAddon.fit();
        });

        observer.observe(containerRef.current);

        const disposable = terminal.onData((data: string) => {
            // TODO: Later send this to the backend
            console.log("User Typed: ", data);
        });

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

                const sessionId = await invoke<string>("create_session");
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
            disposable.dispose();
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