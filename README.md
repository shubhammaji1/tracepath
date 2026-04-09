<div align="center">

# tracepath

**Universal real-time observability SDK for Node.js and browser**

Zero-config distributed tracing with a live CLI dashboard.  
See every request — from browser click through API handler through database query — as a single correlated trace, live in your terminal.

[![CI](https://github.com/your-username/tracepath/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/tracepath/actions)
[![npm](https://img.shields.io/npm/v/@tracepath/core?label=%40tracepath%2Fcore)](https://www.npmjs.com/package/@tracepath/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)

</div>

---

## The problem

Debugging a full-stack app means switching between:

- Browser DevTools for frontend errors and network calls
- A terminal tail for backend logs
- Manual correlation between a fetch request and the server handler that served it
- No single view of what actually happened end-to-end

**Tracepath solves this.** One SDK, two lines of setup, and you get a live terminal dashboard showing every request as a complete trace — from the browser through your API into your database — as it happens.

```
tracepath | ws://localhost:4317 | q=quit 1=traces 2=errors

spans 12   errors 1   p50 23ms   p99 847ms   clients 1

[1] traces   [2] errors (1)

[v] >> GET /api/users          200   54ms
[v]   +- db.findAllUsers             48ms
[v] >> GET /api/users/1        200   18ms
[v]   +- db.findUser                 12ms
[v] >> GET /api/slow           200  847ms  [SLOW]
[x] >> POST /api/checkout      500    8ms  ! DB connection refused
```

---

## Packages

This is a monorepo. You install only what you need.

| Package | Description | Install |
|---|---|---|
| [`@tracepath/core`](packages/core) | Span types, context, W3C propagation, OTLP exporter | `npm i @tracepath/core` |
| [`@tracepath/node`](packages/node) | Node.js SDK — auto-instrumentation, Express middleware | `npm i @tracepath/node` |
| [`@tracepath/browser`](packages/browser) | Browser SDK — fetch instrumentation, Web Vitals | `npm i @tracepath/browser` |
| [`@tracepath/cli`](packages/cli) | Terminal dashboard — live trace viewer | `npm i -g @tracepath/cli` |

---

## Quick start

### Step 1 — Start the dashboard

```bash
npx @tracepath/cli dashboard
```

Or install globally:

```bash
npm install -g @tracepath/cli
tracepath dashboard
```

### Step 2 — Instrument your Node.js server

```bash
npm install @tracepath/node
```

```ts
// server.ts — init() MUST be the very first import
import { init, tracepathMiddleware } from '@tracepath/node'

const tracer = init({
  service: 'my-api',
  version: '1.0.0',
  dashboard: true,   // streams spans to ws://localhost:4317
})

import express from 'express'
const app = express()

// One line adds SERVER spans for every incoming request
app.use(tracepathMiddleware(tracer))

app.listen(3000)
```

### Step 3 — Instrument your browser app (optional)

```bash
npm install @tracepath/browser
```

```ts
// main.ts — your app entry point
import { init } from '@tracepath/browser'

init({
  service: 'web-client',
  version: '1.0.0',
})
// fetch() calls are now traced and linked to your backend spans automatically
```

Now make some requests and watch spans appear live in the terminal.

---

## Features

### Real-time CLI dashboard

The `@tracepath/cli` package starts a WebSocket server and renders a live trace viewer in your terminal using [Ink](https://github.com/vadimdemedes/ink).

```bash
tracepath dashboard
tracepath dashboard --port 4318   # custom port
```

**What the dashboard shows:**

- **Live traces** — every request rendered as a waterfall the moment it completes, with child spans nested underneath
- **Slow span detection** — spans over 200ms are flagged with `[SLOW]`
- **Error tracking** — failed spans appear in the `[2] errors` tab with their error type and message
- **Stats bar** — real-time `spans`, `errors`, `p50`, `p99`, and connected `clients` count
- **Multi-client** — Node.js and browser SDKs can connect simultaneously; all spans flow to the same dashboard

**Keyboard shortcuts:**

| Key | Action |
|---|---|
| `1` | Switch to Traces tab |
| `2` | Switch to Errors tab |
| `q` | Quit the dashboard |

---

### Node.js SDK (`@tracepath/node`)

#### Auto-instrumentation

The SDK automatically patches Node.js's built-in `http` and `https` modules at startup. Every outbound HTTP/HTTPS request made by your application — including requests made by third-party libraries — is automatically traced as a `CLIENT` span with the `traceparent` header injected.

```ts
import { init } from '@tracepath/node'

// Call before any other imports
const tracer = init({ service: 'my-api' })
```

This patches happen before your app code runs, so libraries like `axios`, `node-fetch`, `got`, and the native `fetch` all get traced automatically.

#### Express middleware

```ts
import { init, tracepathMiddleware } from '@tracepath/node'

const tracer = init({ service: 'my-api' })

app.use(tracepathMiddleware(tracer))
```

The middleware:
- Creates a `SERVER` span for every incoming request
- Extracts the W3C `traceparent` header from the request — so browser spans and upstream service spans link into the same trace
- Records `http.method`, `http.target`, `http.host`, `http.scheme`, `net.peer.ip`
- Captures `http.status_code` on response
- Automatically marks spans as `ERROR` for status codes >= 400
- Wraps `next()` in the request context so child spans created in route handlers are automatically nested correctly

#### Manual span creation

```ts
import { getTracer } from '@tracepath/node'

app.get('/users', async (req, res) => {
  // startActiveSpan automatically makes this a child of the SERVER span
  const users = await getTracer().startActiveSpan('db.findAllUsers', async (span) => {
    span.setAttributes({
      'db.system': 'postgresql',
      'db.operation': 'SELECT',
      'db.statement': 'SELECT * FROM users',
    })

    const result = await db.query('SELECT * FROM users')
    span.setAttribute('db.rows_returned', result.rows.length)
    return result.rows
  })

  res.json(users)
})
```

#### AsyncLocalStorage context propagation

The Node.js SDK uses `AsyncLocalStorage` (Node.js's native async context mechanism) to propagate trace context automatically through every `async/await` chain, `Promise.then`, `setTimeout`, and event listener — without any manual context passing.

This means you never need to thread a `context` parameter through your code. The active span is always available via `getTracer()`.

#### Configuration

```ts
init({
  service: 'my-api',           // required — service name shown in dashboard
  version: '2.1.0',            // optional — shown in spans
  environment: 'production',   // optional — defaults to NODE_ENV
  dashboard: true,             // stream to CLI dashboard (default: true in dev)
  dashboardUrl: 'ws://localhost:4317',  // dashboard WebSocket URL
  otlpUrl: 'http://localhost:4318/v1/traces',  // OTLP endpoint (production)
  otlpHeaders: {               // auth headers for cloud backends
    'x-honeycomb-team': process.env.HONEYCOMB_API_KEY,
  },
  sampleRate: 0.1,             // sample 10% of traces (default: 1 = 100%)
  instrumentHttp: true,        // auto-patch http/https (default: true)
})
```

#### Graceful shutdown

The SDK registers `SIGTERM` and `beforeExit` handlers to flush all pending spans before the process exits. You can also trigger this manually:

```ts
import { shutdown } from '@tracepath/node'

process.on('SIGINT', async () => {
  await shutdown()
  process.exit(0)
})
```

---

### Browser SDK (`@tracepath/browser`)

#### Fetch auto-instrumentation

The browser SDK wraps `globalThis.fetch` to automatically trace every outbound request:

```ts
import { init } from '@tracepath/browser'

init({ service: 'web-client' })

// This is now traced — no other changes needed
const res = await fetch('/api/users')
```

Each traced fetch call:
- Creates a `CLIENT` span with `http.method`, `http.url`, `http.status_code`, `http.duration_ms`
- Injects the `traceparent` header so your Node.js backend continues the same trace
- Records the response status and duration
- Marks spans as `ERROR` for status >= 400
- Records exceptions on network failures

#### Exclude specific URLs

```ts
init({
  service: 'web-client',
  ignoreFetchUrls: [
    '/health',                    // string — exact substring match
    /^https:\/\/analytics\./,     // RegExp — pattern match
    'sentry.io',
  ],
})
```

#### Web Vitals tracking

The browser SDK automatically records [Core Web Vitals](https://web.dev/vitals/) as spans using `PerformanceObserver`:

| Vital | What it measures | Good threshold |
|---|---|---|
| **LCP** — Largest Contentful Paint | Loading performance | < 2.5s |
| **TTFB** — Time to First Byte | Server response time | < 800ms |
| **INP** — Interaction to Next Paint | Responsiveness (2024 standard) | < 200ms |
| **CLS** — Cumulative Layout Shift | Visual stability | < 0.1 |
| **FCP** — First Contentful Paint | Perceived load speed | < 1.8s |

Each vital is recorded as a span with `web_vital.name`, `web_vital.value_ms`, and `web_vital.rating` (`good`, `needs-improvement`, or `poor`).

#### Dev mode vs production mode

The SDK automatically detects the environment:

```ts
// Development (localhost) — posts spans to /__tracepath/spans relay on your dev server
// which forwards them to the CLI dashboard
init({ service: 'web-client' })

// Production — posts spans to your OTLP endpoint
init({
  service: 'web-client',
  devMode: false,
  otlpUrl: '/v1/traces',
  otlpHeaders: { 'x-honeycomb-team': process.env.HONEYCOMB_API_KEY },
  sampleRate: 0.05,  // sample 5% in production
})
```

#### Configuration

```ts
init({
  service: 'web-client',         // required
  version: '1.0.0',              // optional
  environment: 'production',     // optional
  devMode: true,                 // auto-detected from location.hostname
  relayUrl: '/__tracepath/spans',// dev relay endpoint
  otlpUrl: '/v1/traces',         // OTLP endpoint (production)
  otlpHeaders: {},               // auth headers
  sampleRate: 1,                 // 0-1 sampling ratio
  instrumentFetch: true,         // auto-wrap fetch (default: true)
  instrumentWebVitals: true,     // record Core Web Vitals (default: true)
  ignoreFetchUrls: [],           // URLs to skip
})
```

---

### Core SDK (`@tracepath/core`)

The foundation package. You typically use `@tracepath/node` or `@tracepath/browser` instead, but `@tracepath/core` is fully usable standalone for custom environments.

#### Span API

```ts
import {
  TracepathTracerProvider,
  BatchSpanProcessor,
  OtlpHttpExporter,
  AlwaysOnSampler,
  SpanKind,
  SpanStatusCode,
} from '@tracepath/core'

const provider = new TracepathTracerProvider(
  { serviceName: 'my-service', serviceVersion: '1.0.0' },
  new BatchSpanProcessor(new OtlpHttpExporter()),
  new AlwaysOnSampler(),
)

const tracer = provider.getTracer('my-instrumentation', '1.0.0')

// Manual span lifecycle
const span = tracer.startSpan('my.operation', {
  kind: SpanKind.INTERNAL,
  attributes: { 'custom.key': 'value' },
})
span.setAttribute('result.count', 42)
span.addEvent('cache.miss', { 'cache.key': 'user:123' })
span.end()

// Automatic lifecycle with startActiveSpan
const result = await tracer.startActiveSpan('db.query', async (span) => {
  span.setAttribute('db.statement', 'SELECT * FROM orders')
  try {
    const rows = await db.query('SELECT * FROM orders')
    span.setAttribute('db.rows', rows.length)
    return rows
  } catch (err) {
    span.recordException(err)  // records error type, message, and stack trace
    throw err
  }
})
```

#### Span methods

| Method | Description |
|---|---|
| `setAttribute(key, value)` | Set a single attribute. Chainable. |
| `setAttributes(attrs)` | Set multiple attributes at once. Chainable. |
| `setStatus(code, message?)` | Set span status: `SpanStatusCode.OK` or `SpanStatusCode.ERROR` |
| `recordException(error)` | Record an Error with type, message, and stack trace as a span event |
| `addEvent(name, attrs?, timestamp?)` | Add a timestamped event to the span timeline |
| `updateName(name)` | Update the span name after creation |
| `end(timestamp?)` | Finalize the span and export it. Safe to call multiple times. |
| `isEnded()` | Returns `true` if `end()` has been called |

#### W3C Trace Context propagation

Tracepath implements the [W3C Trace Context](https://www.w3.org/TR/trace-context/) standard for cross-service trace propagation:

```ts
import { injectTraceContext, extractTraceContext } from '@tracepath/core'

// Outbound request — inject traceparent header
const headers: Record<string, string> = {}
injectTraceContext(activeContext, headers)
// headers['traceparent'] = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

// Incoming request — extract and continue the trace
const context = extractTraceContext(ROOT_CONTEXT, req.headers)
const span = tracer.startSpan('handler', { context })
```

The format: `00-{32-char traceId}-{16-char spanId}-{flags}`

This standard is supported by every modern APM tool, which means a trace that starts in a browser can flow through multiple microservices and all appear as a single correlated trace in Jaeger, Honeycomb, Datadog, or any other OTLP backend.

#### Samplers

Control what percentage of traces are recorded:

```ts
import {
  AlwaysOnSampler,        // record everything (default in development)
  AlwaysOffSampler,       // record nothing
  TraceIdRatioSampler,    // record X% of traces, deterministically by traceId
  ParentBasedSampler,     // respect the sampling decision of the parent span
} from '@tracepath/core'

// Sample 10% of root spans, always follow parent decisions for child spans
const sampler = new ParentBasedSampler(new TraceIdRatioSampler(0.1))
```

**Why `ParentBasedSampler` matters:** Without it, a trace that starts in the browser (sampled) might not be sampled in the backend — giving you a partial trace. `ParentBasedSampler` ensures that if a trace is sampled anywhere, it's sampled everywhere.

#### Processors

```ts
import { BatchSpanProcessor, SimpleSpanProcessor } from '@tracepath/core'

// Development — export each span immediately
new SimpleSpanProcessor(exporter)

// Production — buffer spans and export in batches (better performance)
new BatchSpanProcessor(exporter, {
  maxQueueSize: 512,           // drop spans if queue exceeds this
  maxExportBatchSize: 128,     // max spans per export call
  scheduledDelayMillis: 5000,  // export every 5 seconds
  exportTimeoutMillis: 30000,  // timeout per export attempt
})
```

#### OTLP HTTP exporter

Ships spans to any [OpenTelemetry-compatible backend](https://opentelemetry.io/ecosystem/vendors/):

```ts
import { OtlpHttpExporter } from '@tracepath/core'

new OtlpHttpExporter({
  url: 'https://api.honeycomb.io/v1/traces',
  headers: { 'x-honeycomb-team': 'your-api-key' },
  timeoutMillis: 10000,
})
```

Compatible with: **Jaeger**, **Grafana Tempo**, **Honeycomb**, **Datadog**, **New Relic**, **AWS X-Ray** (via ADOT collector), **Signoz**, and any other OTLP HTTP receiver.

---

## Cross-stack tracing

The most powerful feature of Tracepath is linking browser spans to backend spans into a single trace.

**How it works:**

1. Browser SDK intercepts a `fetch('/api/users')` call
2. SDK creates a `CLIENT` span and injects `traceparent: 00-{traceId}-{spanId}-01` into the request headers
3. Node.js server receives the request
4. `tracepathMiddleware` extracts the `traceparent` header and creates a `SERVER` span using the same `traceId`
5. Any child spans created in the route handler (DB queries, cache lookups, downstream API calls) inherit the same `traceId`
6. All spans appear as a single correlated trace in the dashboard

```
[browser]  GET /api/checkout   CLIENT  2ms
  [server]  POST /api/checkout  SERVER  234ms
    [server]  auth.validateToken        12ms
    [server]  db.findCart               23ms
    [server]  payment.charge           189ms  [SLOW]
    [server]  db.updateOrder            8ms
```

No configuration needed — this works automatically when both SDKs are installed and `tracepathMiddleware` is used.

---

## Production setup

Switch from the CLI dashboard to a production observability backend with one config change:

### Node.js

```ts
init({
  service: 'my-api',
  environment: 'production',
  dashboard: false,   // disable CLI dashboard
  otlpUrl: 'https://api.honeycomb.io/v1/traces',
  otlpHeaders: {
    'x-honeycomb-team': process.env.HONEYCOMB_API_KEY!,
  },
  sampleRate: 0.1,    // sample 10% of traces to control cost
})
```

### Browser

```ts
init({
  service: 'web-client',
  devMode: false,
  otlpUrl: '/v1/traces',         // proxied through your own backend
  sampleRate: 0.05,              // sample 5% in production
})
```

### Supported backends

| Backend | OTLP URL |
|---|---|
| Honeycomb | `https://api.honeycomb.io/v1/traces` |
| Grafana Tempo | `http://your-tempo-host:4318/v1/traces` |
| Jaeger | `http://your-jaeger-host:4318/v1/traces` |
| Datadog (via Agent) | `http://localhost:4318/v1/traces` |
| New Relic | `https://otlp.nr-data.net/v1/traces` |
| SigNoz | `http://your-signoz-host:4318/v1/traces` |
| AWS X-Ray (ADOT) | `http://localhost:4318/v1/traces` |

---

## Try the example app

A working Express example is included in the repository:

```bash
# Terminal 1 — start the dashboard
npx @tracepath/cli dashboard

# Terminal 2 — start the example server
cd examples/express-app
npm install
node src/server.js

# Terminal 3 — fire some requests
curl http://localhost:3000/users         # normal trace with DB child span
curl http://localhost:3000/users/1       # single user lookup
curl http://localhost:3000/slow          # triggers [SLOW] flag in dashboard
curl http://localhost:3000/error         # triggers error tab in dashboard
```

Watch the traces appear live in Terminal 1.

---

## Project structure

```
tracepath/
├── packages/
│   ├── core/           @tracepath/core    Span types, context, exporters, samplers
│   ├── node/           @tracepath/node    Node.js SDK, Express middleware, http patching
│   ├── browser/        @tracepath/browser Browser SDK, fetch instrumentation, Web Vitals
│   └── cli/            @tracepath/cli     Ink terminal dashboard, WebSocket server
├── examples/
│   └── express-app/    Working Express + Tracepath example
├── .github/
│   └── workflows/      CI (ci.yml) and automated npm releases (release.yml)
├── .changeset/         Changeset config for automated versioning
├── tsconfig.base.json  Shared TypeScript config
├── turbo.json          Turborepo pipeline config
└── pnpm-workspace.yaml Workspace definition
```

---

## Development

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

```bash
# Install pnpm if you don't have it
npm install -g pnpm
```

### Setup

```bash
git clone https://github.com/your-username/tracepath.git
cd tracepath
pnpm install
pnpm build
pnpm test
```

### Commands

```bash
pnpm build        # build all packages (core first, then others in parallel)
pnpm dev          # watch mode — rebuilds on file changes
pnpm test         # run all tests
pnpm typecheck    # TypeScript type checking across all packages
pnpm clean        # delete all dist/ directories
pnpm format       # format all files with Prettier
```

### Running a single package

```bash
cd packages/core
pnpm build
pnpm test

cd packages/cli
pnpm dev    # watch mode for the dashboard
```

### Making a change and releasing

```bash
# 1. Make your code changes

# 2. Create a changeset describing what changed
pnpm changeset

# 3. Commit and push
git add .
git commit -m "feat: your description"
git push

# GitHub Actions will open a "Version Packages" PR.
# Merge it to trigger an automatic npm publish.
```

---

## Architecture

### Why not just wrap OpenTelemetry?

OpenTelemetry is the right production standard and Tracepath exports in OTLP format so you can send data to any OTel backend. But OTel's developer experience is genuinely painful — 20+ packages, hundreds of lines of setup, no built-in developer experience beyond vendor dashboards.

Tracepath is the missing DX layer: zero-config setup, instant local feedback via the CLI dashboard, and a clean path to production via OTLP export with one config change.

### Why AsyncLocalStorage?

`AsyncLocalStorage` is Node.js's native mechanism for propagating context through async chains without manual threading. It's the same primitive used by `dd-trace` and `@opentelemetry/context-async-hooks`. No Zone.js, no Promise monkey-patching — just the platform's own API, available since Node.js 12.

### Why W3C Trace Context?

The `traceparent` header is the [IETF standard](https://www.w3.org/TR/trace-context/) for distributed trace propagation. Every modern APM tool supports it. This means a Tracepath trace can flow into Datadog, Honeycomb, Grafana, or any other backend without any transformation — and upstream services that don't use Tracepath but do emit `traceparent` headers will automatically become part of your traces.

### Why OTLP?

[OpenTelemetry Protocol](https://opentelemetry.io/docs/specs/otlp/) is the vendor-neutral standard for telemetry data. Implementing OTLP means one exporter works with every backend. You're never locked into a specific vendor.

---

## TypeScript support

All packages are written in TypeScript and ship full type declarations. No `@types/*` packages needed.

```ts
import type {
  Span,
  Trace,
  Attributes,
  SpanKind,
  SpanStatus,
  SpanStatusCode,
  SpanEvent,
  Tracer,
  MutableSpan,
  Resource,
} from '@tracepath/core'
```

---

## Requirements

| Package | Node.js | Browser |
|---|---|---|
| `@tracepath/core` | >= 18.0.0 | Modern browsers (ES2020+) |
| `@tracepath/node` | >= 18.0.0 | — |
| `@tracepath/browser` | — | Chrome 80+, Firefox 75+, Safari 14+ |
| `@tracepath/cli` | >= 18.0.0 | — |

**Windows:** Fully supported. Run `chcp 65001` in your terminal before starting the dashboard to enable UTF-8 rendering, or use Windows Terminal which handles this automatically.

---

## Contributing

Contributions are welcome. Please open an issue before submitting a PR for significant changes.

```bash
# Fork, clone, and set up
git clone https://github.com/your-username/tracepath.git
cd tracepath
pnpm install
pnpm build

# Create a branch
git checkout -b feat/your-feature

# Make changes, then create a changeset
pnpm changeset

# Push and open a PR
git push origin feat/your-feature
```

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with [Ink](https://github.com/vadimdemedes/ink) · Exports [OTLP](https://opentelemetry.io/docs/specs/otlp/) · Follows [W3C Trace Context](https://www.w3.org/TR/trace-context/)

</div>
