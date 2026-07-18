'use client'
import Link from 'next/link'
import { PROJECTS, CATEGORY_LABELS } from '@/lib/projects'
import { useStore } from '@/lib/store'

const CATEGORY_CLASSES: Record<string, string> = {
  system:      'cat-system',
  maintenance: 'cat-maintenance',
  watchdog:    'cat-watchdog',
  android:     'cat-android',
}

const ASCII_ICONS: Record<string, string> = {
  system:      '[SYS]',
  maintenance: '[MNT]',
  watchdog:    '[WDG]',
  android:     '[ADB]',
}

export default function HomePage() {
  const runHistory = useStore(s => s.runHistory)
  const chronicFailures = useStore(s => s.chronicFailures)

  function lastRun(projectId: string) {
    return runHistory.find(r => r.project_id === projectId)
  }

  function chronicCount(projectId: string) {
    return chronicFailures.filter(c => c.project_id === projectId).length
  }

  const now = new Date()
  const uptime = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <pre style={{ color: 'var(--green)', fontSize: 11, lineHeight: 1.2, marginBottom: 8 }}>{`
  █████╗ ██╗    ██╗  ██╗███████╗██╗     ██████╗ ███████╗██████╗ 
 ██╔══██╗██║    ██║  ██║██╔════╝██║     ██╔══██╗██╔════╝██╔══██╗
 ███████║██║    ███████║█████╗  ██║     ██████╔╝█████╗  ██████╔╝
 ██╔══██║██║    ██╔══██║██╔══╝  ██║     ██╔═══╝ ██╔══╝  ██╔══██╗
 ██║  ██║██║    ██║  ██║███████╗███████╗██║     ███████╗██║  ██║
 ╚═╝  ╚═╝╚═╝    ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝`}</pre>
        <div style={{ color: 'var(--green-dim)', fontSize: 12, marginTop: 4 }}>
          <span>v1.0.0-personal</span>
          <span style={{ margin: '0 12px' }}>|</span>
          <span>DESTRUCTIVE_MODE=<span style={{ color: 'var(--amber)' }}>B (SAFE)</span></span>
          <span style={{ margin: '0 12px' }}>|</span>
          <span>SYS_TIME: {uptime}</span>
        </div>
      </div>

      {/* Section header */}
      <div style={{ color: 'var(--green-dim)', marginBottom: 16, letterSpacing: '0.1em' }}>
        ┌─[ PROJECTS ]{'─'.repeat(60)}┐
      </div>

      {/* Project grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16, marginBottom: 24 }}>
        {PROJECTS.map((project, idx) => {
          const last = lastRun(project.id)
          const chronic = chronicCount(project.id)
          const catClass = CATEGORY_CLASSES[project.category]
          const icon = ASCII_ICONS[project.category]
          const label = CATEGORY_LABELS[project.category]

          return (
            <Link key={project.id} href={`/project/${project.id}`} style={{ textDecoration: 'none' }}>
              <div className="term-card" style={{ padding: '16px 18px', cursor: 'pointer', minHeight: 160 }}>
                {/* Card top bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ color: 'var(--green-dim)', fontSize: 11 }}>
                    ┌─[{String(idx + 1).padStart(2, '0')}]
                  </span>
                  <span className={`${catClass}`} style={{ fontSize: 11, letterSpacing: '0.08em' }}>
                    {icon} {label}
                  </span>
                </div>

                {/* Project name */}
                <div className="glow" style={{ color: 'var(--green)', fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: '0.04em' }}>
                  {project.name}
                </div>

                {/* Description */}
                <div style={{ color: 'var(--muted)', fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>
                  {project.description}
                </div>

                {/* Schedule */}
                {project.schedule && (
                  <div style={{ color: 'var(--green-dim)', fontSize: 11, marginBottom: 8 }}>
                    CRON: <span style={{ color: 'var(--amber)' }}>{project.schedule}</span>
                  </div>
                )}

                {/* Last run status */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {last ? (
                    <>
                      <span
                        className={`badge-${last.status === 'success' ? 'ok' : last.status === 'fail' ? 'fail' : 'skip'}`}
                        style={{ fontSize: 10, padding: '2px 7px' }}
                      >
                        {last.status.toUpperCase()}
                      </span>
                      <span style={{ color: 'var(--green-dim)', fontSize: 10 }}>
                        {new Date(last.started_at).toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <span className="badge-pending" style={{ fontSize: 10, padding: '2px 7px' }}>NO RUNS YET</span>
                  )}

                  {chronic > 0 && (
                    <span className="badge-fail" style={{ fontSize: 10, padding: '2px 7px' }}>
                      ⚠ {chronic} CHRONIC FAIL{chronic > 1 ? 'S' : ''}
                    </span>
                  )}
                </div>

                {/* Run CTA */}
                <div style={{ marginTop: 12, color: 'var(--green)', fontSize: 11, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  {'>'} <span style={{ letterSpacing: '0.05em' }}>CLICK TO GENERATE PLAN &amp; RUN</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div style={{ color: 'var(--green-dim)', marginBottom: 24, letterSpacing: '0.1em' }}>
        └{'─'.repeat(72)}┘
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 32, color: 'var(--green-dim)', fontSize: 11, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div>
          TOTAL_RUNS: <span style={{ color: 'var(--green)' }}>{runHistory.length}</span>
        </div>
        <div>
          SUCCESS: <span style={{ color: 'var(--green)' }}>
            {runHistory.filter(r => r.status === 'success').length}
          </span>
        </div>
        <div>
          FAILED: <span style={{ color: 'var(--red)' }}>
            {runHistory.filter(r => r.status === 'fail').length}
          </span>
        </div>
        <div>
          CHRONIC_ALERTS: <span style={{ color: chronicFailures.length > 0 ? 'var(--amber)' : 'var(--green)' }}>
            {chronicFailures.length}
          </span>
        </div>
      </div>

      {/* Setup notice */}
      <div style={{ marginTop: 32, padding: '12px 16px', border: '1px solid var(--amber-dim)', background: 'rgba(255,176,0,0.04)' }}>
        <div style={{ color: 'var(--amber)', fontSize: 11, marginBottom: 4 }}>⚠ FIRST-TIME SETUP</div>
        <div style={{ color: 'var(--green-dim)', fontSize: 11, lineHeight: 1.6 }}>
          On your Chromebook, run once to initialize ~/ai-helper/ directory structure:<br />
          <span style={{ color: 'var(--green)' }}>bash public/scripts/setup.sh</span>
          <span style={{ margin: '0 8px', color: 'var(--green-dim)' }}>|</span>
          Then start: <span style={{ color: 'var(--green)' }}>pnpm start</span>
          <span style={{ margin: '0 8px', color: 'var(--green-dim)' }}>|</span>
          Visit: <span style={{ color: 'var(--green)' }}>localhost:13000</span>
        </div>
      </div>
    </div>
  )
}
