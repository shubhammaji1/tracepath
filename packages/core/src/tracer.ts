import type { Tracer, SpanOptions, MutableSpan, TracerProvider } from "./types/tracer.js"
import type { Context } from "./types/context.js"
import type { Resource, InstrumentationScope } from "./types/span.js"
import type { SpanProcessor } from "./types/transport.js"
import type { Sampler } from "./sampling/sampler.js"
import { TracepathSpan } from "./span.js"
import { ROOT_CONTEXT } from "./context/context.js"
import { setSpanContext } from "./context/propagation.js"
import { AlwaysOnSampler, SamplingDecision } from "./sampling/sampler.js"
import { SpanKind } from "./types/span.js"

export class TracepathTracer implements Tracer {
  private _ctx: Context = ROOT_CONTEXT
  constructor(
    private readonly _scope: InstrumentationScope, private readonly _resource: Resource,
    private readonly _proc: SpanProcessor, private readonly _sampler: Sampler = new AlwaysOnSampler(),
    private readonly _getCtx?: () => Context, private readonly _setCtx?: (c: Context) => void,
  ) {}

  startSpan(name: string, opts: SpanOptions = {}): MutableSpan {
    const parent = opts.root ? ROOT_CONTEXT : (opts.context ?? this._getCtx?.() ?? this._ctx)
    const res = this._sampler.shouldSample({ context: parent, traceId: "", name, kind: opts.kind ?? SpanKind.INTERNAL, attributes: opts.attributes })
    if (res.decision === SamplingDecision.NOT_RECORD) return new NoopSpan(name)
    const span = new TracepathSpan({
      name, kind: opts.kind, attributes: { ...opts.attributes, ...res.attributes },
      startTime: opts.startTime, parentContext: parent,
      resource: this._resource, instrumentationScope: this._scope,
      onEnd: (s) => this._proc.onEnd(s),
    })
    this._proc.onStart(span, parent)
    return span
  }

  startActiveSpan<T>(name: string, optsOrFn: SpanOptions | ((s: MutableSpan) => T), fn?: (s: MutableSpan) => T): T {
    const opts  = typeof optsOrFn === "function" ? {} : optsOrFn
    const cb    = (typeof optsOrFn === "function" ? optsOrFn : fn) as (s: MutableSpan) => T
    const span  = this.startSpan(name, opts)
    const sc    = (span as TracepathSpan).getSpanContext?.()
    const prev  = this._getCtx?.() ?? this._ctx
    const next  = sc ? setSpanContext(prev, sc) : prev
    this._setCtx ? this._setCtx(next) : (this._ctx = next)
    const restore = () => { this._setCtx ? this._setCtx(prev) : (this._ctx = prev) }
    try {
      const r = cb(span)
      if (r instanceof Promise) return r.finally(() => { if (!span.isEnded()) span.end(); restore() }) as T
      if (!span.isEnded()) span.end(); restore(); return r
    } catch (e) {
      if (e instanceof Error) span.recordException(e)
      if (!span.isEnded()) span.end(); restore(); throw e
    }
  }

  getActiveSpan(): MutableSpan | undefined { return undefined }
}

class NoopSpan implements MutableSpan {
  readonly traceId="0".repeat(32); readonly spanId="0".repeat(16)
  readonly parentSpanId=undefined; readonly kind=SpanKind.INTERNAL
  readonly startTime=Date.now(); readonly endTime=undefined; readonly duration=undefined
  readonly status={code:0 as const}; readonly attributes={}; readonly events=[]; readonly links=[]
  readonly resource={serviceName:"noop"}; readonly instrumentationScope={name:"noop"}
  constructor(public name:string){}
  setAttribute(){return this}; setAttributes(){return this}; setStatus(){return this}
  recordException(){return this}; addEvent(){return this}
  updateName(n:string){this.name=n;return this}; end(){}; isEnded(){return true}
}

export class TracepathTracerProvider implements TracerProvider {
  private _tracers = new Map<string, TracepathTracer>()
  constructor(
    private readonly _resource: Resource,
    private readonly _proc: SpanProcessor,
    private readonly _sampler: Sampler = new AlwaysOnSampler(),
  ) {}
  getTracer(name: string, version?: string): Tracer {
    const key = `${name}@${version ?? "latest"}`
    if (!this._tracers.has(key)) {
      this._tracers.set(key, new TracepathTracer({ name, version }, this._resource, this._proc, this._sampler))
    }
    return this._tracers.get(key)!
  }
  async shutdown() { await this._proc.shutdown() }
  async forceFlush() { await this._proc.forceFlush() }
}