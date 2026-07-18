export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { readConfig, writeConfig } from './store'

export async function GET() {
  const config = await readConfig()
  return NextResponse.json(config)
}

export async function PUT(req: NextRequest) {
  try {
    const patch = await req.json()
    const updated = await writeConfig(patch)
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
}
