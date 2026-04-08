import type { Tracer } from "@tracepath/core"
import { SpanKind, SpanStatusCode, injectTraceContext } from "@tracepath/core"
import { contextManager } from "../context-manager.js"

let _orig: typeof fetch | null = null; let _tracer: Tracer | null = null

export function instrumentFetch(tracer: Tracer, opts: { ignoreUrls?: (string|RegExp)[] } = {}): void {
  if (_orig) return; _orig = globalThis.fetch; _tracer = tracer
  globalThis.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (!_tracer || !_orig) return _orig!(input, init)
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    if ((opts.ignoreUrls ?? []).some(p => typeof p === "string" ? url.includes(p) : p.test(url))) return _orig(input, init)
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
    const span = _tracer.startSpan(`${method} ${url}`, { kind: SpanKind.CLIENT, attributes: { "http.method": method, "http.url": url } })
    const hdrs: Record<string,string> = {}; injectTraceContext(contextManager.active(), hdrs)
    const t0 = performance.now()
    try {
      const res = await _orig(input, { ...init, headers: { ...(init?.headers as Record<string,string> ?? {}), ...hdrs } })
      span.setAttributes({ "http.status_code": res.status, "http.duration_ms": Math.round(performance.now() - t0) })
      if (res.status >= 400) span.setStatus(SpanStatusCode.ERROR, `HTTP ${res.status}`)
      span.end(); return res
    } catch(e) { if (e instanceof Error) span.recordException(e); span.end(); throw e }
  }
}
export function uninstrumentFetch(): void { if (_orig) { globalThis.fetch = _orig; _orig = null; _tracer = null } }