import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AgentationGuard } from '@/components/AgentationGuard'
import { HappySeedsWatermark } from '@/components/HappySeedsWatermark'
import NavSidebar from '@/components/NavSidebar'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AI Helper — On-Device Automation',
  description: 'Personal on-device automation tool for ChromeOS/Linux + ADB/Shizuku',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <head />
      <body style={{ margin: 0, background: '#0A0A0A', minHeight: '100vh' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <NavSidebar />
          <main style={{
            flex: 1,
            marginLeft: '200px',
            minHeight: '100vh',
            padding: '24px',
            maxWidth: 'calc(100vw - 200px)',
            overflowX: 'hidden',
          }}>
            {children}
          </main>
        </div>
        <HappySeedsWatermark />
        <AgentationGuard />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
