# @tracepath/browser

> Browser SDK for Tracepath — automatic fetch instrumentation, Core Web Vitals tracking, and cross-stack trace correlation with your Node.js backend.

[![npm version](https://img.shields.io/npm/v/@tracepath/browser)](https://www.npmjs.com/package/@tracepath/browser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/your-username/tracepath/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)

Add one `init()` call to your frontend and every `fetch()` request gets traced — linked by the same `traceId` as the backend span that handled it.

```
[v] >> GET /api/users          200   54ms        <- browser fetch span
[v] >> GET /api/users          200   52ms        <- server span (same trace!)
[v]   +- db.findAllUsers             47ms        <- database child span
```

---

## Installation

```bash
npm install @tracepath/browser
```

```bash
pnpm add @tracepath/browser
```

```bash
yarn add @tracepath/browser
```

---

## Quick start

```ts
// main.ts (or your app entry point)
import { init } from '@tracepath/browser'

init({
  service: 'web-client',
  version: '1.0.0',
})
```

That is all. From this point on:

- Every `fetch()` call in your app creates a `CLIENT` span
- The `traceparent` header is automatically injected into each request
- Your Node.js backend (using `@tracepath/node`) continues the same trace
- Core Web Vitals are recorded as spans using `PerformanceObserver`
- Spans are sent to the CLI dashboard in development

---

## Cross-stack tracing — how it works

The most powerful feature of this package is automatically linking browser spans to your backend spans into a single correlated trace.

**Step by step:**

1. User clicks a button → your code calls `fetch('/api/checkout')`
2. Browser SDK intercepts the call, creates a `CLIENT` span, injects:
   ```
   traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
   ```
3. Your Node.js server receives the request
4. `tracepathMiddleware` extracts the header, creates a `SERVER` span with the **same `traceId`**
5. Database queries inside the handler become child spans of the SERVER span
6. All spans appear as one trace in the dashboard:

```
[v] >> POST /api/checkout    200  342ms
[v]   +- db.findCart               23ms
[v]   +- payment.charge           289ms
[v]   +- db.createOrder            24ms
```

No manual configuration required — this works automatically when both SDKs are installed.

---

## Fetch instrumentation

The SDK wraps `globalThis.fetch` to trace every outbound request:

```ts
// Before init() — untraced
const res = await fetch('/api/users')

// After init() — automatically traced
import { init } from '@tracepath/browser'
init({ service: 'web-client' })

const res = await fetch('/api/users')  // traced, traceparent header injected
```

### What each fetch span records

| Attribute | Value |
|---|---|
| `http.method` | `GET`, `POST`, `PUT`, `DELETE`, etc. |
| `http.url` | Full URL of the request |
| `http.status_code` | Response status (200, 404, 500, etc.) |
| `http.duration_ms` | Round-trip time in milliseconds |

Spans with status >= 400 are automatically marked as errors.

### Excluding specific URLs

```ts
init({
  service: 'web-client',
  ignoreFetchUrls: [
    '/health',                          // string — substring match
    /^https:\/\/analytics\./,           // RegExp — pattern match
    'sentry.io',                        // any URL containing this string
    '/__tracepath',                     // exclude the relay endpoint itself
  ],
})
```

---

## Web Vitals tracking

The SDK automatically records [Core Web Vitals](https://web.dev/vitals/) using the browser's `PerformanceObserver` API. No additional configuration needed.

### Vitals tracked

| Vital | Full name | What it measures | Good | Needs improvement | Poor |
|---|---|---|---|---|---|
| **LCP** | Largest Contentful Paint | Loading performance — when the largest visible element renders | < 2.5s | 2.5s–4s | > 4s |
| **TTFB** | Time to First Byte | Server response time — how quickly the server starts responding | < 800ms | 800ms–1.8s | > 1.8s |
| **INP** | Interaction to Next Paint | Responsiveness to user input (2024 standard) | < 200ms | 200ms–500ms | > 500ms |
| **CLS** | Cumulative Layout Shift | Visual stability — how much the page jumps around | < 0.1 | 0.1–0.25 | > 0.25 |
| **FCP** | First Contentful Paint | Perceived load speed — when first content appears | < 1.8s | 1.8s–3s | > 3s |

Each vital creates a span with:
- `web_vital.name` — e.g. `LCP`
- `web_vital.value_ms` — the measured value in milliseconds
- `web_vital.rating` — `good`, `needs-improvement`, or `poor`

---

## Dev mode vs production mode

The SDK automatically detects the environment based on `location.hostname`:

### Development (localhost)

Spans are posted to `/__tracepath/spans` on your dev server, which relays them to the CLI dashboard running on `ws://localhost:4317`.

```ts
init({
  service: 'web-client',
  // devMode is true automatically when location.hostname === 'localhost'
})
```

### Production

Spans are batched and sent directly to your OTLP endpoint.

```ts
init({
  service: 'web-client',
  devMode: false,
  otlpUrl: '/v1/traces',    // proxied through your backend (avoids CORS issues)
  sampleRate: 0.05,         // sample 5% in production to control volume
})
```

Or with a direct OTLP connection:

```ts
init({
  service: 'web-client',
  devMode: false,
  otlpUrl: 'https://api.honeycomb.io/v1/traces',
  otlpHeaders: {
    'x-honeycomb-team': 'your-api-key',
  },
})
```

---

## Framework integration

### React

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { init } from '@tracepath/browser'
import App from './App.tsx'

// Initialize before rendering
init({
  service: 'my-react-app',
  version: import.meta.env.VITE_APP_VERSION,
  environment: import.meta.env.MODE,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

### Vue

```ts
// src/main.ts
import { createApp } from 'vue'
import { init } from '@tracepath/browser'
import App from './App.vue'

init({
  service: 'my-vue-app',
  version: __APP_VERSION__,
})

createApp(App).mount('#app')
```

### Next.js

```ts
// app/layout.tsx or pages/_app.tsx
'use client'
import { useEffect } from 'react'
import { init } from '@tracepath/browser'

export function TracepathProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    init({
      service: 'my-next-app',
      version: process.env.NEXT_PUBLIC_APP_VERSION,
      ignoreFetchUrls: ['/_next', '/api/health'],
    })
  }, [])

  return <>{children}</>
}
```

### Vanilla JavaScript

```html
<script type="module">
  import { init } from 'https://esm.sh/@tracepath/browser@0.1.0'

  init({
    service: 'my-site',
    version: '1.0.0',
  })
</script>
```

---

## Manual span creation

```ts
import { getTracer } from '@tracepath/browser'
import { SpanKind } from '@tracepath/browser'

// Trace a user interaction
async function handleCheckout() {
  const tracer = getTracer()

  await tracer.startActiveSpan('checkout.submit', async (span) => {
    span.setAttribute('cart.items', cartItems.length)
    span.setAttribute('cart.total_usd', cartTotal)

    try {
      const result = await submitOrder(cartItems)
      span.setAttribute('order.id', result.orderId)
    } catch (err) {
      span.recordException(err)
      throw err
    }
  })
}
```

---

## Configuration reference

```ts
import { init } from '@tracepath/browser'

init({
  // Required
  service: 'web-client',

  // Optional metadata
  version: '1.0.0',
  environment: 'production',

  // Environment detection
  devMode: true,                          // auto-detected from location.hostname
  relayUrl: '/__tracepath/spans',         // relay endpoint in dev mode

  // Production OTLP
  otlpUrl: '/v1/traces',
  otlpHeaders: { 'x-api-key': '...' },

  // Sampling
  sampleRate: 1,                          // 0-1, default: 1 (100%)

  // Instrumentation toggles
  instrumentFetch: true,                  // default: true
  instrumentWebVitals: true,              // default: true

  // URL exclusions
  ignoreFetchUrls: ['/health', /analytics/],
})
```

---

## `getTracer()`

Returns the initialized tracer for manual span creation.

```ts
import { getTracer } from '@tracepath/browser'

const tracer = getTracer()
const span = tracer.startSpan('my.operation')
span.setAttribute('key', 'value')
span.end()
```

Throws if called before `init()`.

---

## Browser compatibility

| Browser | Minimum version |
|---|---|
| Chrome | 80+ |
| Firefox | 75+ |
| Safari | 14+ |
| Edge | 80+ |

Web Vitals tracking requires browsers that support `PerformanceObserver`. The SDK gracefully skips vitals on browsers that do not support it without throwing errors.

---

## Part of the Tracepath ecosystem

| Package | Purpose |
|---|---|
| [`@tracepath/core`](https://www.npmjs.com/package/@tracepath/core) | Shared primitives (span types, context, exporters) |
| [`@tracepath/node`](https://www.npmjs.com/package/@tracepath/node) | Node.js SDK with auto-instrumentation and Express middleware |
| **`@tracepath/browser`** | You are here |
| [`@tracepath/cli`](https://www.npmjs.com/package/@tracepath/cli) | Live terminal dashboard |

---

## License

MIT — see [LICENSE](https://github.com/your-username/tracepath/blob/main/LICENSE)
