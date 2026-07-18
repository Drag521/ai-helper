export const runtime = 'nodejs'
// AI Helper — Open terminal API
// Personal use only. No allowlist — runs whatever YOU type.
// This is YOUR machine. You own it.
import { exec } from 'child_process'
import { promisify } from 'util'
import { NextRequest, NextResponse } from 'next/server'
import { homedir } from 'os'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

// Resolve ~ to actual home dir — child_process can't expand shell aliases
function resolveCwd(cwd?: string): string {
  const home = homedir()
  if (!cwd || cwd === '~') return home
  if (cwd.startsWith('~/')) return home + cwd.slice(1)
  if (existsSync(cwd)) return cwd
  return home
}

export async function POST(req: NextRequest) {
  let body: { command: string; timeout_seconds?: number; cwd?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { command, timeout_seconds = 30, cwd } = body
  if (!command?.trim()) {
    return NextResponse.json({ error: 'No command' }, { status: 400 })
  }

  const home = homedir()
  const resolvedCwd = resolveCwd(cwd)
  const start = Date.now()

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeout_seconds * 1000,
      shell: '/bin/bash',
      cwd: resolvedCwd,
      env: {
        ...process.env,
        HOME: home,
        TERM: 'xterm-256color',
        NVM_DIR: process.env.NVM_DIR ?? `${home}/.config/nvm`,
      },
      maxBuffer: 1024 * 1024 * 5,
    })
    return NextResponse.json({
      status: 'success',
      stdout: stdout,
      stderr: stderr,
      exit_code: 0,
      duration_ms: Date.now() - start,
    })
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean }
    return NextResponse.json({
      status: 'error',
      stdout: e.stdout ?? '',
      stderr: e.killed
        ? `[Timeout after ${timeout_seconds}s]`
        : (e.stderr ?? String(err)),
      exit_code: e.code ?? 1,
      duration_ms: Date.now() - start,
    })
  }
}
