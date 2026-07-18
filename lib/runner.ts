// AI Helper — Client-side step orchestrator
// Calls /api/run-step for each step, handles retries, timeouts, abort signal
import type { ToolStep, PrecheckStep, ToolPlan } from './projects'
import type { StepResult, RunStatus } from './store'

export interface RunStepResponse {
  status: 'success' | 'fail'
  stdout: string
  stderr: string
  exit_code: number
  duration_ms: number
  sandbox_mode?: boolean
}

export interface RunnerCallbacks {
  onStepStart: (stepId: string) => void
  onStepComplete: (result: StepResult) => void
  onPlanComplete: (status: RunStatus) => void
  onAbort: () => void
}

let abortController: AbortController | null = null

export function abortCurrentRun() {
  abortController?.abort()
}

export async function executePlan(
  plan: ToolPlan,
  projectId: string,
  destructiveMode: 'A' | 'B',
  getAdaptiveTimeout: (stepId: string, def: number) => number,
  callbacks: RunnerCallbacks
): Promise<void> {
  abortController = new AbortController()
  const { signal } = abortController

  // ── Phase 1: Prechecks ─────────────────────────────────────
  for (const pc of plan.prechecks) {
    if (signal.aborted) { callbacks.onAbort(); return }
    callbacks.onStepStart(pc.step_id)
    const result = await runStep(pc.step_id, pc.action, pc.timeout_seconds ?? 10, signal)
    const stepResult: StepResult = {
      step_id: pc.step_id,
      status: result.status,
      summary: result.status === 'success'
        ? `✓ ${pc.expected}`
        : `✗ Precheck failed — ${result.stderr || result.stdout || 'no output'}`,
      stdout: result.stdout,
      stderr: result.stderr,
      duration_ms: result.duration_ms,
      timestamp: new Date().toISOString(),
    }
    callbacks.onStepComplete(stepResult)

    // Check stop conditions on precheck failure
    if (result.status === 'fail') {
      const matchingStop = plan.stop_conditions.find(sc =>
        sc.toLowerCase().includes(pc.step_id.toLowerCase())
      )
      callbacks.onPlanComplete('fail')
      return
    }
  }

  // ── Phase 2: Tool steps ────────────────────────────────────
  let anyFailed = false
  for (const step of plan.steps) {
    if (signal.aborted) { callbacks.onAbort(); return }

    // Block destructive steps in Mode B
    if (step.destructive && destructiveMode === 'B') {
      const skipped: StepResult = {
        step_id: step.step_id,
        status: 'skipped',
        summary: `⚠ SKIPPED — destructive step blocked in Mode B (safe mode)`,
        timestamp: new Date().toISOString(),
      }
      callbacks.onStepStart(step.step_id)
      callbacks.onStepComplete(skipped)
      continue
    }

    callbacks.onStepStart(step.step_id)
    const adaptedTimeout = getAdaptiveTimeout(step.step_id, step.timeout_seconds)
    let result = await runStep(step.step_id, step.command, adaptedTimeout, signal)

    // Retry once on failure
    if (result.status === 'fail' && plan.failure_policy.max_retries_per_step > 0) {
      await sleep(2000)
      if (!signal.aborted) {
        result = await runStep(step.step_id, step.command, adaptedTimeout, signal)
      }
    }

    const stepResult: StepResult = {
      step_id: step.step_id,
      status: result.status,
      summary: result.status === 'success'
        ? `✓ ${step.expected_result}${result.sandbox_mode ? ' [SANDBOX]' : ''}`
        : `✗ ${step.tool_name} failed — ${(result.stderr || result.stdout || 'exit ' + result.exit_code).slice(0, 120)}`,
      stdout: result.stdout,
      stderr: result.stderr,
      duration_ms: result.duration_ms,
      timestamp: new Date().toISOString(),
    }
    callbacks.onStepComplete(stepResult)

    if (result.status === 'fail') {
      anyFailed = true
      if (plan.failure_policy.on_failure === 'stop_and_report') {
        callbacks.onPlanComplete('fail')
        return
      }
    }
  }

  callbacks.onPlanComplete(anyFailed ? 'fail' : 'success')
}

async function runStep(
  stepId: string,
  command: string,
  timeoutSeconds: number,
  signal: AbortSignal
): Promise<RunStepResponse> {
  const start = Date.now()
  try {
    const res = await fetch('/api/run-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_id: stepId, command, timeout_seconds: timeoutSeconds }),
      signal,
    })
    if (!res.ok) {
      const text = await res.text()
      return { status: 'fail', stdout: '', stderr: text, exit_code: res.status, duration_ms: Date.now() - start }
    }
    return await res.json() as RunStepResponse
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { status: 'fail', stdout: '', stderr: 'Aborted by user', exit_code: -1, duration_ms: Date.now() - start }
    }
    return { status: 'fail', stdout: '', stderr: String(err), exit_code: -1, duration_ms: Date.now() - start }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Typewriter reveal helper — used by ToolPlanViewer
export async function* typewriterReveal(text: string, msPerChar = 8): AsyncGenerator<string> {
  let acc = ''
  for (const char of text) {
    acc += char
    yield acc
    await sleep(msPerChar)
  }
}
