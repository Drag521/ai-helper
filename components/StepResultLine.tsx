'use client'
import { useState } from 'react'
import type { StepResult } from '@/lib/store'

interface Props {
  result: StepResult
  stepIndex: number
  isRunning?: boolean
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: '[ .... ]', cls: 'badge-pending' },
  running: { label: '[ RUN  ]', cls: 'badge-running' },
  success: { label: '[  OK  ]', cls: 'badge-ok' },
  fail:    { label: '[ FAIL ]', cls: 'badge-fail' },
  skipped: { label: '[ SKIP ]', cls: 'badge-skip' },
}

export default function StepResultLine({ result, stepIndex, isRunning }: Props) {
  const [expanded, setExpanded] = useState(false)
  const badge = STATUS_BADGE[result.status] ?? STATUS_BADGE.pending
  const hasOutput = result.stdout || result.stderr

  return (
    <div className="step-line" style={{ marginBottom: 4 }}>
      {/* Main line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '4px 0',
          cursor: hasOutput ? 'pointer' : 'default',
          borderBottom: expanded ? '1px solid var(--border)' : 'none',
        }}
        onClick={() => hasOutput && setExpanded(e => !e)}
      >
        {/* Step number */}
        <span style={{ color: 'var(--green-dim)', fontSize: 10, minWidth: 28, paddingTop: 1 }}>
          {String(stepIndex + 1).padStart(2, '0')}.
        </span>

        {/* Status badge */}
        <span
          className={badge.cls}
          style={{ fontSize: 10, padding: '1px 4px', minWidth: 72, textAlign: 'center', fontFamily: 'inherit' }}
        >
          {isRunning && result.status === 'running' ? (
            <span style={{ animation: 'blink 0.5s step-end infinite' }}>{badge.label}</span>
          ) : badge.label}
        </span>

        {/* Step ID */}
        <span style={{ color: 'var(--cyan)', fontSize: 11, minWidth: 48 }}>
          {result.step_id}
        </span>

        {/* Summary */}
        <span style={{
          flex: 1,
          fontSize: 11,
          color: result.status === 'success' ? 'var(--green)'
               : result.status === 'fail'    ? 'var(--red)'
               : result.status === 'running' ? 'var(--amber)'
               : result.status === 'skipped' ? 'var(--muted)'
               : 'var(--green-dim)',
          wordBreak: 'break-word',
        }}>
          {result.summary}
        </span>

        {/* Duration */}
        {result.duration_ms != null && (
          <span style={{ color: 'var(--green-dim)', fontSize: 10, whiteSpace: 'nowrap' }}>
            {result.duration_ms < 1000
              ? `${result.duration_ms}ms`
              : `${(result.duration_ms / 1000).toFixed(1)}s`}
          </span>
        )}

        {/* Expand toggle */}
        {hasOutput && (
          <span style={{ color: 'var(--green-dim)', fontSize: 10, minWidth: 12 }}>
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {/* Expanded output */}
      {expanded && hasOutput && (
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          padding: '8px 12px',
          margin: '4px 0 4px 88px',
          fontSize: 11,
          lineHeight: 1.6,
        }}>
          {result.stdout && (
            <div>
              <div style={{ color: 'var(--green-dim)', fontSize: 10, marginBottom: 4 }}>STDOUT:</div>
              <pre style={{ color: 'var(--white)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {result.stdout}
              </pre>
            </div>
          )}
          {result.stderr && (
            <div style={{ marginTop: result.stdout ? 8 : 0 }}>
              <div style={{ color: 'var(--red)', fontSize: 10, marginBottom: 4 }}>STDERR:</div>
              <pre style={{ color: '#FF8888', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {result.stderr}
              </pre>
            </div>
          )}
          <div style={{ color: 'var(--green-dim)', fontSize: 10, marginTop: 6 }}>
            TIMESTAMP: {result.timestamp}
            {result.retried && <span style={{ color: 'var(--amber)', marginLeft: 12 }}>↺ RETRIED</span>}
          </div>
        </div>
      )}
    </div>
  )
}
