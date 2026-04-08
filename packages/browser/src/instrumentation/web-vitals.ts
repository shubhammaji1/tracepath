import type { Tracer } from "@tracepath/core"
import { SpanKind } from "@tracepath/core"
const T = { lcp:{good:2500,ni:4000}, cls:{good:.1,ni:.25}, inp:{good:200,ni:500}, fcp:{good:1800,ni:3000}, ttfb:{good:800,ni:1800} }
const rate = (m: keyof typeof T, v: number) => v <= T[m].good ? "good" : v <= T[m].ni ? "needs-improvement" : "poor"
export function instrumentWebVitals(tracer: Tracer): void {
  if (typeof PerformanceObserver === "undefined") return
  try {
    new PerformanceObserver(list => {
      const e = list.getEntries().at(-1) as any; if (!e) return
      const lcp = e.renderTime || e.loadTime || e.startTime
      const s = tracer.startSpan("web.lcp", { kind: SpanKind.INTERNAL, startTime: performance.timeOrigin, attributes: { "web_vital.name":"LCP","web_vital.value_ms":Math.round(lcp),"web_vital.rating":rate("lcp",lcp) } })
      s.end(performance.timeOrigin + lcp)
    }).observe({ type: "largest-contentful-paint", buffered: true })
  } catch {}
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined
    if (nav) {
      const ttfb = nav.responseStart - nav.requestStart
      const s = tracer.startSpan("web.ttfb", { kind: SpanKind.INTERNAL, startTime: performance.timeOrigin + nav.requestStart, attributes: { "web_vital.name":"TTFB","web_vital.value_ms":Math.round(ttfb),"web_vital.rating":rate("ttfb",ttfb) } })
      s.end(performance.timeOrigin + nav.responseStart)
    }
  } catch {}
}