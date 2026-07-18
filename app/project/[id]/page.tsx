'use client'
import { use, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProject } from '@/lib/projects'
import { executePlan, abortCurrentRun } from '@/lib/runner'
import { useStore } from '@/lib/store'
import type { StepResult } from '@/lib/store'
import ToolPlanViewer from '@/components/ToolPlanViewer'
import StepResultLine from '@/components/StepResultLine'

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const project = getProject(id)

  const { startRun, setPlanRevealed, updateStep, finishRun, abortRun,
          runStatus, currentRun, planRevealed, config,
          getAdaptiveTimeout, recordChronicFailure, clearChronicFailure, setActiveProject } = useStore()

  const [showPlan, setShowPlan] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const logBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (project) setActiveProject(project.id)
    return () => setActiveProject(null)
  }, [project, setActiveProject])

  // Auto-scroll log
  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentRun?.steps.length])

  const handleGenerateAndRun = useCallback(() => {
    if (!project) return
    const id = startRun(project.id, project.name)
    setRunId(id)
    setShowPlan(true)
  }, [project, startRun])

  const handlePlanRevealComplete = useCallback(() => {
    setPlanRevealed(true)
  }, [setPlanRevealed])

  const handleAbort = useCallback(() => {
    if (!runId) return
    abortCurrentRun()
    abortRun(runId)
  }, [runId, abortRun])

  // Start execution after plan is revealed
  useEffect(() => {
    if (!planRevealed || !runId || !project || runStatus !== 'running') return

    const adaptedTimeout = (stepId: string, def: number) =>
      getAdaptiveTimeout(project.id, stepId, def)

    executePlan(
      project.plan,
      project.id,
      config.destructive_mode,
      adaptedTimeout,
      {
        onStepStart: (stepId) => {
          updateStep(runId, {
            step_id: stepId, status: 'running',
            summary: 'Executing...', timestamp: new Date().toISOString(),
          })
        },
        onStepComplete: (result: StepResult) => {
          updateStep(runId, result)
          if (result.status === 'fail') {
            recordChronicFailure(project.id, result.step_id, result.summary)
          } else if (result.status === 'success') {
            clearChronicFailure(project.id, result.step_id)
          }
          // Persist to server log
          if (currentRun) {
            fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...currentRun, steps: [...(currentRun.steps ?? []), result] }),
            }).catch(() => {})
          }
        },
        onPlanComplete: (status) => {
          finishRun(runId, status)
        },
        onAbort: () => {
          abortRun(runId)
        },
      }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planRevealed, runId])

  if (!project) {
    return (
      <div style={{ color: 'var(--red)', padding: 24 }}>
        ERROR: Project &quot;{id}&quot; not found.
        <br />
        <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => router.push('/')}>
          ← BACK TO PROJECTS
        </button>
      </div>
    )
  }

  const isRunning = runStatus === 'running' || runStatus === 'planning'
  const isDone = runStatus === 'success' || runStatus === 'fail' || runStatus === 'aborted'
  const steps = currentRun?.steps ?? []

  // Gather all step IDs for display (prechecks + steps)
  const allStepIds = [
    ...project.plan.prechecks.map(p => p.step_id),
    ...project.plan.steps.map(s => s.step_id),
  ]

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Back + header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: 'var(--green-dim)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, padding: 0, marginBottom: 10 }}
        >
          ← [0] BACK
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'var(--green-dim)', fontSize: 11 }}>PROJECT RUNNER</div>
            <h1 className="glow" style={{ color: 'var(--green)', fontSize: 18, fontWeight: 700, margin: '4px 0', letterSpacing: '0.04em' }}>
              {project.name}
            </h1>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>{project.description}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {!isRunning && (
              <button
                className="btn-primary"
                onClick={handleGenerateAndRun}
                disabled={isRunning}
              >
                {'>'} GENERATE PLAN &amp; RUN
              </button>
            )}
            {isRunning && (
              <button className="btn-danger" onClick={handleAbort}>
                ■ ABORT
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Run status bar */}
      {currentRun && (
        <div style={{ marginBottom: 16, padding: '8px 14px', border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 16, alignItems: 'center', fontSize: 11 }}>
          <span style={{ color: 'var(--green-dim)' }}>RUN_ID:</span>
          <span style={{ color: 'var(--cyan)' }}>{currentRun.id}</span>
          <span style={{ color: 'var(--green-dim)' }}>STATUS:</span>
          <span className={`badge-${runStatus === 'success' ? 'ok' : runStatus === 'fail' ? 'fail' : runStatus === 'aborted' ? 'skip' : 'running'}`}
            style={{ padding: '1px 8px', fontSize: 10 }}>
            {runStatus.toUpperCase()}
          </span>
          <span style={{ color: 'var(--green-dim)' }}>STARTED:</span>
          <span style={{ color: 'var(--green-dim)' }}>{new Date(currentRun.started_at).toLocaleTimeString()}</span>
          {currentRun.finished_at && (
            <>
              <span style={{ color: 'var(--green-dim)' }}>FINISHED:</span>
              <span style={{ color: 'var(--green-dim)' }}>{new Date(currentRun.finished_at).toLocaleTimeString()}</span>
            </>
          )}
        </div>
      )}

      {/* Destructive mode warning for Mode A */}
      {config.destructive_mode === 'A' && (
        <div style={{ marginBottom: 12, padding: '8px 14px', border: '1px solid var(--red)', background: 'rgba(255,68,68,0.05)', color: 'var(--red)', fontSize: 11 }}>
          ⚠ WARNING: DESTRUCTIVE MODE A ACTIVE — destructive steps will execute without restriction
        </div>
      )}

      {/* TOOL_PLAN_JSON viewer */}
      {showPlan && (
        <div style={{ marginBottom: 20 }}>
          <ToolPlanViewer
            plan={project.plan}
            onRevealComplete={handlePlanRevealComplete}
            autoReveal={true}
          />
        </div>
      )}

      {/* Step results log */}
      {steps.length > 0 && (
        <div>
          <div style={{ color: 'var(--green-dim)', fontSize: 11, marginBottom: 8, letterSpacing: '0.08em' }}>
            ┌─[ EXECUTION LOG ]{'─'.repeat(48)}
          </div>
          <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', padding: '10px 14px', maxHeight: 500, overflowY: 'auto' }}>
            {/* Precheck section */}
            {steps.filter(s => s.step_id.startsWith('pc')).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ color: 'var(--green-dim)', fontSize: 10, marginBottom: 4 }}># PRECHECKS</div>
                {steps.filter(s => s.step_id.startsWith('pc')).map((r, i) => (
                  <StepResultLine key={r.step_id} result={r} stepIndex={i} isRunning={isRunning} />
                ))}
              </div>
            )}
            {/* Tool steps section */}
            {steps.filter(s => s.step_id.startsWith('s')).length > 0 && (
              <div>
                <div style={{ color: 'var(--green-dim)', fontSize: 10, marginBottom: 4 }}># STEPS</div>
                {steps.filter(s => s.step_id.startsWith('s')).map((r, i) => (
                  <StepResultLine key={r.step_id} result={r} stepIndex={i} isRunning={isRunning} />
                ))}
              </div>
            )}
            <div ref={logBottomRef} />
          </div>
          <div style={{ color: 'var(--green-dim)', fontSize: 11, marginTop: 4 }}>
            └{'─'.repeat(62)}┘
          </div>
        </div>
      )}

      {/* Progress bar */}
      {isRunning && (
        <div className="progress-bar" style={{ marginTop: 12 }}>
          <div
            className="progress-fill"
            style={{ width: `${allStepIds.length > 0 ? (steps.length / allStepIds.length) * 100 : 0}%` }}
          />
        </div>
      )}

      {/* Final result */}
      {isDone && currentRun && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          border: `1px solid ${runStatus === 'success' ? 'rgba(51,255,51,0.4)' : runStatus === 'aborted' ? 'rgba(74,122,74,0.3)' : 'rgba(255,68,68,0.4)'}`,
          background: runStatus === 'success' ? 'rgba(51,255,51,0.05)' : runStatus === 'aborted' ? 'rgba(0,0,0,0.2)' : 'rgba(255,68,68,0.05)',
        }}>
          <div style={{
            color: runStatus === 'success' ? 'var(--green)' : runStatus === 'aborted' ? 'var(--muted)' : 'var(--red)',
            fontSize: 12, fontWeight: 700, marginBottom: 4,
          }}>
            {runStatus === 'success' ? '✓ PLAN EXECUTED SUCCESSFULLY'
              : runStatus === 'aborted' ? '■ RUN ABORTED BY USER'
              : '✗ PLAN EXECUTION FAILED — CHECK STEP LOGS ABOVE'}
          </div>
          <div style={{ color: 'var(--green-dim)', fontSize: 11 }}>
            Steps completed: {steps.filter(s => s.status === 'success').length}/{allStepIds.length}
            {' '} | Failed: {steps.filter(s => s.status === 'fail').length}
            {' '} | Skipped: {steps.filter(s => s.status === 'skipped').length}
          </div>
        </div>
      )}

      {/* Plan info (not yet run) */}
      {!showPlan && (
        <div style={{ marginTop: 24, padding: '16px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ color: 'var(--green-dim)', fontSize: 11, marginBottom: 12 }}>PLAN OVERVIEW</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11 }}>
            <div>
              <div style={{ color: 'var(--green-dim)', marginBottom: 4 }}>PRECHECKS</div>
              {project.plan.prechecks.map(pc => (
                <div key={pc.step_id} style={{ color: 'var(--muted)', marginBottom: 2 }}>
                  [{pc.step_id}] {pc.action.slice(0, 50)}
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: 'var(--green-dim)', marginBottom: 4 }}>STEPS ({project.plan.steps.length})</div>
              {project.plan.steps.map(s => (
                <div key={s.step_id} style={{ color: 'var(--muted)', marginBottom: 2 }}>
                  [{s.step_id}] {s.tool_name}{s.destructive ? <span style={{ color: 'var(--amber)' }}> ⚠D</span> : ''}
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12, color: 'var(--green-dim)', fontSize: 11 }}>
            GOAL: <span style={{ color: 'var(--green)' }}>{project.plan.goal}</span>
          </div>
          <div style={{ marginTop: 6, color: 'var(--green-dim)', fontSize: 11 }}>
            FAILURE_POLICY: <span style={{ color: 'var(--amber)' }}>{project.plan.failure_policy.on_failure}</span>
            {' '} | MAX_RETRIES: <span style={{ color: 'var(--amber)' }}>{project.plan.failure_policy.max_retries_per_step}</span>
          </div>
        </div>
      )}
    </div>
  )
}
