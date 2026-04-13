# @tracepath/core

> Core span, trace, and context primitives for Tracepath — the foundation that powers the entire SDK.

[![npm version](https://img.shields.io/npm/v/@tracepath/core)](https://www.npmjs.com/package/@tracepath/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/your-username/tracepath/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

This package contains the shared types, context propagation, sampling logic, span processing pipeline, and OTLP exporter used by all Tracepath SDKs.

**You typically do not install this directly.** Use [`@tracepath/node`](https://www.npmjs.com/package/@tracepath/node) for Node.js apps or [`@tracepath/browser`](https://www.npmjs.com/package/@tracepath/browser) for browser apps — they both depend on this package automatically.

Install this directly only if you are building a custom Tracepath integration or instrumenting an environment other than Node.js or the browser.

---

## Installation

```bash
npm install @tracepath/core
```

```bash
pnpm add @tracepath/core
```

```bash
yarn add @tracepath/core
```

---

## What is in this package

| Module | What it provides |
|---|---|
| **Span types** | `Span`, `Trace`, `SpanStatus`, `SpanKind`, `Attributes`, `SpanEvent` |
| **Context** | `ImmutableContext`, `ROOT_CONTEXT` — immutable request-scoped key-value store |
| **W3C propagation** | `injectTraceContext`, `extractTraceContext` — `traceparent` header serialization |
| **Tracer** | `TracepathTracer`, `TracepathTracerProvider` — create and manage spans |
| **Samplers** | `AlwaysOnSampler`, `AlwaysOffSampler`, `TraceIdRatioSampler`, `ParentBasedSampler` |
| **Processors** | `BatchSpanProcessor`, `SimpleSpanProcessor` — buffer and forward spans to exporters |
| **Exporters** | `OtlpHttpExporter` — ship spans to any OTLP-compatible backend |
| **Utilities** | `generateTraceId`, `generateSpanId`, `isValidTraceId`, `hrTimeMs` |

---

## Basic usage

### Create a tracer and record spans

```ts
import {
  TracepathTracerProvider,
  BatchSpanProcessor,
  OtlpHttpExporter,
  AlwaysOnSampler,
  SpanKind,
  SpanStatusCode,
} from '@tracepath/core'

// 1. Set up the export pipeline
const provider = new TracepathTracerProvider(
  { serviceName: 'my-service', serviceVersion: '1.0.0' },
  new BatchSpanProcessor(
    new OtlpHttpExporter({ url: 'http://localhost:4318/v1/traces' })
  ),
  new AlwaysOnSampler(),
)

// 2. Get a tracer
const tracer = provider.getTracer('my-instrumentation', '1.0.0')

// 3. Record a span manually
const span = tracer.startSpan('my.operation', {
  kind: SpanKind.INTERNAL,
  attributes: { 'custom.key': 'value', 'request.id': 'abc-123' },
})
span.setAttribute('result.count', 42)
span.addEvent('cache.miss', { 'cache.key': 'user:123' })
span.end()

// 4. Or use startActiveSpan for automatic lifecycle management
const result = await tracer.startActiveSpan('db.query', async (span) => {
  span.setAttribute('db.statement', 'SELECT * FROM users')
  try {
    const rows = await db.query('SELECT * FROM users')
    span.setAttribute('db.rows_returned', rows.length)
    return rows
  } catch (err) {
    span.recordException(err)  // captures type, message, and stack trace
    throw err                  // span status set to ERROR automatically
  }
  // span.end() called automatically
})

// 5. Flush and shut down cleanly
await provider.forceFlush()
await provider.shutdown()
```

---

## Span API reference

Every span implements the `MutableSpan` interface:

```ts
interface MutableSpan {
  readonly traceId: string          // 32-char hex — shared across the whole trace
  readonly spanId: string           // 16-char hex — unique to this span
  readonly parentSpanId?: string    // parent span ID if this is a child span
  readonly kind: SpanKind           // INTERNAL | SERVER | CLIENT | PRODUCER | CONSUMER
  readonly startTime: number        // unix timestamp in milliseconds
  readonly endTime?: number         // set when end() is called
  readonly duration?: number        // endTime - startTime in milliseconds
  readonly status: SpanStatus       // { code: UNSET | OK | ERROR, message?: string }
  readonly attributes: Attributes   // key-value metadata
  readonly events: SpanEvent[]      // timestamped events on the span timeline
}
```

### Methods

| Method | Description | Returns |
|---|---|---|
| `setAttribute(key, value)` | Set a single attribute. Value can be string, number, boolean, or array. | `this` (chainable) |
| `setAttributes(attrs)` | Set multiple attributes at once from an object. | `this` (chainable) |
| `setStatus(code, message?)` | Set `SpanStatusCode.OK` or `SpanStatusCode.ERROR`. Once set to OK, cannot be downgraded to ERROR. | `this` (chainable) |
| `recordException(error, attrs?)` | Records the error as a span event with `exception.type`, `exception.message`, `exception.stacktrace`. Sets status to ERROR. | `this` (chainable) |
| `addEvent(name, attrs?, timestamp?)` | Add a named, timestamped event to the span. Useful for marking significant moments inside a long operation. | `this` (chainable) |
| `updateName(name)` | Update the span name after creation. | `this` (chainable) |
| `end(timestamp?)` | Finalize and export the span. Safe to call multiple times — only the first call has effect. | `void` |
| `isEnded()` | Check if `end()` has already been called. | `boolean` |

### Span kinds

```ts
import { SpanKind } from '@tracepath/core'

SpanKind.INTERNAL   // 0 — operation within a single service (default)
SpanKind.SERVER     // 1 — incoming request handler
SpanKind.CLIENT     // 2 — outgoing request to another service
SpanKind.PRODUCER   // 3 — message sent to a queue/topic
SpanKind.CONSUMER   // 4 — message received from a queue/topic
```

---

## Context and W3C propagation

Tracepath implements the [W3C Trace Context](https://www.w3.org/TR/trace-context/) standard. The `traceparent` header links spans across service and process boundaries.

### Injecting context into outbound requests

```ts
import { injectTraceContext, getSpanContext } from '@tracepath/core'

// Inject traceparent into outbound HTTP headers
const headers: Record<string, string> = {
  'content-type': 'application/json',
}
injectTraceContext(activeContext, headers)
// headers now contains:
// { 'traceparent': '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01', ... }

await fetch('https://downstream-service.com/api', { headers })
```

### Extracting context from incoming requests

```ts
import { extractTraceContext, ROOT_CONTEXT } from '@tracepath/core'

// Extract from incoming HTTP request headers
const parentContext = extractTraceContext(ROOT_CONTEXT, incomingRequest.headers)

// Start a span that continues the upstream trace
const span = tracer.startSpan('handle.request', { context: parentContext })
```

### The traceparent format

```
traceparent: 00-{traceId}-{spanId}-{flags}
             00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
                |________________________________| |______________| |
                128-bit trace ID (32 hex chars)   64-bit span ID   flags (01 = sampled)
```

---

## Samplers

Samplers decide whether a given trace should be recorded and exported. The decision is made once per root span and inherited by all child spans.

```ts
import {
  AlwaysOnSampler,
  AlwaysOffSampler,
  TraceIdRatioSampler,
  ParentBasedSampler,
} from '@tracepath/core'

// Record every span — use in development
new AlwaysOnSampler()

// Record nothing — temporarily disable tracing without code changes
new AlwaysOffSampler()

// Sample 10% of traces, deterministically by traceId
// A given traceId always produces the same decision across all services
new TraceIdRatioSampler(0.1)

// Recommended for production:
// - No remote parent: use rootSampler
// - Remote parent was sampled: sample this service too
// - Remote parent was not sampled: don't sample
new ParentBasedSampler(new TraceIdRatioSampler(0.1))
```

---

## Processors

Processors sit between the tracer and the exporter. They can buffer, filter, enrich, or forward spans.

### BatchSpanProcessor (recommended for production)

Buffers spans in memory and exports them in batches. More efficient than exporting every span individually.

```ts
import { BatchSpanProcessor } from '@tracepath/core'

new BatchSpanProcessor(exporter, {
  maxQueueSize: 512,           // drop spans if queue exceeds this (prevents OOM)
  maxExportBatchSize: 128,     // max spans per export HTTP call
  scheduledDelayMillis: 5000,  // flush every 5 seconds
  exportTimeoutMillis: 30000,  // give up on an export after 30 seconds
})
```

### SimpleSpanProcessor (recommended for development)

Exports each span immediately when `end()` is called. Lower latency but higher overhead.

```ts
import { SimpleSpanProcessor } from '@tracepath/core'

new SimpleSpanProcessor(exporter)
```

---

## OTLP HTTP exporter

Ships spans to any OpenTelemetry Protocol-compatible backend.

```ts
import { OtlpHttpExporter } from '@tracepath/core'

new OtlpHttpExporter({
  url: 'https://api.honeycomb.io/v1/traces',
  headers: {
    'x-honeycomb-team': process.env.HONEYCOMB_API_KEY,
  },
  timeoutMillis: 10000,  // default: 10 seconds
})
```

Compatible with: **Jaeger**, **Grafana Tempo**, **Honeycomb**, **Datadog**, **New Relic**, **SigNoz**, **AWS X-Ray** (via ADOT collector).

---

## TypeScript types

All types are exported and fully documented. No `@types/*` packages needed.

```ts
import type {
  Span,
  Trace,
  MutableSpan,
  Attributes,
  AttributeValue,
  SpanKind,
  SpanStatus,
  SpanStatusCode,
  SpanEvent,
  SpanLink,
  Resource,
  InstrumentationScope,
  Context,
  SpanContext,
  Tracer,
  TracerProvider,
  SpanOptions,
  SpanExporter,
  SpanProcessor,
  ExportResult,
  ExportResultCode,
  Sampler,
  SamplingResult,
} from '@tracepath/core'
```

---

## Part of the Tracepath ecosystem

| Package | Purpose |
|---|---|
| **`@tracepath/core`** | You are here — shared primitives |
| [`@tracepath/node`](https://www.npmjs.com/package/@tracepath/node) | Node.js SDK with auto-instrumentation and Express middleware |
| [`@tracepath/browser`](https://www.npmjs.com/package/@tracepath/browser) | Browser SDK with fetch instrumentation and Web Vitals |
| [`@tracepath/cli`](https://www.npmjs.com/package/@tracepath/cli) | Live terminal dashboard |

---

## Requirements

- Node.js >= 18.0.0 (for Node.js environments)
- Modern browser with ES2020 support (for browser environments)
- TypeScript 5.x (if using TypeScript)

---

## License

MIT — see [LICENSE](https://github.com/your-username/tracepath/blob/main/LICENSE)
