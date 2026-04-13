# @tracepath/cli

> Real-time terminal dashboard for Tracepath — watch distributed traces appear live as your application handles requests.

[![npm version](https://img.shields.io/npm/v/@tracepath/cli)](https://www.npmjs.com/package/@tracepath/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/your-username/tracepath/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

```
tracepath | ws://localhost:4317 | q=quit 1=traces 2=errors

spans 12   errors 1   p50 23ms   p99 847ms   clients 1

[1] traces   [2] errors (1)

[v] >> GET /api/users          200   54ms
[v]   +- db.findAllUsers             48ms
[v] >> GET /api/users/1        200   18ms
[v]   +- db.findUser                 12ms
[v] >> GET /api/slow           200  847ms  [SLOW]
[x] >> POST /api/checkout      500    8ms  ! Payment gateway timeout
```

---

## Installation

### Run without installing (recommended)

```bash
npx @tracepath/cli dashboard
```

### Install globally

```bash
npm install -g @tracepath/cli
```

```bash
pnpm add -g @tracepath/cli
```

---

## Usage

### Start the dashboard

```bash
# Default port 4317
tracepath dashboard

# Custom port
tracepath dashboard --port 4318
tracepath dashboard -p 4318
```

When the dashboard starts, it opens a WebSocket server. Your application (using `@tracepath/node`) connects to this server and streams spans in real time.

### Connect your application

```ts
// Your Node.js server — install @tracepath/node
import { init } from '@tracepath/node'

init({
  service: 'my-api',
  dashboard: true,                     // enabled by default in development
  dashboardUrl: 'ws://localhost:4317', // default — matches the CLI dashboard
})
```

Start the dashboard first, then your application. The SDK reconnects automatically if the connection is dropped.

---

## Dashboard features

### Traces tab `[1]`

Shows incoming traces in real time, newest first. Each trace displays all of its spans in a waterfall layout with child spans indented under their parents.

```
[v] >> GET /api/checkout       200  342ms
[v]   +- auth.validateToken          12ms
[v]   +- db.findCart                 23ms
[v]   +- payment.charge             289ms
[v]   +- db.createOrder              14ms
```

**Span indicators:**

| Symbol | Meaning |
|---|---|
| `[v]` | Span completed successfully |
| `[x]` | Span completed with an error |
| `>>` | Root span (top-level request) |
| `+-` | Child span (nested operation) |
| `[SLOW]` | Span duration exceeded 200ms |

**Information shown per span:**
- Span name (e.g. `GET /api/users`, `db.findAllUsers`)
- HTTP status code (when present)
- Duration in milliseconds
- Error message (for failed spans)

### Errors tab `[2]`

Shows all spans that completed with an error, most recent first. Includes the error type and message.

```
[2] errors (3)

[x] >> POST /api/payment       500    8ms  ! Connection timeout
      TypeError: Payment gateway timeout

[x] >> GET /api/users/99       404   12ms  ! HTTP 404
[x] >> DELETE /api/orders/1    403    5ms  ! HTTP 403
```

### Stats bar

The top bar shows live aggregate statistics across all received spans:

| Stat | Description |
|---|---|
| `spans` | Total spans received since dashboard started |
| `errors` | Total error spans |
| `p50` | 50th percentile (median) duration in ms |
| `p99` | 99th percentile duration in ms — reflects worst-case user experience |
| `clients` | Number of SDK instances currently connected |

The `p99` value turns yellow when above 500ms as a quick visual warning.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `1` | Switch to Traces tab |
| `2` | Switch to Errors tab |
| `q` | Quit the dashboard |

---

## Full example workflow

**Terminal 1 — Start the dashboard:**

```bash
npx @tracepath/cli dashboard
```

**Terminal 2 — Start your application:**

```bash
node server.js
# [tracepath] my-api -> ws://localhost:4317
# Server running on http://localhost:3000
```

**Terminal 3 — Make some requests:**

```bash
curl http://localhost:3000/api/users       # normal request
curl http://localhost:3000/api/users/1     # fast DB lookup
curl http://localhost:3000/api/reports     # slow operation
curl http://localhost:3000/api/broken      # triggers an error
```

**Terminal 1 — Watch spans appear:**

```
spans 4   errors 1   p50 45ms   p99 623ms   clients 1

[v] >> GET /api/users          200   52ms
[v]   +- db.findAllUsers             47ms
[v] >> GET /api/users/1        200   18ms
[v]   +- db.findUser                 14ms
[v] >> GET /api/reports        200  623ms  [SLOW]
[v]   +- report.generate            618ms  [SLOW]
[x] >> GET /api/broken         500    6ms  ! Internal server error
```

Press `2` to see the error details, then `1` to go back to traces.

---

## How it works

The CLI starts a WebSocket server that listens for span data from connected SDKs.

```
@tracepath/node  ──────────────────┐
                                   ├──▶  WebSocket server (port 4317)  ──▶  Ink UI
@tracepath/browser ──▶ relay ──────┘
```

- `@tracepath/node` connects directly via WebSocket
- `@tracepath/browser` posts spans to a relay endpoint on your dev server (e.g. `/__tracepath/spans`), which forwards them to this dashboard
- Multiple services can connect simultaneously — all their spans appear in one unified view

The dashboard is built with [Ink](https://github.com/vadimdemedes/ink), which renders React components in the terminal.

---

## CLI options

```bash
tracepath --help
# Usage: tracepath [options] [command]
# Real-time observability dashboard
#
# Options:
#   -V, --version        output the version number
#   -h, --help           display help
#
# Commands:
#   dashboard [options]  Start the CLI dashboard
#     -p, --port <number>  WebSocket server port (default: "4317")

tracepath dashboard --help
# Options:
#   -p, --port <number>  WebSocket server port (default: "4317")
```

---

## Windows users

If you see garbled characters in the dashboard, run this command in your terminal before starting:

```powershell
chcp 65001
```

This switches the Windows terminal to UTF-8 mode. You only need to do this once per terminal session. Windows Terminal handles this automatically.

---

## Programmatic API

The dashboard server can also be used programmatically in Node.js:

```ts
import { startDashboard, DashboardServer } from '@tracepath/cli'

// Start the full dashboard (Ink UI + WebSocket server)
await startDashboard({ port: 4317 })

// Or use just the WebSocket server without the UI
const server = new DashboardServer(4317)
await server.start()

server.onSpan((event) => {
  console.log(`Received span: ${event.span.name} (${event.source})`)
  console.log(`Duration: ${event.span.duration}ms`)
  console.log(`Status: ${event.span.status.code}`)
})

// Send spans from a relay endpoint (browser SDK)
app.post('/__tracepath/spans', (req, res) => {
  server.receiveRelayedSpans(req.body.spans, 'browser')
  res.sendStatus(200)
})

console.log(`Connected clients: ${server.connectedClients}`)
console.log(`Total spans received: ${server.spansReceived}`)

// Shut down when done
await server.stop()
```

---

## Requirements

- Node.js >= 18.0.0

---

## Part of the Tracepath ecosystem

| Package | Purpose |
|---|---|
| [`@tracepath/core`](https://www.npmjs.com/package/@tracepath/core) | Shared primitives (span types, context, exporters) |
| [`@tracepath/node`](https://www.npmjs.com/package/@tracepath/node) | Node.js SDK with auto-instrumentation and Express middleware |
| [`@tracepath/browser`](https://www.npmjs.com/package/@tracepath/browser) | Browser SDK with fetch instrumentation and Web Vitals |
| **`@tracepath/cli`** | You are here |

---

## License

MIT — see [LICENSE](https://github.com/your-username/tracepath/blob/main/LICENSE)
