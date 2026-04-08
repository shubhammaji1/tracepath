import type { Attributes, SpanKind } from "../types/span.js"
import type { SpanContext, Context } from "../types/context.js"
import { getSpanContext } from "../context/propagation.js"

export const SamplingDecision = { NOT_RECORD: 0, RECORD: 1, RECORD_AND_SAMPLED: 2 } as const
export type SamplingDecision = (typeof SamplingDecision)[keyof typeof SamplingDecision]
export interface SamplingResult { decision: SamplingDecision; attributes?: Attributes }
export interface SamplerInput {
  context: Context; traceId: string; name: string
  kind: SpanKind; attributes?: Attributes; links?: SpanContext[]
}
export interface Sampler { shouldSample(input: SamplerInput): SamplingResult; readonly description: string }

export class AlwaysOnSampler implements Sampler {
  readonly description = "AlwaysOnSampler"
  shouldSample(_: SamplerInput): SamplingResult { return { decision: SamplingDecision.RECORD_AND_SAMPLED } }
}
export class AlwaysOffSampler implements Sampler {
  readonly description = "AlwaysOffSampler"
  shouldSample(_: SamplerInput): SamplingResult { return { decision: SamplingDecision.NOT_RECORD } }
}
export class TraceIdRatioSampler implements Sampler {
  private readonly _ub: number
  readonly description: string
  constructor(private readonly _ratio: number) {
    if (_ratio < 0 || _ratio > 1) throw new RangeError(`ratio must be 0-1, got ${_ratio}`)
    this._ub = Math.floor(_ratio * 0xffffffff)
    this.description = `TraceIdRatioSampler{${_ratio}}`
  }
  shouldSample(i: SamplerInput): SamplingResult {
    if (this._ratio === 0) return { decision: SamplingDecision.NOT_RECORD }
    if (this._ratio === 1) return { decision: SamplingDecision.RECORD_AND_SAMPLED }
    return { decision: parseInt(i.traceId.substring(0,8),16) <= this._ub
      ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD }
  }
}
export class ParentBasedSampler implements Sampler {
  readonly description: string
  constructor(
    private readonly root: Sampler,
    private readonly remoteSampled: Sampler = new AlwaysOnSampler(),
    private readonly remoteNotSampled: Sampler = new AlwaysOffSampler(),
  ) { this.description = `ParentBased{root=${root.description}}` }
  shouldSample(i: SamplerInput): SamplingResult {
    const p = getSpanContext(i.context)
    if (!p) return this.root.shouldSample(i)
    const sampled = (p.traceFlags & 0x01) === 0x01
    if (p.isRemote) return sampled ? this.remoteSampled.shouldSample(i) : this.remoteNotSampled.shouldSample(i)
    return { decision: sampled ? SamplingDecision.RECORD_AND_SAMPLED : SamplingDecision.NOT_RECORD }
  }
}