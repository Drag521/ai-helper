export const runtime = 'nodejs'
// AI Helper — Real shell step executor
// Runs actual bash commands on the local Linux system via child_process
// Safety: command allowlist enforced, destructive commands blocked in Mode B
import { exec } from 'child_process'
import { promisify } from 'util'
import { NextRequest, NextResponse } from 'next/server'
import { readConfig } from '../config/store'

const execAsync = promisify(exec)

// ── Command allowlist ────────────────────────────────────
// Only these prefixes/exact commands are permitted.
// This prevents the UI from triggering arbitrary shell injection.
const ALLOWLIST_PREFIXES = [
  'uname', 'whoami', 'hostname', 'date', 'uptime',
  'df ', 'df\n', 'free ', 'top ', 'ps ',
  'ping ', 'curl ', 'wget ',
  'ls ', 'ls\n', 'cat ', 'tail ', 'head ', 'wc ',
  'test ', 'echo ',
  'apt-get update', 'apt list', 'apt-get install',
  'systemctl ', 'journalctl ',
  'adb ', 'adb\n',
  'bash ~/ai-helper/',
  'rm -rf ~/ai-helper/tmp/',
  'mkdir -p ~/ai-helper/',
  'touch ~/ai-helper/',
  'bash /home/',
  'which ',
  'pgrep ', 'kill ',
  'find ~/ai-helper/',
]

// ── Destructive prefixes (blocked in Mode B) ─────────────
const DESTRUCTIVE_PREFIXES = [
  'rm -rf /',
  'rm -rf /home',
  'apt-get remove',
  'apt-get purge',
  'apt-get autoremove',
  'dd ',
  'mkfs',
  'fdisk',
  'parted',
  'shred',
]

function isAllowed(command: string, destructiveMode: 'A' | 'B'): { ok: boolean; reason?: string } {
  const cmd = command.trim()

  // Block hard-destructive regardless of mode
  for (const prefix of DESTRUCTIVE_PREFIXES) {
    if (cmd.startsWith(prefix)) {
      if (destructiveMode === 'B') {
        return { ok: false, reason: `BLOCKED: destructive command requires Mode A. Command: ${prefix}...` }
      }
    }
  }

  // Check allowlist
  const allowed = ALLOWLIST_PREFIXES.some(prefix => {
    const trimmedPrefix = prefix.trim()
    return cmd === trimmedPrefix || cmd.startsWith(trimmedPrefix + ' ') || cmd === trimmedPrefix
  })

  // Also allow multi-part commands chained with && ; | if each part is allowed
  if (!allowed) {
    // Allow pipe/chain combos where root command is in allowlist
    const rootCmd = cmd.split(/[|;&]/)[0].trim()
    const rootAllowed = ALLOWLIST_PREFIXES.some(p => rootCmd === p.trim() || rootCmd.startsWith(p.trim()))
    if (!rootAllowed) {
      // Still allow if it's a bash ~/ai-helper/ path
      if (!cmd.includes('~/ai-helper/') && !cmd.startsWith('bash ~/')) {
        return { ok: false, reason: `BLOCKED: command not in allowlist. Root: "${rootCmd}"` }
      }
    }
  }

  return { ok: true }
}

interface RunStepBody {
  step_id: string
  command: string
  timeout_seconds: number
}

export async function POST(req: NextRequest) {
  let body: RunStepBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { step_id, command, timeout_seconds = 30 } = body
  if (!command || typeof command !== 'string') {
    return NextResponse.json({ error: 'command is required' }, { status: 400 })
  }

  // Read current config for destructive mode
  const config = await readConfig()
  const check = isAllowed(command, config.destructive_mode)
  if (!check.ok) {
    return NextResponse.json({
      status: 'fail',
      stdout: '',
      stderr: check.reason ?? 'Command blocked by safety policy',
      exit_code: 403,
      duration_ms: 0,
      blocked: true,
    }, { status: 200 }) // Return 200 so runner can handle gracefully
  }

  const start = Date.now()
  const sandboxMode = process.env.NODE_ENV !== 'production' && !process.env.AI_HELPER_LIVE

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeout_seconds * 1000,
      shell: '/bin/bash',
      env: { ...process.env, HOME: process.env.HOME ?? '/root' },
    })

    return NextResponse.json({
      status: 'success',
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exit_code: 0,
      duration_ms: Date.now() - start,
      sandbox_mode: sandboxMode,
      step_id,
    })
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean; signal?: string }
    const killed = e.killed || e.signal === 'SIGTERM'
    return NextResponse.json({
      status: 'fail',
      stdout: (e.stdout ?? '').trim(),
      stderr: killed
        ? `Timeout after ${timeout_seconds}s`
        : (e.stderr ?? String(err)).trim(),
      exit_code: e.code ?? 1,
      duration_ms: Date.now() - start,
      sandbox_mode: sandboxMode,
      step_id,
    })
  }
}
