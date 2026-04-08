import type { SpanExporter, ExportResult } from "@tracepath/core"
import type { Span } from "@tracepath/core"
import { ExportResultCode } from "@tracepath/core"
export class RelayExporter implements SpanExporter {
  constructor(private readonly _url = "/__tracepath/spans") {}
  async export(spans: ReadonlyArray<Span>): Promise<ExportResult> {
    if (!spans.length) return { code: ExportResultCode.SUCCESS }
    try {
      const r = await fetch(this._url, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ spans }), keepalive: true })
      return r.ok ? { code: ExportResultCode.SUCCESS } : { code: ExportResultCode.FAILED, error: new Error(`${r.status}`) }
    } catch(e) { return { code: ExportResultCode.FAILED, error: e instanceof Error ? e : new Error(String(e)) } }
  }
  async shutdown() {}
}