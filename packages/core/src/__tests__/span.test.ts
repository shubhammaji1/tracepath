import { describe, it, expect, vi } from "vitest"
import { TracepathSpan } from "../span.js"
import { SpanStatusCode } from "../types/span.js"
import { ROOT_CONTEXT } from "../context/context.js"

const res = { serviceName: "test" }
const scope = { name: "@tracepath/test", version: "0.1.0" }
const make = (o = {}) => new TracepathSpan({ name: "test.span", resource: res, instrumentationScope: scope, ...o })

describe("TracepathSpan", () => {
  it("generates valid IDs", () => {
    const s = make()
    expect(s.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(s.spanId).toMatch(/^[0-9a-f]{16}$/)
    expect(s.traceId).not.toBe("0".repeat(32))
  })
  it("inherits traceId from parent", () => {
    const parent = make()
    const child = make({ parentContext: parent.toContext(ROOT_CONTEXT) })
    expect(child.traceId).toBe(parent.traceId)
    expect(child.parentSpanId).toBe(parent.spanId)
  })
  it("starts UNSET, ends OK", () => {
    const s = make(); expect(s.status.code).toBe(SpanStatusCode.UNSET)
    s.end(); expect(s.status.code).toBe(SpanStatusCode.OK)
  })
  it("supports chained setAttribute", () => {
    const s = make()
    const r = s.setAttribute("a", 1).setAttribute("b", "two")
    expect(r).toBe(s); expect(s.attributes["a"]).toBe(1)
  })
  it("recordException sets ERROR status", () => {
    const s = make(); s.recordException(new Error("boom"))
    expect(s.status.code).toBe(SpanStatusCode.ERROR)
    expect(s.events[0]?.name).toBe("exception")
  })
  it("is a no-op after end()", () => {
    const s = make(); s.end(); const t = s.endTime
    s.setAttribute("k","v"); s.end(99999)
    expect(s.attributes["k"]).toBeUndefined(); expect(s.endTime).toBe(t)
  })
  it("calls onEnd once", () => {
    const onEnd = vi.fn(); const s = make({ onEnd }); s.end()
    expect(onEnd).toHaveBeenCalledOnce()
  })
  it("computes duration", () => {
    const s = make({ startTime: 1000 }); s.end(1300)
    expect(s.duration).toBe(300)
  })
})