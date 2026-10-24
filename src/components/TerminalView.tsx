import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react'

const TerminalView = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);


    useEffect(() => {
        if (!containerRef.current) return

        const terminal = new Terminal();
        const fitAddon = new FitAddon();

        terminalRef.current = terminal

        terminalRef.current.loadAddon(fitAddon)

        terminal.open(containerRef.current)

        const observer = new ResizeObserver(() => {
            fitAddon.fit()
        })

        // start observing

        observer.observe(containerRef.current)



        const disposable = terminal.onData((data: string) => {
            //TODO: Later send this to the backend
            console.log("User Typed: ", data)
        })

        return () => {
            terminal.dispose();
            disposable.dispose();
            observer.disconnect();
            terminalRef.current = null
        }
    }, [])

    return (
        <div ref={containerRef} className='min-h-0 min-w-0 flex-1 overflow-hidden' />
    )
}

export default TerminalView