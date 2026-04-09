#!/usr/bin/env node

// Force UTF-8 output on Windows so the dashboard renders correctly
if (process.platform === 'win32') {
  try {
    const { execSync } = await import('node:child_process')
    execSync('chcp 65001', { stdio: 'ignore' })
  } catch { /* ignore if chcp unavailable */ }
}

import { Command } from 'commander'

const pkg = { version: '0.1.0' }
const program = new Command()

program
  .name('tracepath')
  .description('Real-time observability dashboard')
  .version(pkg.version)

program
  .command('dashboard')
  .description('Start the CLI dashboard')
  .option('-p, --port <number>', 'WebSocket port', '4317')
  .action(async (opts) => {
    const { startDashboard } = await import('./index.js')
    await startDashboard({ port: parseInt(opts.port, 10) })
  })

program.parse()
