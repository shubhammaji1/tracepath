import {
  TracepathTracerProvider,
  TracepathTracer,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  OtlpHttpExporter,
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioSampler,
} from '@tracepath/core'
import type { Resource, Tracer } from '@tracepath/core'
import { contextManager } from './context-manager.js'
import { DashboardExporter } from './exporters/dashboard-exporter.js'
import { instrumentHttp, uninstrumentHttp } from './instrumentation/http.js'

export interface TracepathNodeOptions {
  service: string
  version?: string
  environment?: string
  dashboard?: boolean
  dashboardUrl?: string
  otlpUrl?: string
  otlpHeaders?: Record<string, string>
  sampleRate?: number
  instrumentHttp?: boolean
}

let _provider: TracepathTracerProvider | null = null
let _tracer: Tracer | null = null

export function init(options: TracepathNodeOptions): Tracer {
  const isDev   = (options.environment ?? process.env['NODE_ENV']) !== 'production'
  const useDash = options.dashboard ?? isDev

  const resource: Resource = {
    serviceName: options.service,
    serviceVersion: options.version,
    deploymentEnvironment: options.environment ?? process.env['NODE_ENV'] ?? 'development',
  }

  const exporter = useDash
    ? new DashboardExporter({ url: options.dashboardUrl })
    : new OtlpHttpExporter({ url: options.otlpUrl, headers: options.otlpHeaders })

  const processor = useDash
    ? new SimpleSpanProcessor(exporter)
    : new BatchSpanProcessor(exporter)

  const rootSampler =
    options.sampleRate !== undefined && options.sampleRate < 1
      ? new TraceIdRatioSampler(options.sampleRate)
      : new AlwaysOnSampler()

  const sampler = new ParentBasedSampler(rootSampler)

  // Build a standalone provider for shutdown/flush lifecycle
  _provider = new TracepathTracerProvider(resource, processor, sampler)

  // Build the tracer with AsyncLocalStorage wired in so context propagates
  // automatically through every async/await without manual passing
  _tracer = new TracepathTracer(
    { name: '@tracepath/node', version: '0.1.0' },
    resource,
    processor,
    sampler,
    () => contextManager.active(),       // read active context from ALS
    (ctx) => { /* set is handled per-request in tracepathMiddleware */ },
  )

  if (options.instrumentHttp !== false) instrumentHttp(_tracer)

  process.on('SIGTERM', async () => {
    await _provider?.forceFlush()
    await _provider?.shutdown()
  })
  process.on('beforeExit', async () => {
    await _provider?.forceFlush()
  })

  if (isDev) {
    const dest = useDash ? (options.dashboardUrl ?? 'ws://localhost:4317') : 'OTLP'
    console.log(`[tracepath] ${options.service} -> ${dest}`)
  }

  return _tracer
}

export function getTracer(): Tracer {
  if (!_tracer) throw new Error('[tracepath] Call init() before getTracer()')
  return _tracer
}

export async function shutdown(): Promise<void> {
  await _provider?.forceFlush()
  await _provider?.shutdown()
  uninstrumentHttp()
  _provider = null
  _tracer = null
}

export { tracepathMiddleware } from './instrumentation/express.js'
export { contextManager } from './context-manager.js'
export type { Tracer, Span, Attributes } from '@tracepath/core'
export { SpanKind, SpanStatusCode, injectTraceContext, extractTraceContext } from '@tracepath/core'
