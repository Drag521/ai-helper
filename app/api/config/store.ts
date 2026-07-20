// Config persistence — reads/writes ~/ai-helper/config.json
import { readFile, writeFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import path from 'path'

export interface PersistedConfig {
  destructive_mode: 'A' | 'B'
  watchdog_interval_minutes: number
  daily_maintenance_hour: number
  max_log_entries: number
  ai_helper_port: number
  timeout_multiplier: number
  setup_complete: boolean
  last_updated: string
}

const DEFAULT_CONFIG: PersistedConfig = {
  destructive_mode: 'B',
  watchdog_interval_minutes: 15,
  daily_maintenance_hour: 3,
  max_log_entries: 100,
  ai_helper_port: 13000,
  timeout_multiplier: 1.0,
  setup_complete: false,
  last_updated: new Date().toISOString(),
}

function configPath() {
  return path.join(homedir(), 'ai-helper', 'config.json')
}

export async function readConfig(): Promise<PersistedConfig> {
  try {
    const raw = await readFile(configPath(), 'utf-8')
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function writeConfig(config: Partial<PersistedConfig>): Promise<PersistedConfig> {
  const current = await readConfig()
  const updated: PersistedConfig = {
    ...current,
    ...config,
    last_updated: new Date().toISOString(),
  }
  try {
    const dir = path.dirname(configPath())
    await mkdir(dir, { recursive: true })
    await writeFile(configPath(), JSON.stringify(updated, null, 2), 'utf-8')
  } catch {
    // In sandbox or read-only env, silently continue
  }
  return updated
}
