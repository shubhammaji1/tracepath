import type { Attributes, SpanKind } from "./span.js"
import type { Context } from "./context.js"
export interface SpanOptions {
  kind?: SpanKind
  attributes?: Attributes
  startTime?: number
  context?: Context
  root?: boolean
}
export interface MutableSpan {
  readonly traceId: string
  readonly spanId: string
  readonly parentSpanId: string | undefined
  name: string
  readonly kind: SpanKind
  readonly startTime: number
  readonly endTime: number | undefined
  readonly duration: number | undefined
  readonly status: import("./span.js").SpanStatus
  readonly attributes: Attributes
  readonly events: import("./span.js").SpanEvent[]
  readonly links: import("./span.js").SpanLink[]
  readonly resource: import("./span.js").Resource
  readonly instrumentationScope: import("./span.js").InstrumentationScope
  setAttribute(key: string, value: NonNullable<Attributes[string]>): this
  setAttributes(attributes: Attributes): this
  setStatus(code: import("./span.js").SpanStatusCode, message?: string): this
  recordException(exception: Error, attributes?: Attributes): this
  addEvent(name: string, attributes?: Attributes, timestamp?: number): this
  updateName(name: string): this
  end(endTime?: number): void
  isEnded(): boolean
}
export interface Tracer {
  startSpan(name: string, options?: SpanOptions): MutableSpan
  startActiveSpan<T>(name: string, fn: (span: MutableSpan) => T): T
  startActiveSpan<T>(name: string, options: SpanOptions, fn: (span: MutableSpan) => T): T
  getActiveSpan(): MutableSpan | undefined
}
export interface TracerProvider { getTracer(name: string, version?: string): Tracer }