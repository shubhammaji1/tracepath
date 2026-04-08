import { describe, it, expect } from "vitest"
import { injectTraceContext, extractTraceContext, getSpanContext, setSpanContext } from "../context/propagation.js"
import { ROOT_CONTEXT } from "../context/context.js"

const ctx = setSpanContext(ROOT_CONTEXT, { traceId: "4bf92f3577b34da6a3ce929d0e0e4736", spanId: "00f067aa0ba902b7", traceFlags: 1 })

describe("W3C propagation", () => {
  it("injects traceparent", () => {
    const c: Record<string,string> = {}; injectTraceContext(ctx, c)
    expect(c["traceparent"]).toBe("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
  })
  it("extracts traceparent", () => {
    const out = extractTraceContext(ROOT_CONTEXT, { traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" })
    const sc = getSpanContext(out)
    expect(sc?.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736")
    expect(sc?.isRemote).toBe(true)
  })
  it("round-trips", () => {
    const c: Record<string,string> = {}; injectTraceContext(ctx, c)
    const out = extractTraceContext(ROOT_CONTEXT, c)
    expect(getSpanContext(out)?.traceId).toBe(getSpanContext(ctx)?.traceId)
  })
  it("ignores invalid headers", () => {
    for (const h of ["bad","00-short-00f067aa0ba902b7-01","00-"+"0".repeat(32)+"-00f067aa0ba902b7-01"]) {
      expect(getSpanContext(extractTraceContext(ROOT_CONTEXT, { traceparent: h }))).toBeUndefined()
    }
  })
})