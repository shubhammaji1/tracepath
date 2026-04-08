export const SpanStatusCode = { UNSET: 0, OK: 1, ERROR: 2 } as const
export type SpanStatusCode = (typeof SpanStatusCode)[keyof typeof SpanStatusCode]
export interface SpanStatus { code: SpanStatusCode; message?: string }
export const SpanKind = { INTERNAL: 0, SERVER: 1, CLIENT: 2, PRODUCER: 3, CONSUMER: 4 } as const
export type SpanKind = (typeof SpanKind)[keyof typeof SpanKind]
export type AttributeValue = string | number | boolean | string[] | number[] | boolean[] | null | undefined
export type Attributes = Record<string, AttributeValue>
export interface SpanEvent { name: string; timestamp: number; attributes?: Attributes }
export interface SpanLink { traceId: string; spanId: string; traceFlags: number; attributes?: Attributes }
export interface Resource {
  serviceName: string
  serviceVersion?: string
  deploymentEnvironment?: string
  attributes?: Attributes
}
export interface InstrumentationScope { name: string; version?: string }
export interface Span {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  kind: SpanKind
  startTime: number
  endTime?: number
  duration?: number
  status: SpanStatus
  attributes: Attributes
  events: SpanEvent[]
  links: SpanLink[]
  resource: Resource
  instrumentationScope: InstrumentationScope
}
export interface Trace {
  traceId: string
  spans: Span[]
  rootSpan?: Span
  duration?: number
  hasError: boolean
}