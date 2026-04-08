import type { MutableSpan } from "./types/tracer.js"
import type { Context } from "./types/context.js"
import { SpanKind, SpanStatusCode, type Attributes, type SpanEvent, type SpanLink, type Resource, type InstrumentationScope } from "./types/span.js"
import { generateTraceId, generateSpanId, hrTimeMs } from "./utils/id.js"
import { setSpanContext, getSpanContext } from "./context/propagation.js"
import { ROOT_CONTEXT } from "./context/context.js"

export interface SpanCreationOptions {
  name: string; kind?: SpanKind; attributes?: Attributes; startTime?: number
  parentContext?: Context; resource: Resource; instrumentationScope: InstrumentationScope
  links?: SpanLink[]; onEnd?: (span: TracepathSpan) => void
}
export type ReadonlySpan = Readonly<TracepathSpan>

export class TracepathSpan implements MutableSpan {
  readonly traceId: string; readonly spanId: string; readonly parentSpanId: string | undefined
  name: string; readonly kind: SpanKind; readonly startTime: number
  endTime: number | undefined; duration: number | undefined
  status: import("./types/span.js").SpanStatus
  attributes: Attributes; readonly events: SpanEvent[]; readonly links: SpanLink[]
  readonly resource: Resource; readonly instrumentationScope: InstrumentationScope
  private _ended = false
  private readonly _onEnd?: (span: TracepathSpan) => void

  constructor(o: SpanCreationOptions) {
    const parent = getSpanContext(o.parentContext ?? ROOT_CONTEXT)
    this.traceId = parent?.traceId ?? generateTraceId()
    this.spanId = generateSpanId()
    this.parentSpanId = parent?.spanId
    this.name = o.name; this.kind = o.kind ?? SpanKind.INTERNAL
    this.startTime = o.startTime ?? hrTimeMs()
    this.status = { code: SpanStatusCode.UNSET }
    this.attributes = { ...o.attributes }
    this.events = []; this.links = o.links ?? []
    this.resource = o.resource; this.instrumentationScope = o.instrumentationScope
    this._onEnd = o.onEnd
  }

  setAttribute(key: string, value: NonNullable<Attributes[string]>): this {
    if (!this._ended) this.attributes[key] = value; return this
  }
  setAttributes(attrs: Attributes): this {
    if (!this._ended) Object.assign(this.attributes, attrs); return this
  }
  setStatus(code: SpanStatusCode, message?: string): this {
    if (this._ended) return this
    if (this.status.code === SpanStatusCode.OK && code !== SpanStatusCode.OK) return this
    this.status = { code, message }; return this
  }
  recordException(err: Error, attrs?: Attributes): this {
    this.addEvent("exception", {
      "exception.type": err.name, "exception.message": err.message,
      "exception.stacktrace": err.stack ?? "", ...attrs,
    })
    return this.setStatus(SpanStatusCode.ERROR, err.message)
  }
  addEvent(name: string, attrs?: Attributes, ts?: number): this {
    if (!this._ended) this.events.push({ name, timestamp: ts ?? hrTimeMs(), attributes: attrs })
    return this
  }
  updateName(name: string): this { if (!this._ended) this.name = name; return this }
  end(endTime?: number): void {
    if (this._ended) return
    this._ended = true
    this.endTime = endTime ?? hrTimeMs()
    this.duration = this.endTime - this.startTime
    if (this.status.code === SpanStatusCode.UNSET) this.status = { code: SpanStatusCode.OK }
    this._onEnd?.(this)
  }
  isEnded(): boolean { return this._ended }
  getSpanContext() {
    return { traceId: this.traceId, spanId: this.spanId, traceFlags: 0x01 }
  }
  toContext(parent: Context = ROOT_CONTEXT): Context {
    return setSpanContext(parent, this.getSpanContext())
  }
}