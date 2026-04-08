import type { SpanExporter, ExportResult } from "../types/transport.js"
import type { Span, SpanStatus } from "../types/span.js"
import { ExportResultCode, SpanStatusCode } from "../types/index.js"

export interface OtlpHttpExporterOptions {
  url?: string; headers?: Record<string, string>; timeoutMillis?: number
}

export class OtlpHttpExporter implements SpanExporter {
  private readonly _url: string
  private readonly _headers: Record<string, string>
  private readonly _timeout: number
  constructor(opts: OtlpHttpExporterOptions = {}) {
    this._url = opts.url ?? "http://localhost:4318/v1/traces"
    this._headers = { "Content-Type": "application/json", ...opts.headers }
    this._timeout = opts.timeoutMillis ?? 10000
  }
  async export(spans: ReadonlyArray<Span>): Promise<ExportResult> {
    if (!spans.length) return { code: ExportResultCode.SUCCESS }
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), this._timeout)
    try {
      const res = await fetch(this._url, { method: "POST", headers: this._headers, body: JSON.stringify(this._toOtlp(spans)), signal: ctrl.signal })
      return res.ok ? { code: ExportResultCode.SUCCESS } : { code: ExportResultCode.FAILED, error: new Error(`HTTP ${res.status}`) }
    } catch (e) {
      return { code: ExportResultCode.FAILED, error: e instanceof Error ? e : new Error(String(e)) }
    } finally { clearTimeout(t) }
  }
  async shutdown() {}
  private _toOtlp(spans: ReadonlyArray<Span>) {
    const byService = new Map<string, Span[]>()
    for (const s of spans) { const k = s.resource.serviceName; if (!byService.has(k)) byService.set(k, []); byService.get(k)!.push(s) }
    return { resourceSpans: Array.from(byService.values()).map(ss => ({
      resource: { attributes: this._attrs({ "service.name": ss[0]!.resource.serviceName, "service.version": ss[0]!.resource.serviceVersion ?? "" }) },
      scopeSpans: [{ scope: { name: ss[0]!.instrumentationScope.name }, spans: ss.map(s => ({
        traceId: s.traceId, spanId: s.spanId, parentSpanId: s.parentSpanId ?? "",
        name: s.name, kind: s.kind + 1,
        startTimeUnixNano: String(Math.floor(s.startTime * 1e6)),
        endTimeUnixNano: String(Math.floor((s.endTime ?? s.startTime) * 1e6)),
        attributes: this._attrs(s.attributes),
        events: s.events.map(e => ({ name: e.name, timeUnixNano: String(Math.floor(e.timestamp * 1e6)), attributes: this._attrs(e.attributes ?? {}) })),
        status: { code: s.status.code === SpanStatusCode.ERROR ? 2 : s.status.code === SpanStatusCode.OK ? 1 : 0 }
      })) }]
    })) }
  }
  private _attrs(o: Record<string, unknown>) {
    return Object.entries(o).filter(([,v]) => v != null && v !== "").map(([key,value]) => ({ key, value: this._val(value) }))
  }
  private _val(v: unknown): Record<string,unknown> {
    if (typeof v === "string") return { stringValue: v }
    if (typeof v === "number") return Number.isInteger(v) ? { intValue: String(v) } : { doubleValue: v }
    if (typeof v === "boolean") return { boolValue: v }
    if (Array.isArray(v)) return { arrayValue: { values: v.map(x => this._val(x)) } }
    return { stringValue: String(v) }
  }
}