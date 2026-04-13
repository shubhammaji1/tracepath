# @tracepath/node

> Node.js SDK for Tracepath — zero-config distributed tracing with automatic Express instrumentation and AsyncLocalStorage context propagation.

[![npm version](https://img.shields.io/npm/v/@tracepath/node)](https://www.npmjs.com/package/@tracepath/node)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/your-username/tracepath/blob/main/LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)

Add two lines to your Node.js application and get a live terminal dashboard showing every request trace — including child spans, errors, slow operations, and HTTP status codes — as they happen.

```
[v] >> GET /api/users          200   54ms
[v]   +- db.findAllUsers             48ms
[v] >> GET /api/users/1        200   18ms
[x] >> POST /api/checkout      500    8ms  ! Payment gateway timeout
[v] >> GET /api/products       200  703ms  [SLOW]
```

---

## Installation

```bash
npm install @tracepath/node
```

```bash
pnpm add @tracepath/node
```

```bash
yarn add @tracepath/node
```

---

## Quick start

```ts
// server.ts
// IMPORTANT: init() must be the very first import in your entry file.
// This ensures http/https are patched before any library uses them.
import { init, tracepathMiddleware } from '@tracepath/node'

const tracer = init({
  service: 'my-api',
  version: '1.0.0',
  dashboard: true,  // streams live traces to the CLI dashboard
})

import express from 'express'

const app = express()
app.use(express.json())
app.use(tracepathMiddleware(tracer))  // creates SERVER spans for every request

app.listen(3000, () => console.log('Server running on http://localhost:3000'))
```

Then start the dashboard in a separate terminal:

```bash
npx @tracepath/cli dashboard
```

Make a request and watch it appear live:

```bash
curl http://localhost:3000/api/users
```

---

## What gets traced automatically

Once `init()` is called, the SDK patches Node.js's built-in modules:

| What | How | Attributes recorded |
|---|---|---|
| Every outbound HTTP request | Patches `node:http` and `node:https` | `http.method`, `http.host`, `http.target`, `http.status_code` |
| Every outbound HTTPS request | Same patch, applied to `https` module | Same as above |
| W3C traceparent header injection | Added to every outbound request automatically | Links downstream services into the same trace |

This means HTTP calls made by `axios`, `got`, `node-fetch`, `undici`, and any other library that uses Node's built-in http module are traced without any additional setup.

---

## Express middleware

```ts
import { init, tracepathMiddleware } from '@tracepath/node'

const tracer = init({ service: 'my-api' })

app.use(tracepathMiddleware(tracer))
```

For each incoming request, the middleware:

- Creates a `SERVER` span named `{METHOD} {path}` (e.g. `GET /api/users`)
- Extracts the `traceparent` header to link browser and upstream service spans
- Records `http.method`, `http.target`, `http.host`, `http.scheme`, `net.peer.ip`
- Captures `http.status_code` when the response is sent
- Sets span status to `ERROR` for status codes >= 400
- Wraps the request handler in the active context so all child spans nest correctly

---

## Manual span creation

Use `startActiveSpan` to create child spans for database calls, cache operations, external API calls, or any business logic you want to measure:

```ts
import { getTracer } from '@tracepath/node'

app.get('/api/orders/:id', async (req, res) => {
  // This span automatically becomes a child of the SERVER span above
  const order = await getTracer().startActiveSpan('db.findOrder', async (span) => {
    span.setAttributes({
      'db.system': 'postgresql',
      'db.operation': 'SELECT',
      'db.statement': 'SELECT * FROM orders WHERE id = $1',
      'order.id': req.params.id,
    })

    const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id])
    span.setAttribute('db.rows_returned', result.rows.length)
    return result.rows[0]
  })

  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json(order)
})
```

### Nested spans

Spans nest automatically — no manual context threading needed:

```ts
app.post('/api/checkout', async (req, res) => {
  await getTracer().startActiveSpan('checkout.process', async (parent) => {

    // These all become children of checkout.process automatically
    const cart = await getTracer().startActiveSpan('db.findCart', async (span) => {
      span.setAttribute('user.id', req.body.userId)
      return await cartService.find(req.body.userId)
    })

    const payment = await getTracer().startActiveSpan('payment.charge', async (span) => {
      span.setAttribute('payment.amount', cart.total)
      span.setAttribute('payment.currency', 'USD')
      return await paymentService.charge(cart)
    })

    await getTracer().startActiveSpan('db.createOrder', async (span) => {
      span.setAttribute('order.total', payment.amount)
      return await orderService.create(cart, payment)
    })

  })
  res.json({ success: true })
})
```

Result in the dashboard:
```
[v] >> POST /api/checkout         200  342ms
[v]   +- checkout.process               338ms
[v]     +- db.findCart                   23ms
[v]     +- payment.charge               289ms
[v]     +- db.createOrder               24ms
```

### Error recording

```ts
await getTracer().startActiveSpan('email.send', async (span) => {
  try {
    await emailService.send({ to: user.email, template: 'welcome' })
  } catch (err) {
    // Records exception.type, exception.message, exception.stacktrace
    // and sets span status to ERROR automatically
    span.recordException(err)
    throw err
  }
})
```

### Span events

Mark significant moments inside a long-running span:

```ts
await getTracer().startActiveSpan('data.import', async (span) => {
  span.addEvent('import.started', { 'file.size_mb': 42 })

  const records = await parseFile(filePath)
  span.addEvent('file.parsed', { 'records.count': records.length })

  await db.bulkInsert(records)
  span.addEvent('db.insert.complete')

  span.setAttribute('records.imported', records.length)
})
```

---

## Context propagation

The Node.js SDK uses `AsyncLocalStorage` — Node.js's native async context primitive — to propagate the active span through your entire async call chain automatically.

This means you never need to pass a `context` or `span` parameter through your functions. The active context is always available via `getTracer()`, even across:

- `async/await`
- `Promise.then` and `Promise.all`
- `setTimeout` and `setInterval`
- Event emitters
- Stream handlers

```ts
// Context flows automatically through all of these:
async function processRequest(userId: string) {
  const user = await getUser(userId)        // child span of the active SERVER span
  const orders = await getOrders(user.id)   // also a child
  return formatResponse(user, orders)
}

async function getUser(id: string) {
  return getTracer().startActiveSpan('db.getUser', async (span) => {
    span.setAttribute('user.id', id)
    return db.query('SELECT * FROM users WHERE id = $1', [id])
  })
}
```

---

## Configuration

```ts
import { init } from '@tracepath/node'

init({
  // Required
  service: 'my-api',

  // Optional — metadata attached to every span
  version: '2.1.0',
  environment: 'production',    // defaults to process.env.NODE_ENV

  // Dashboard (development)
  dashboard: true,              // default: true when NODE_ENV !== 'production'
  dashboardUrl: 'ws://localhost:4317',  // default dashboard WebSocket URL

  // OTLP (production)
  otlpUrl: 'https://api.honeycomb.io/v1/traces',
  otlpHeaders: {
    'x-honeycomb-team': process.env.HONEYCOMB_API_KEY,
  },

  // Sampling
  sampleRate: 0.1,              // 0.1 = sample 10% of traces. Default: 1 (100%)

  // Auto-instrumentation
  instrumentHttp: true,         // patch http/https modules. Default: true
})
```

### Development vs production

The SDK automatically switches modes based on `NODE_ENV`:

| `NODE_ENV` | Default mode | What happens |
|---|---|---|
| `development` (or unset) | Dashboard mode | Spans stream to `ws://localhost:4317` via WebSocket |
| `production` | OTLP mode | Spans batched and sent to `otlpUrl` |

Override with `dashboard: true/false` explicitly.

---

## Production export

Switch to any OTLP backend with one config change — no application code changes needed:

```ts
init({
  service: 'my-api',
  environment: 'production',
  dashboard: false,
  otlpUrl: 'https://api.honeycomb.io/v1/traces',
  otlpHeaders: {
    'x-honeycomb-team': process.env.HONEYCOMB_API_KEY,
  },
  sampleRate: 0.1,  // sample 10% in production to control cost
})
```

### Supported backends

| Backend | `otlpUrl` |
|---|---|
| Honeycomb | `https://api.honeycomb.io/v1/traces` |
| Grafana Tempo | `http://your-tempo:4318/v1/traces` |
| Jaeger | `http://your-jaeger:4318/v1/traces` |
| Datadog Agent | `http://localhost:4318/v1/traces` |
| New Relic | `https://otlp.nr-data.net/v1/traces` |
| SigNoz | `http://your-signoz:4318/v1/traces` |
| AWS X-Ray (ADOT) | `http://localhost:4318/v1/traces` |

---

## Graceful shutdown

The SDK registers `SIGTERM` and `beforeExit` handlers to flush all buffered spans before your process exits. For manual control:

```ts
import { shutdown } from '@tracepath/node'

// Flush and close all connections
process.on('SIGINT', async () => {
  await shutdown()
  process.exit(0)
})
```

---

## API reference

### `init(options)`

Initializes the SDK. Must be called before any other import that you want traced.

Returns a `Tracer` instance.

### `getTracer()`

Returns the initialized `Tracer`. Throws if `init()` has not been called.

Use this to create spans anywhere in your application without passing the tracer as a parameter.

### `tracepathMiddleware(tracer)`

Returns an Express-compatible middleware function. Creates a `SERVER` span for every incoming request.

```ts
app.use(tracepathMiddleware(tracer))
```

### `shutdown()`

Flushes all pending spans and shuts down the export pipeline. Returns a `Promise<void>`.

### `contextManager`

The underlying `AsyncLocalStorage`-based context manager. Exported for advanced use cases.

```ts
import { contextManager } from '@tracepath/node'

// Run a function in a specific context
contextManager.with(someContext, () => {
  // all spans created here use someContext as parent
})

// Get the current active context
const ctx = contextManager.active()
```

---

## TypeScript

Full TypeScript support. No `@types/*` needed.

```ts
import type { Tracer, Span, Attributes, SpanKind } from '@tracepath/node'
```

---

## Requirements

- Node.js >= 18.0.0
- Optional peer dependency: `express >= 4.0.0` (only needed if using `tracepathMiddleware`)

---

## Part of the Tracepath ecosystem

| Package | Purpose |
|---|---|
| [`@tracepath/core`](https://www.npmjs.com/package/@tracepath/core) | Shared primitives (span types, context, exporters) |
| **`@tracepath/node`** | You are here |
| [`@tracepath/browser`](https://www.npmjs.com/package/@tracepath/browser) | Browser SDK with fetch instrumentation and Web Vitals |
| [`@tracepath/cli`](https://www.npmjs.com/package/@tracepath/cli) | Live terminal dashboard |

---

## License

MIT — see [LICENSE](https://github.com/your-username/tracepath/blob/main/LICENSE)
