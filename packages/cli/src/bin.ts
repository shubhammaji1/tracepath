import { Command } from 'commander'
const pkg = { version: '0.1.0' }
const program = new Command()
program.name('tracepath').description('Real-time observability dashboard').version(pkg.version)
program
  .command('dashboard')
  .description('Start the CLI dashboard')
  .option('-p, --port <number>', 'WebSocket port', '4317')
  .action(async (opts) => {
    const { startDashboard } = await import('./index.js')
    await startDashboard({ port: parseInt(opts.port, 10) })
  })
program.parse()
