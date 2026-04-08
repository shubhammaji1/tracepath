import type { SpanProcessor, SpanExporter, ExportResult } from "../types/transport.js"
import { ExportResultCode } from "../types/transport.js"
import type { MutableSpan } from "../types/tracer.js"
import type { Span } from "../types/span.js"
import type { Context } from "../types/context.js"

export class BatchSpanProcessor implements SpanProcessor {
  private _queue: Span[] = []; private _timer: ReturnType<typeof setInterval> | undefined
  private _shutting = false; private _dropped = 0
  private readonly _max: number; private readonly _batch: number
  private readonly _delay: number; private readonly _timeout: number
  constructor(private readonly _exp: SpanExporter, opts: { maxQueueSize?: number; maxExportBatchSize?: number; scheduledDelayMillis?: number; exportTimeoutMillis?: number } = {}) {
    this._max = opts.maxQueueSize ?? 512; this._batch = opts.maxExportBatchSize ?? 128
    this._delay = opts.scheduledDelayMillis ?? 5000; this._timeout = opts.exportTimeoutMillis ?? 30000
    this._timer = setInterval(() => { if (this._queue.length > 0) this._flush().catch(console.error) }, this._delay)
    if (typeof this._timer === "object" && "unref" in this._timer) (this._timer as NodeJS.Timeout).unref()
  }
  onStart(_: MutableSpan, __: Context): void {}
  onEnd(span: Span): void {
    if (this._shutting) return
    if (this._queue.length >= this._max) { this._dropped++; return }
    this._queue.push(span)
    if (this._queue.length >= this._batch) this._flush().catch(console.error)
  }
  async forceFlush() { await this._flush() }
  async shutdown() {
    this._shutting = true
    if (this._timer) { clearInterval(this._timer); this._timer = undefined }
    await this._flush(); await this._exp.shutdown()
  }
  private async _flush() {
    if (!this._queue.length) return
    const batch = this._queue.splice(0, this._batch)
    const timeout = new Promise<ExportResult>((_, r) => setTimeout(() => r(new Error("timeout")), this._timeout))
    try {
      const res = await Promise.race([this._exp.export(batch), timeout])
      if ((res as ExportResult).code === ExportResultCode.FAILED) console.error("[tracepath] export failed:", (res as ExportResult).error?.message)
    } catch (e) { console.error("[tracepath] export error:", e) }
  }
}

export class SimpleSpanProcessor implements SpanProcessor {
  constructor(private readonly _exp: SpanExporter) {}
  onStart(_: MutableSpan, __: Context): void {}
  onEnd(span: Span): void { this._exp.export([span]).catch(console.error) }
  async forceFlush() {}
  async shutdown() { await this._exp.shutdown() }
}