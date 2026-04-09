import React from 'react'
import { render } from 'ink'
import { DashboardServer } from './server/ws-server.js'
import { Dashboard } from './ui/Dashboard.js'

export interface DashboardOptions { port?: number }

export async function startDashboard(opts: DashboardOptions = {}): Promise<void> {
  const port = opts.port ?? 4317
  const server = new DashboardServer(port)
  await server.start()
  console.log(`[tracepath] Dashboard running on ws://localhost:${port}`)

  const { waitUntilExit } = render(
    React.createElement(Dashboard, {
      onSpanEvent: (h) => server.onSpan(h),
      // Pass a function reference so Dashboard can poll live client count
      getClientCount: () => server.connectedClients,
      port,
    })
  )

  process.on('SIGINT', async () => { await server.stop(); process.exit(0) })
  await waitUntilExit()
  await server.stop()
}

export { DashboardServer }
