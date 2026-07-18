export const runtime = 'nodejs'
// Lists and reads shell scripts from ~/ai-helper/scripts/
import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile, stat } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

function scriptsDir() {
  return path.join(homedir(), 'ai-helper', 'scripts')
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')

  if (name) {
    // Return contents of a specific script
    const safeName = path.basename(name) // prevent path traversal
    const filePath = path.join(scriptsDir(), safeName)
    try {
      const content = await readFile(filePath, 'utf-8')
      return NextResponse.json({ name: safeName, content })
    } catch {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 })
    }
  }

  // List all scripts
  try {
    const dir = scriptsDir()
    const files = await readdir(dir)
    const scripts = await Promise.all(
      files.filter(f => f.endsWith('.sh')).map(async f => {
        const info = await stat(path.join(dir, f))
        return { name: f, size: info.size, modified: info.mtime.toISOString() }
      })
    )
    return NextResponse.json({ scripts, scripts_dir: dir })
  } catch {
    return NextResponse.json({ scripts: [], scripts_dir: scriptsDir(), error: 'Directory not found — run setup.sh first' })
  }
}
