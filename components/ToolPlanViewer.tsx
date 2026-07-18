'use client'
import { useEffect, useState } from 'react'
import type { ToolPlan } from '@/lib/projects'

interface Props {
  plan: ToolPlan
  onRevealComplete: () => void
  autoReveal?: boolean
}

export default function ToolPlanViewer({ plan, onRevealComplete, autoReveal = false }: Props) {
  const [revealed, setRevealed] = useState('')
  const [done, setDone] = useState(false)
  const fullText = JSON.stringify(plan, null, 2)

  useEffect(() => {
    if (!autoReveal) return
    let i = 0
    setRevealed('')
    setDone(false)
    // Faster typewriter — 4ms per char, batched for speed
    const interval = setInterval(() => {
      const chunkSize = 6
      i += chunkSize
      setRevealed(fullText.slice(0, i))
      if (i >= fullText.length) {
        setRevealed(fullText)
        setDone(true)
        clearInterval(interval)
        onRevealComplete()
      }
    }, 20)
    return () => clearInterval(interval)
  }, [autoReveal, fullText, onRevealComplete])

  function skipReveal() {
    setRevealed(fullText)
    setDone(true)
    onRevealComplete()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: 'var(--green-dim)', fontSize: 11, letterSpacing: '0.08em' }}>
          ┌─[ TOOL_PLAN_JSON ]{'─'.repeat(40)}
        </span>
        {!done && autoReveal && (
          <button
            onClick={skipReveal}
            style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}
          >
            [SKIP →]
          </button>
        )}
      </div>

      {/* JSON content */}
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        padding: '14px',
        maxHeight: 340,
        overflowY: 'auto',
        position: 'relative',
      }}>
        <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          <SyntaxHighlight text={revealed} />
          {!done && <span className="cursor" style={{ color: 'var(--green)' }} />}
        </pre>
      </div>

      <div style={{ color: 'var(--green-dim)', fontSize: 11, marginTop: 4 }}>
        └{'─'.repeat(52)}┘
      </div>

      {done && (
        <div style={{ color: 'var(--green)', fontSize: 11, marginTop: 8 }}>
          {'>'} TOOL_PLAN_JSON generated. Executing steps...
        </div>
      )}
    </div>
  )
}

// Minimal JSON syntax highlighter
function SyntaxHighlight({ text }: { text: string }) {
  const parts: { text: string; cls: string }[] = []
  // Tokenize line by line for simplicity
  const lines = text.split('\n')
  for (const line of lines) {
    // Key: "something":
    const keyMatch = line.match(/^(\s*)("[\w_]+")(\s*:\s*)(.*)$/)
    if (keyMatch) {
      parts.push(
        { text: keyMatch[1], cls: '' },
        { text: keyMatch[2], cls: 'json-key' },
        { text: keyMatch[3], cls: '' },
        ...tokenizeValue(keyMatch[4]),
        { text: '\n', cls: '' },
      )
      continue
    }
    // Array item or plain value
    const trimmed = line.trimStart()
    if (trimmed.startsWith('"') || trimmed.match(/^-?[0-9]/) || trimmed === 'true' || trimmed === 'false' || trimmed === 'null') {
      const indent = line.slice(0, line.length - trimmed.length)
      parts.push({ text: indent, cls: '' }, ...tokenizeValue(trimmed), { text: '\n', cls: '' })
    } else {
      parts.push({ text: line + '\n', cls: '' })
    }
  }

  return (
    <>
      {parts.map((p, i) =>
        p.cls
          ? <span key={i} className={p.cls}>{p.text}</span>
          : <span key={i} style={{ color: 'var(--white)' }}>{p.text}</span>
      )}
    </>
  )
}

function tokenizeValue(val: string): { text: string; cls: string }[] {
  const v = val.trim().replace(/,\s*$/, '')
  const suffix = val.endsWith(',') ? ',' : ''
  if (v.startsWith('"')) return [{ text: v + suffix, cls: 'json-str' }]
  if (v === 'true' || v === 'false') return [{ text: v + suffix, cls: 'json-bool' }]
  if (v === 'null') return [{ text: v + suffix, cls: 'json-null' }]
  if (!isNaN(Number(v)) && v !== '') return [{ text: v + suffix, cls: 'json-num' }]
  return [{ text: val, cls: '' }]
}
