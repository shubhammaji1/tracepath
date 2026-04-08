import type { Context } from "../types/context.js"
import type { SpanContext, Baggage } from "../types/context.js"
import { SPAN_CONTEXT_KEY, BAGGAGE_KEY } from "../types/context.js"

export const W3C_TRACEPARENT_HEADER = "traceparent"
export const W3C_TRACESTATE_HEADER = "tracestate"
export const W3C_BAGGAGE_HEADER = "baggage"

const VALID_TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/

export function injectTraceContext(context: Context, carrier: Record<string, string>): void {
  const sc = getSpanContext(context)
  if (!sc || sc.traceId === "0".repeat(32) || sc.spanId === "0".repeat(16)) return
  const flags = sc.traceFlags.toString(16).padStart(2, "0")
  carrier[W3C_TRACEPARENT_HEADER] = `00-${sc.traceId}-${sc.spanId}-${flags}`
  const baggage = getBaggage(context)
  if (baggage && baggage.size > 0) {
    carrier[W3C_BAGGAGE_HEADER] = Array.from(baggage.entries())
      .map(([k, v]) => `${k}=${v.value}`).join(",")
  }
}

export function extractTraceContext(context: Context, carrier: Record<string, string | string[] | undefined>): Context {
  const raw = carrier[W3C_TRACEPARENT_HEADER] ?? carrier["traceparent"]
  const traceparent = Array.isArray(raw) ? raw[0] : raw
  if (!traceparent) return context
  const match = VALID_TRACEPARENT.exec(traceparent)
  if (!match) return context
  const [, traceId, spanId, flagsHex] = match
  if (!traceId || !spanId || !flagsHex) return context
  if (traceId === "0".repeat(32) || spanId === "0".repeat(16)) return context
  return setSpanContext(context, { traceId, spanId, traceFlags: parseInt(flagsHex, 16), isRemote: true })
}

export function getSpanContext(context: Context): SpanContext | undefined {
  return context.getValue(SPAN_CONTEXT_KEY) as SpanContext | undefined
}
export function setSpanContext(context: Context, sc: SpanContext): Context {
  return context.setValue(SPAN_CONTEXT_KEY, sc)
}
export function getBaggage(context: Context): Baggage | undefined {
  return context.getValue(BAGGAGE_KEY) as Baggage | undefined
}
export function setBaggage(context: Context, baggage: Baggage): Context {
  return context.setValue(BAGGAGE_KEY, baggage)
}