export const runtime = 'nodejs'
// AI Helper — Open terminal API
// Personal use only. No allowlist — runs whatever YOU type.
// This is YOUR machine. You own it.
import { exec } from 'child_process'
import { promisify } from 'util'
import { NextRequest, NextResponse } from 'next/server'

const execAsync = promisify(exec)

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

  const start = Date.now()
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeout_seconds * 1000,
      shell: '/bin/bash',
      cwd: cwd ?? process.env.HOME ?? '/root',
      env: {
        ...process.env,
        HOME: process.env.HOME ?? '/root',
        TERM: 'xterm-256color',
      },
      maxBuffer: 1024 * 1024 * 5, // 5MB output buffer
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
