'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

interface TermLine {
  id: number
  type: 'input' | 'output' | 'error' | 'info' | 'system'
  text: string
  duration_ms?: number
}

const WELCOME: TermLine[] = [
  { id: 0, type: 'system', text: '╔══════════════════════════════════════════════════════╗' },
  { id: 1, type: 'system', text: '║  AI HELPER — LIVE TERMINAL                          ║' },
  { id: 2, type: 'system', text: '║  Your machine. Your commands. Real output.          ║' },
  { id: 3, type: 'system', text: '╚══════════════════════════════════════════════════════╝' },
  { id: 4, type: 'info',   text: 'Type any bash command and press Enter.' },
  { id: 5, type: 'info',   text: 'Commands run on YOUR Linux system via /api/terminal' },
  { id: 6, type: 'info',   text: 'Try: uname -a | df -h | adb devices | free -m' },
  { id: 7, type: 'system', text: '──────────────────────────────────────────────────────' },
]

export default function TerminalPage() {
  const [lines, setLines] = useState<TermLine[]>(WELCOME)
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [cwd, setCwd] = useState('')  // empty = server resolves to homedir()
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  let lineId = useRef(100)

  // Auto-scroll on new output
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines.length])

  // Focus input on click anywhere
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const addLine = useCallback((type: TermLine['type'], text: string, duration_ms?: number) => {
    const id = lineId.current++
    setLines(prev => [...prev, { id, type, text, duration_ms }])
  }, [])

  const runCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim()
    if (!trimmed) return

    // Add to history
    setHistory(prev => [trimmed, ...prev.slice(0, 99)])
    setHistIdx(-1)

    // Show the input line — display ~ instead of raw home path
    const displayCwd = (cwd || '~').replace(/^\/home\/[^/]+/, '~')
    addLine('input', `${displayCwd} $ ${trimmed}`)
    setInput('')
    setRunning(true)

    // Handle built-in commands
    if (trimmed === 'clear') {
      setLines(WELCOME)
      setRunning(false)
      return
    }
    if (trimmed === 'help') {
      addLine('info', 'Built-ins: clear, help, cd <path>')
      addLine('info', 'Everything else runs as real bash on your Linux system.')
      addLine('info', 'ADB commands: adb devices, adb shell <cmd>')
      addLine('info', 'System: uname -a, df -h, free -m, top -bn1, ps aux')
      setRunning(false)
      return
    }
    // Handle cd — run it as a real command and capture the new pwd
    if (trimmed.startsWith('cd') ) {
      const target = trimmed.slice(2).trim() || ''
      const cdCmd = target ? `cd ${target} && pwd` : 'cd && pwd'
      try {
        const res = await fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cdCmd, timeout_seconds: 10, cwd: cwd || undefined }),
        })
        const data = await res.json()
        if (data.status === 'success' && data.stdout.trim()) {
          const newCwd = data.stdout.trim()
          setCwd(newCwd)
          addLine('info', `[cd → ${newCwd}]`)
        } else {
          addLine('error', data.stderr || '[cd failed]')
        }
      } catch (err) {
        addLine('error', `[Network error: ${String(err)}]`)
      } finally {
        setRunning(false)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      return
    }

    try {
      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: trimmed, timeout_seconds: 30, cwd: cwd || undefined }),
      })
      const data = await res.json()

      if (data.stdout) {
        // trim trailing newline then split
        const outLines = data.stdout.replace(/\n$/, '').split('\n')
        outLines.forEach((line: string) => addLine('output', line))
      }
      if (data.stderr) {
        data.stderr.replace(/\n$/, '').split('\n').filter(Boolean).forEach((line: string) => {
          addLine('error', line)
        })
      }
      if (data.status === 'error' && !data.stdout && !data.stderr) {
        addLine('error', `[Exit ${data.exit_code}]`)
      }
      addLine('info', `[${data.duration_ms}ms | exit ${data.exit_code ?? 0}]`)
    } catch (err) {
      addLine('error', `[Network error — is pnpm start running? ${String(err)}]`)
    } finally {
      setRunning(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [cwd, addLine])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand(input)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(next)
      setInput(history[next] ?? '')
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.max(histIdx - 1, -1)
      setHistIdx(next)
      setInput(next === -1 ? '' : history[next])
      return
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines(WELCOME)
      return
    }
  }, [input, history, histIdx, runCommand])

  return (
    <div
      style={{ maxWidth: 900, cursor: 'text' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: 'var(--green-dim)', fontSize: 11 }}>LIVE TERMINAL</div>
          <h1 className="glow" style={{ color: 'var(--green)', fontSize: 18, fontWeight: 700, margin: '4px 0' }}>
            Interactive Shell
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" style={{ fontSize: 10, padding: '4px 12px' }}
            onClick={() => runCommand('uname -a')}>uname -a</button>
          <button className="btn-primary" style={{ fontSize: 10, padding: '4px 12px' }}
            onClick={() => runCommand('df -h')}>df -h</button>
          <button className="btn-primary" style={{ fontSize: 10, padding: '4px 12px' }}
            onClick={() => runCommand('free -m')}>free -m</button>
          <button className="btn-primary" style={{ fontSize: 10, padding: '4px 12px' }}
            onClick={() => runCommand('adb devices')}>adb devices</button>
        </div>
      </div>

      {/* Terminal window */}
      <div
        style={{
          background: '#050505',
          border: '1px solid var(--border)',
          padding: '12px',
          height: 520,
          overflowY: 'auto',
          fontFamily: 'inherit',
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        {lines.map(line => (
          <div key={line.id} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <span style={{
              color: line.type === 'input'  ? 'var(--green)'
                   : line.type === 'error'  ? 'var(--red)'
                   : line.type === 'system' ? 'var(--green-dim)'
                   : line.type === 'info'   ? 'var(--amber)'
                   : 'var(--white)',
            }}>
              {line.text}
            </span>
            {line.duration_ms != null && line.type !== 'info' && (
              <span style={{ color: 'var(--green-dim)', fontSize: 10, marginLeft: 8 }}>
                [{line.duration_ms}ms]
              </span>
            )}
          </div>
        ))}

        {/* Live input line */}
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
          <span style={{ color: 'var(--green)', marginRight: 6, whiteSpace: 'nowrap' }}>
            {cwd ? cwd.replace(/^\/home\/[^/]+/, '~') : '~'} $
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={running}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--green)',
              fontFamily: 'inherit',
              fontSize: 12,
              caretColor: 'var(--green)',
            }}
            placeholder={running ? 'running...' : ''}
            autoComplete="off"
            spellCheck={false}
          />
          {running && (
            <span style={{ color: 'var(--amber)', fontSize: 11, animation: 'blink 0.5s step-end infinite' }}>
              ▋
            </span>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Footer hints */}
      <div style={{ marginTop: 8, display: 'flex', gap: 20, color: 'var(--green-dim)', fontSize: 10 }}>
        <span>↑↓ history</span>
        <span>Ctrl+L clear</span>
        <span>Enter run</span>
        <span style={{ color: 'var(--amber)' }}>All commands run real bash on your Linux system</span>
      </div>
    </div>
  )
}
