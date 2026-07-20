'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useStore } from '@/lib/store'

const NAV = [
  { href: '/',       label: 'PROJECTS',  key: '1', icon: '[>]' },
  { href: '/logs',   label: 'LOGS',      key: '2', icon: '[#]' },
  { href: '/config', label: 'CONFIG',    key: '3', icon: '[*]' },
]

export default function NavSidebar() {
  const pathname = usePathname()
  const runStatus = useStore(s => s.runStatus)
  const activeProject = useStore(s => s.activeProjectId)
  const chronicFailures = useStore(s => s.chronicFailures)

  const isRunning = runStatus === 'running' || runStatus === 'planning'

  return (
    <nav style={{
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      width: 200,
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      fontFamily: 'inherit',
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 14px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="glow" style={{ color: 'var(--green)', fontSize: 13, fontWeight: 700, letterSpacing: '0.05em' }}>
          AI-HELPER
        </div>
        <div style={{ color: 'var(--green-dim)', fontSize: 10, marginTop: 2 }}>
          personal :: chromeos
        </div>
      </div>

      {/* Status indicator */}
      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', fontSize: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isRunning ? 'var(--amber)' : 'var(--green)',
            boxShadow: isRunning ? '0 0 6px var(--amber)' : '0 0 6px var(--green)',
            display: 'inline-block',
            animation: isRunning ? 'blink 0.6s step-end infinite' : 'none',
          }} />
          <span style={{ color: isRunning ? 'var(--amber)' : 'var(--green-dim)' }}>
            {isRunning ? 'RUNNING' : 'IDLE'}
          </span>
        </div>
        {isRunning && activeProject && (
          <div style={{ color: 'var(--amber)', fontSize: 10, marginTop: 4, wordBreak: 'break-all' }}>
            {activeProject}
          </div>
        )}
      </div>

      {/* Nav links */}
      <div style={{ flex: 1, padding: '12px 0' }}>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: active ? 'var(--green)' : 'var(--green-dim)',
                background: active ? 'rgba(51,255,51,0.06)' : 'transparent',
                borderLeft: active ? '2px solid var(--green)' : '2px solid transparent',
                fontSize: 12,
                letterSpacing: '0.06em',
                transition: 'all 0.1s ease',
                cursor: 'pointer',
              }}>
                <span style={{ fontSize: 11 }}>{item.icon}</span>
                <span>{item.key}. {item.label}</span>
                {item.href === '/logs' && chronicFailures.length > 0 && (
                  <span style={{ marginLeft: 'auto', color: 'var(--amber)', fontSize: 10 }}>
                    !{chronicFailures.length}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Footer: destructive mode */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)', fontSize: 10 }}>
        <DestructiveModeIndicator />
      </div>

      {/* Bottom version */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', color: 'var(--muted)', fontSize: 9 }}>
        MODE_B_SAFE · v1.0.0
      </div>
    </nav>
  )
}

function DestructiveModeIndicator() {
  const mode = useStore(s => s.config.destructive_mode)
  return (
    <div>
      <div style={{ color: 'var(--green-dim)', marginBottom: 3 }}>DESTRUCT_MODE:</div>
      <div style={{
        color: mode === 'B' ? 'var(--green)' : 'var(--red)',
        fontWeight: 700,
        letterSpacing: '0.05em',
      }}>
        {mode === 'B' ? '● MODE_B (SAFE)' : '⚠ MODE_A (LIVE)'}
      </div>
    </div>
  )
}
