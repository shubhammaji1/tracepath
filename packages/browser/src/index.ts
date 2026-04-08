import {
  TracepathTracerProvider,
  SimpleSpanProcessor,
  BatchSpanProcessor,
  OtlpHttpExporter,
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioSampler,
} from '@tracepath/core'
import type { Tracer, Resource } from '@tracepath/core'
import { RelayExporter } from './exporters/relay-exporter.js'
import { instrumentFetch } from './instrumentation/fetch.js'
import { instrumentWebVitals } from './instrumentation/web-vitals.js'

export interface TracepathBrowserOptions {
  service: string
  version?: string
  environment?: string
  devMode?: boolean
  relayUrl?: string
  otlpUrl?: string
  otlpHeaders?: Record<string, string>
  sampleRate?: number
  instrumentFetch?: boolean
  instrumentWebVitals?: boolean
  ignoreFetchUrls?: (string | RegExp)[]
}

let _tracer: Tracer | null = null

export function init(options: TracepathBrowserOptions): Tracer {
  const isDev =
    options.devMode ?? (typeof location !== 'undefined' && location.hostname === 'localhost')
  const resource: Resource = {
    serviceName: options.service,
    serviceVersion: options.version,
    deploymentEnvironment: options.environment ?? (isDev ? 'development' : 'production'),
  }
  const exporter = isDev
    ? new RelayExporter(options.relayUrl)
    : new OtlpHttpExporter({ url: options.otlpUrl ?? '/v1/traces', headers: options.otlpHeaders })
  const processor = isDev ? new SimpleSpanProcessor(exporter) : new BatchSpanProcessor(exporter)
  const root =
    options.sampleRate !== undefined && options.sampleRate < 1
      ? new TraceIdRatioSampler(options.sampleRate)
      : new AlwaysOnSampler()
  const provider = new TracepathTracerProvider(resource, processor, new ParentBasedSampler(root))
  _tracer = provider.getTracer('@tracepath/browser', '0.1.0')
  if (options.instrumentFetch !== false)
    instrumentFetch(_tracer, { ignoreUrls: options.ignoreFetchUrls })
  if (options.instrumentWebVitals !== false && typeof document !== 'undefined')
    instrumentWebVitals(_tracer)
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') processor.forceFlush().catch(console.error)
    })
  return _tracer
}

export function getTracer(): Tracer {
  if (!_tracer) throw new Error('[tracepath] Call init() before getTracer()')
  return _tracer
}
export type { Tracer, Span, Attributes } from '@tracepath/core'
export { SpanKind, SpanStatusCode } from '@tracepath/core'
