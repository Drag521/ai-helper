'use client'
// AI Helper — Zustand store for run state, logs, and config
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ──────────────────────────────────────────────────
export type StepStatus = 'pending' | 'running' | 'success' | 'fail' | 'skipped'

export interface StepResult {
  step_id: string
  status: StepStatus
  summary: string
  stdout?: string
  stderr?: string
  duration_ms?: number
  retried?: boolean
  timestamp: string
}

export type RunStatus = 'idle' | 'planning' | 'running' | 'success' | 'fail' | 'aborted'

export interface RunRecord {
  id: string
  project_id: string
  project_name: string
  started_at: string
  finished_at?: string
  status: RunStatus
  steps: StepResult[]
  // Adaptive learning: track durations per step for timeout adjustment
  step_durations?: Record<string, number[]>
}

export interface AppConfig {
  watchdog_interval_minutes: number
  daily_maintenance_hour: number
  destructive_mode: 'A' | 'B'
  max_log_entries: number
  ai_helper_port: number
  // Adaptive timeout multiplier (learned from history)
  timeout_multiplier: number
}

export interface ChronicFailure {
  project_id: string
  step_id: string
  fail_count: number
  last_error: string
  first_seen: string
  suggested_fix?: string
}

interface AiHelperStore {
  // Current run state
  activeProjectId: string | null
  runStatus: RunStatus
  currentRun: RunRecord | null
  planRevealed: boolean

  // All persisted run history
  runHistory: RunRecord[]

  // Configuration
  config: AppConfig

  // Self-learning: chronic failure tracking
  chronicFailures: ChronicFailure[]

  // Custom projects (user-defined, saved to disk)
  customProjectIds: string[]

  // Actions
  setActiveProject: (id: string | null) => void
  startRun: (projectId: string, projectName: string) => string
  setPlanRevealed: (v: boolean) => void
  updateStep: (runId: string, result: StepResult) => void
  finishRun: (runId: string, status: RunStatus) => void
  abortRun: (runId: string) => void
  clearHistory: (projectId?: string) => void
  updateConfig: (patch: Partial<AppConfig>) => void
  recordChronicFailure: (projectId: string, stepId: string, error: string) => void
  clearChronicFailure: (projectId: string, stepId: string) => void
  addCustomProjectId: (id: string) => void
  // Adaptive timeout: get recommended timeout for a step based on history
  getAdaptiveTimeout: (projectId: string, stepId: string, defaultTimeout: number) => number
}

const DEFAULT_CONFIG: AppConfig = {
  watchdog_interval_minutes: 15,
  daily_maintenance_hour: 3,
  destructive_mode: 'B',
  max_log_entries: 100,
  ai_helper_port: 13000,
  timeout_multiplier: 1.0,
}

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export const useStore = create<AiHelperStore>()(
  persist(
    (set, get) => ({
      activeProjectId: null,
      runStatus: 'idle',
      currentRun: null,
      planRevealed: false,
      runHistory: [],
      config: DEFAULT_CONFIG,
      chronicFailures: [],
      customProjectIds: [],

      setActiveProject: (id) => set({ activeProjectId: id, planRevealed: false }),

      startRun: (projectId, projectName) => {
        const id = generateRunId()
        const run: RunRecord = {
          id,
          project_id: projectId,
          project_name: projectName,
          started_at: new Date().toISOString(),
          status: 'planning',
          steps: [],
        }
        set({ currentRun: run, runStatus: 'planning', planRevealed: false })
        return id
      },

      setPlanRevealed: (v) => set({ planRevealed: v, runStatus: v ? 'running' : 'planning' }),

      updateStep: (runId, result) => {
        set(state => {
          if (!state.currentRun || state.currentRun.id !== runId) return state
          const existing = state.currentRun.steps.findIndex(s => s.step_id === result.step_id)
          const steps = existing >= 0
            ? state.currentRun.steps.map((s, i) => i === existing ? result : s)
            : [...state.currentRun.steps, result]
          return { currentRun: { ...state.currentRun, steps } }
        })
      },

      finishRun: (runId, status) => {
        set(state => {
          if (!state.currentRun || state.currentRun.id !== runId) return state
          const finished: RunRecord = {
            ...state.currentRun,
            finished_at: new Date().toISOString(),
            status,
          }
          const history = [finished, ...state.runHistory].slice(0, state.config.max_log_entries)
          return { currentRun: finished, runStatus: status, runHistory: history }
        })
      },

      abortRun: (runId) => {
        set(state => {
          if (!state.currentRun || state.currentRun.id !== runId) return state
          const aborted: RunRecord = {
            ...state.currentRun,
            finished_at: new Date().toISOString(),
            status: 'aborted',
          }
          const history = [aborted, ...state.runHistory].slice(0, state.config.max_log_entries)
          return { currentRun: aborted, runStatus: 'aborted', runHistory: history }
        })
      },

      clearHistory: (projectId) => {
        set(state => ({
          runHistory: projectId
            ? state.runHistory.filter(r => r.project_id !== projectId)
            : [],
        }))
      },

      updateConfig: (patch) => {
        set(state => ({ config: { ...state.config, ...patch } }))
      },

      recordChronicFailure: (projectId, stepId, error) => {
        set(state => {
          const idx = state.chronicFailures.findIndex(
            c => c.project_id === projectId && c.step_id === stepId
          )
          if (idx >= 0) {
            const updated = [...state.chronicFailures]
            updated[idx] = {
              ...updated[idx],
              fail_count: updated[idx].fail_count + 1,
              last_error: error,
            }
            return { chronicFailures: updated }
          }
          return {
            chronicFailures: [...state.chronicFailures, {
              project_id: projectId,
              step_id: stepId,
              fail_count: 1,
              last_error: error,
              first_seen: new Date().toISOString(),
            }],
          }
        })
      },

      clearChronicFailure: (projectId, stepId) => {
        set(state => ({
          chronicFailures: state.chronicFailures.filter(
            c => !(c.project_id === projectId && c.step_id === stepId)
          ),
        }))
      },

      addCustomProjectId: (id) => {
        set(state => ({ customProjectIds: [...new Set([...state.customProjectIds, id])] }))
      },

      getAdaptiveTimeout: (projectId, stepId, defaultTimeout) => {
        const history = get().runHistory.filter(r => r.project_id === projectId)
        const durations: number[] = []
        for (const run of history) {
          const step = run.steps.find(s => s.step_id === stepId)
          if (step?.duration_ms) durations.push(step.duration_ms)
        }
        if (durations.length < 3) return defaultTimeout
        const sorted = [...durations].sort((a, b) => a - b)
        const p95 = sorted[Math.floor(sorted.length * 0.95)] / 1000
        const multiplier = get().config.timeout_multiplier
        return Math.max(defaultTimeout, Math.ceil(p95 * 1.3 * multiplier))
      },
    }),
    {
      name: 'ai-helper-store',
      partialize: (state) => ({
        runHistory: state.runHistory,
        config: state.config,
        chronicFailures: state.chronicFailures,
        customProjectIds: state.customProjectIds,
      }),
    }
  )
)
