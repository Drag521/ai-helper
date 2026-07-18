'use client'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PROJECTS } from '@/lib/projects'
import type { RunRecord, StepResult } from '@/lib/store'

export default function LogsPage() {
  const runHistory = useStore(s => s.runHistory)
  const chronicFailures = useStore(s => s.chronicFailures)
  const clearHistory = useStore(s => s.clearHistory)
  const clearChronicFailure = useStore(s => s.clearChronicFailure)

  const [filterProject, setFilterProject] = useState<string>('all')
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const filtered = filterProject === 'all'
    ? runHistory
    : runHistory.filter(r => r.project_id === filterProject)

  function toggleExpand(id: string) {
    setExpandedRun(prev => prev === id ? null : id)
  }

  function handleClear() {
    clearHistory(filterProject === 'all' ? undefined : filterProject)
    setShowClearConfirm(false)
  }

  function formatDuration(r: RunRecord) {
    if (!r.finished_at) return '...'
    const ms = new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: 'var(--green-dim)', fontSize: 11 }}>LOGS VIEWER</div>
        <h1 className="glow" style={{ color: 'var(--green)', fontSize: 18, fontWeight: 700, margin: '4px 0', letterSpacing: '0.04em' }}>
          Run History
        </h1>
        <div style={{ color: 'var(--muted)', fontSize: 11 }}>
          {runHistory.length} total runs stored
          {chronicFailures.length > 0 && (
            <span style={{ color: 'var(--amber)', marginLeft: 12 }}>
              ⚠ {chronicFailures.length} chronic failure{chronicFailures.length > 1 ? 's' : ''} detected
            </span>
          )}
        </div>
      </div>

      {/* Chronic failures panel */}
      {chronicFailures.length > 0 && (
        <div style={{ marginBottom: 20, border: '1px solid rgba(255,176,0,0.35)', background: 'rgba(255,176,0,0.04)', padding: '12px 16px' }}>
          <div style={{ color: 'var(--amber)', fontSize: 11, marginBottom: 8, letterSpacing: '0.06em' }}>
            ⚠ CHRONIC FAILURES — Steps failing 3+ times in a row
          </div>
          {chronicFailures.map(cf => (
            <div key={`${cf.project_id}_${cf.step_id}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 6, fontSize: 11 }}>
              <span className="badge-fail" style={{ padding: '1px 7px', fontSize: 10, whiteSpace: 'nowrap' }}>
                {cf.fail_count}× FAIL
              </span>
              <span style={{ color: 'var(--cyan)' }}>{cf.project_id}</span>
              <span style={{ color: 'var(--amber)' }}>{cf.step_id}</span>
              <span style={{ color: 'var(--muted)', flex: 1, wordBreak: 'break-word' }}>{cf.last_error.slice(0, 100)}</span>
              <button
                onClick={() => clearChronicFailure(cf.project_id, cf.step_id)}
                style={{ background: 'none', border: 'none', color: 'var(--green-dim)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, padding: 0, whiteSpace: 'nowrap' }}
              >
                [CLEAR]
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filters + clear */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: 'var(--green-dim)', fontSize: 11 }}>FILTER:</div>
        <select
          className="term-input"
          style={{ width: 'auto', minWidth: 160 }}
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
        >
          <option value="all">ALL PROJECTS</option>
          {PROJECTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!showClearConfirm ? (
            <button className="btn-danger" style={{ fontSize: 10, padding: '4px 12px' }} onClick={() => setShowClearConfirm(true)}>
              CLEAR LOGS
            </button>
          ) : (
            <>
              <span style={{ color: 'var(--red)', fontSize: 11, alignSelf: 'center' }}>Confirm?</span>
              <button className="btn-danger" style={{ fontSize: 10, padding: '4px 12px' }} onClick={handleClear}>YES, CLEAR</button>
              <button className="btn-primary" style={{ fontSize: 10, padding: '4px 12px' }} onClick={() => setShowClearConfirm(false)}>CANCEL</button>
            </>
          )}
        </div>
      </div>

      {/* Log table header */}
      <div style={{ color: 'var(--green-dim)', fontSize: 11, marginBottom: 4, letterSpacing: '0.08em' }}>
        ┌─[ RUN RECORDS ]{'─'.repeat(56)}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '24px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
          NO RUNS YET — Click &quot;Generate Plan &amp; Run&quot; on a project to see logs here.
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '24px 120px 140px 80px 60px 70px 1fr', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--border)', fontSize: 10, color: 'var(--green-dim)', letterSpacing: '0.06em' }}>
            <span>#</span>
            <span>PROJECT</span>
            <span>STARTED</span>
            <span>STATUS</span>
            <span>DUR</span>
            <span>STEPS</span>
            <span>RUN ID</span>
          </div>

          {filtered.map((run, idx) => (
            <div key={run.id}>
              {/* Run row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '24px 120px 140px 80px 60px 70px 1fr',
                  gap: 8,
                  padding: '7px 12px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: expandedRun === run.id ? 'rgba(51,255,51,0.04)' : 'transparent',
                  alignItems: 'center',
                  fontSize: 11,
                }}
                onClick={() => toggleExpand(run.id)}
              >
                <span style={{ color: 'var(--green-dim)' }}>{idx + 1}</span>
                <span style={{ color: 'var(--cyan)' }}>{run.project_name}</span>
                <span style={{ color: 'var(--muted)' }}>{new Date(run.started_at).toLocaleString()}</span>
                <span>
                  <span className={`badge-${run.status === 'success' ? 'ok' : run.status === 'fail' ? 'fail' : run.status === 'aborted' ? 'skip' : 'pending'}`}
                    style={{ fontSize: 10, padding: '1px 6px' }}>
                    {run.status.toUpperCase()}
                  </span>
                </span>
                <span style={{ color: 'var(--muted)' }}>{formatDuration(run)}</span>
                <span style={{ color: 'var(--muted)' }}>
                  {run.steps.filter(s => s.status === 'success').length}/
                  {run.steps.length}
                </span>
                <span style={{ color: 'var(--green-dim)', fontSize: 10, wordBreak: 'break-all' }}>{run.id}</span>
              </div>

              {/* Expanded step details */}
              {expandedRun === run.id && (
                <div style={{ padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ color: 'var(--green-dim)', fontSize: 10, marginBottom: 6 }}>STEP RESULTS:</div>
                  {run.steps.length === 0 ? (
                    <div style={{ color: 'var(--muted)', fontSize: 11 }}>No step data recorded.</div>
                  ) : (
                    run.steps.map((step: StepResult, i: number) => (
                      <div key={step.step_id} style={{ display: 'flex', gap: 10, marginBottom: 4, fontSize: 11, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--green-dim)', minWidth: 20 }}>{i + 1}.</span>
                        <span className={`badge-${step.status === 'success' ? 'ok' : step.status === 'fail' ? 'fail' : 'skip'}`}
                          style={{ padding: '1px 5px', fontSize: 10, minWidth: 50, textAlign: 'center' }}>
                          {step.status.toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--cyan)', minWidth: 40 }}>{step.step_id}</span>
                        <span style={{ color: step.status === 'fail' ? 'var(--red)' : 'var(--muted)', flex: 1, wordBreak: 'break-word' }}>
                          {step.summary}
                        </span>
                        {step.duration_ms != null && (
                          <span style={{ color: 'var(--green-dim)', fontSize: 10, whiteSpace: 'nowrap' }}>
                            {step.duration_ms}ms
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ color: 'var(--green-dim)', fontSize: 11, marginTop: 4 }}>
        └{'─'.repeat(66)} [{filtered.length} records]┘
      </div>
    </div>
  )
}
