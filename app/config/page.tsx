'use client'
import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'

interface DiagResult {
  healthy: boolean
  checks: Array<{ path: string; type: string; exists: boolean; repaired?: boolean }>
}

export default function ConfigPage() {
  const { config, updateConfig } = useStore()
  const [saved, setSaved] = useState(false)
  const [modeAConfirm, setModeAConfirm] = useState(false)
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null)
  const [diagRunning, setDiagRunning] = useState(false)
  const [repairRunning, setRepairRunning] = useState(false)
  const [repairResult, setRepairResult] = useState<{ ok: boolean; repaired: string[]; failed: string[]; message: string } | null>(null)
  const [serverConfig, setServerConfig] = useState<Record<string, unknown> | null>(null)

  // Load server-side config
  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setServerConfig).catch(() => {})
  }, [])

  function saveConfig() {
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).catch(() => {})
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleModeToggle() {
    if (config.destructive_mode === 'B') {
      if (!modeAConfirm) {
        setModeAConfirm(true)
        return
      }
      updateConfig({ destructive_mode: 'A' })
      setModeAConfirm(false)
    } else {
      updateConfig({ destructive_mode: 'B' })
    }
  }

  async function runDiagnostics() {
    setDiagRunning(true)
    setDiagResult(null)
    try {
      const res = await fetch('/api/diagnostics')
      setDiagResult(await res.json())
    } catch {
      setDiagResult({ healthy: false, checks: [{ path: 'API unreachable', type: 'system', exists: false }] })
    } finally {
      setDiagRunning(false)
    }
  }

  async function runRepair() {
    setRepairRunning(true)
    setRepairResult(null)
    try {
      const res = await fetch('/api/diagnostics', { method: 'POST' })
      setRepairResult(await res.json())
      await runDiagnostics()
    } catch {
      setRepairResult({ ok: false, repaired: [], failed: ['API unreachable'], message: 'Repair failed' })
    } finally {
      setRepairRunning(false)
    }
  }

  return (
    <div style={{ maxWidth: 700 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: 'var(--green-dim)', fontSize: 11 }}>CONFIGURATION</div>
        <h1 className="glow" style={{ color: 'var(--green)', fontSize: 18, fontWeight: 700, margin: '4px 0', letterSpacing: '0.04em' }}>
          App Config
        </h1>
        <div style={{ color: 'var(--muted)', fontSize: 11 }}>Stored in memory + ~/ai-helper/config.json</div>
      </div>

      {/* ── DESTRUCTIVE MODE ─────────────────────────── */}
      <Section title="DESTRUCTIVE MODE">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.6 }}>
              <strong style={{ color: config.destructive_mode === 'A' ? 'var(--red)' : 'var(--green)' }}>
                Mode {config.destructive_mode}
              </strong>
              {config.destructive_mode === 'B'
                ? ' — SAFE: Only ~/ai-helper/tmp/ can be deleted. All destructive steps are blocked.'
                : ' — LIVE: Destructive steps execute without restriction. Use with care.'}
            </div>
            {modeAConfirm && (
              <div style={{ padding: '8px 12px', border: '1px solid var(--red)', background: 'rgba(255,68,68,0.06)', marginBottom: 8, fontSize: 11, color: 'var(--red)' }}>
                ⚠ WARNING: Switching to Mode A enables destructive operations.
                Confirm by clicking the button again.
              </div>
            )}
          </div>
          <button
            onClick={handleModeToggle}
            className={config.destructive_mode === 'B' ? 'btn-danger' : 'btn-primary'}
            style={{ whiteSpace: 'nowrap', fontSize: 11 }}
          >
            {modeAConfirm ? 'CONFIRM → MODE A' : config.destructive_mode === 'B' ? 'SWITCH TO MODE A' : 'SWITCH TO MODE B (SAFE)'}
          </button>
        </div>
      </Section>

      {/* ── SCHEDULING ────────────────────────────────── */}
      <Section title="SCHEDULING">
        <div style={{ display: 'grid', gap: 16 }}>
          <SliderField
            label="Watchdog interval"
            unit="minutes"
            value={config.watchdog_interval_minutes}
            min={5} max={60} step={5}
            onChange={v => updateConfig({ watchdog_interval_minutes: v })}
          />
          <SliderField
            label="Daily maintenance hour"
            unit="hour (0–23)"
            value={config.daily_maintenance_hour}
            min={0} max={23} step={1}
            onChange={v => updateConfig({ daily_maintenance_hour: v })}
          />
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--muted)' }}>
          Cron: daily maintenance = <span style={{ color: 'var(--amber)' }}>0 {config.daily_maintenance_hour} * * *</span>
          {'  '}| watchdog = <span style={{ color: 'var(--amber)' }}>*/{config.watchdog_interval_minutes} * * * *</span>
        </div>
      </Section>

      {/* ── ADAPTIVE LEARNING ─────────────────────────── */}
      <Section title="ADAPTIVE LEARNING">
        <SliderField
          label="Timeout multiplier"
          unit="× (applied to learned p95 duration)"
          value={config.timeout_multiplier}
          min={0.5} max={3.0} step={0.1}
          onChange={v => updateConfig({ timeout_multiplier: parseFloat(v.toFixed(1)) })}
          format={v => v.toFixed(1) + '×'}
        />
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
          After 3+ runs, timeout = max(default, p95_duration × multiplier). Prevents flaky timeouts.
        </div>
        <SliderField
          label="Max log entries"
          unit="records"
          value={config.max_log_entries}
          min={10} max={500} step={10}
          onChange={v => updateConfig({ max_log_entries: v })}
        />
      </Section>

      {/* ── SAVE BUTTON ──────────────────────────────── */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn-primary" onClick={saveConfig}>
          {'>'} SAVE CONFIG
        </button>
        {saved && <span style={{ color: 'var(--green)', fontSize: 11 }}>✓ SAVED</span>}
      </div>

      {/* ── SERVER CONFIG ─────────────────────────────── */}
      {serverConfig && (
        <Section title="SERVER CONFIG (~/ai-helper/config.json)">
          <pre style={{ fontSize: 10, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
            {JSON.stringify(serverConfig, null, 2)}
          </pre>
        </Section>
      )}

      {/* ── DIAGNOSTICS ──────────────────────────────── */}
      <Section title="DIAGNOSTICS &amp; SELF-REPAIR">
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn-primary" onClick={runDiagnostics} disabled={diagRunning} style={{ fontSize: 11 }}>
            {diagRunning ? '[ SCANNING... ]' : '> RUN DIAGNOSTICS'}
          </button>
          <button className="btn-primary" onClick={runRepair} disabled={repairRunning} style={{ fontSize: 11 }}>
            {repairRunning ? '[ REPAIRING... ]' : '> SELF-REPAIR'}
          </button>
        </div>

        {repairResult && (
          <div style={{ marginBottom: 10, padding: '8px 12px', border: `1px solid ${repairResult.ok ? 'rgba(51,255,51,0.3)' : 'rgba(255,68,68,0.3)'}`, fontSize: 11 }}>
            <div style={{ color: repairResult.ok ? 'var(--green)' : 'var(--red)', marginBottom: 4 }}>
              {repairResult.message}
            </div>
            {repairResult.repaired.length > 0 && (
              <div style={{ color: 'var(--green-dim)' }}>Repaired: {repairResult.repaired.length} items</div>
            )}
            {repairResult.failed.length > 0 && (
              <div style={{ color: 'var(--red)' }}>Failed: {repairResult.failed.join(', ')}</div>
            )}
          </div>
        )}

        {diagResult && (
          <div style={{ fontSize: 11 }}>
            <div style={{ color: diagResult.healthy ? 'var(--green)' : 'var(--amber)', marginBottom: 8 }}>
              {diagResult.healthy ? '✓ ALL CHECKS PASSED' : '⚠ ISSUES DETECTED — run Self-Repair to fix'}
            </div>
            {diagResult.checks.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3, alignItems: 'center' }}>
                <span className={c.exists ? 'badge-ok' : 'badge-fail'} style={{ padding: '1px 5px', fontSize: 10, minWidth: 50, textAlign: 'center' }}>
                  {c.exists ? 'OK' : 'MISS'}
                </span>
                <span style={{ color: 'var(--green-dim)' }}>[{c.type}]</span>
                <span style={{ color: c.exists ? 'var(--muted)' : 'var(--amber)', wordBreak: 'break-all' }}>{c.path}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── SETUP INSTRUCTIONS ───────────────────────── */}
      <Section title="CHROMEBOOK SETUP INSTRUCTIONS">
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
          <div style={{ marginBottom: 6 }}>One-time setup on your Chromebook Linux terminal:</div>
          <div><span style={{ color: 'var(--green)' }}>bash public/scripts/setup.sh</span> — creates ~/ai-helper/, installs scripts, sets up cron</div>
          <div style={{ marginTop: 8 }}>To enable auto-start at Linux boot:</div>
          <div><span style={{ color: 'var(--green)' }}>cp systemd/ai-helper.service ~/.config/systemd/user/</span></div>
          <div><span style={{ color: 'var(--green)' }}>systemctl --user enable ai-helper.service</span></div>
          <div><span style={{ color: 'var(--green)' }}>systemctl --user start ai-helper.service</span></div>
          <div style={{ marginTop: 8 }}>ADB/Shizuku: ensure ADB is enabled, then:</div>
          <div><span style={{ color: 'var(--green)' }}>adb connect localhost:5555</span> or connect via USB</div>
        </div>
      </Section>
    </div>
  )
}

// ─── Reusable section wrapper ─────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ color: 'var(--green-dim)', fontSize: 11, marginBottom: 8, letterSpacing: '0.08em' }}>
        ┌─[ {title} ]
      </div>
      <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Slider field ─────────────────────────────────────────
function SliderField({ label, unit, value, min, max, step, onChange, format }: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--green-dim)' }}>{label}</span>
        <span style={{ color: 'var(--green)' }}>
          {format ? format(value) : value} <span style={{ color: 'var(--muted)' }}>{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%', accentColor: 'var(--green)',
          appearance: 'none', background: 'var(--surface2)',
          height: 4, borderRadius: 0, cursor: 'pointer',
        }}
      />
    </div>
  )
}
