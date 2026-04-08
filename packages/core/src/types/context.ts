export interface SpanContext {
  traceId: string
  spanId: string
  traceFlags: number
  isRemote?: boolean
}
export interface Context {
  getValue(key: symbol): unknown
  setValue(key: symbol, value: unknown): Context
  deleteValue(key: symbol): Context
}
export const SPAN_CONTEXT_KEY = Symbol.for("tracepath.span_context")
export const BAGGAGE_KEY = Symbol.for("tracepath.baggage")
export type BaggageEntry = { value: string; metadata?: string }
export type Baggage = Map<string, BaggageEntry>