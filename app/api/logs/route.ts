// Persists run records to ~/ai-helper/logs/runs.json
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

function logsPath() {
  return path.join(homedir(), 'ai-helper', 'logs', 'runs.json')
}

async function readRuns(): Promise<unknown[]> {
  try {
    const raw = await readFile(logsPath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeRuns(runs: unknown[]): Promise<void> {
  try {
    const dir = path.dirname(logsPath())
    await mkdir(dir, { recursive: true })
    await writeFile(logsPath(), JSON.stringify(runs, null, 2), 'utf-8')
  } catch {
    // Silently continue in sandbox/read-only
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  let runs = await readRuns()
  if (projectId) {
    runs = (runs as Array<{ project_id?: string }>).filter(r => r.project_id === projectId)
  }
  return NextResponse.json(runs.slice(0, limit))
}

export async function POST(req: NextRequest) {
  try {
    const record = await req.json()
    const runs = await readRuns()
    const updated = [record, ...runs].slice(0, 200)
    await writeRuns(updated)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to save run' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  if (projectId) {
    const runs = await readRuns()
    const filtered = (runs as Array<{ project_id?: string }>).filter(r => r.project_id !== projectId)
    await writeRuns(filtered)
    return NextResponse.json({ ok: true, deleted: runs.length - filtered.length })
  }
  await writeRuns([])
  return NextResponse.json({ ok: true, deleted: 'all' })
}
