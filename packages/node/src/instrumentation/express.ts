import type { Tracer } from "@tracepath/core"
import { SpanKind, SpanStatusCode, extractTraceContext } from "@tracepath/core"
import { contextManager } from "../context-manager.js"

export function tracepathMiddleware(tracer: Tracer) {
  return function tracepathExpressMiddleware(req: any, res: any, next: () => void): void {
    const parentCtx = extractTraceContext(contextManager.active(), req.headers)
    const span = tracer.startSpan(`${req.method} ${req.path}`, {
      kind: SpanKind.SERVER, context: parentCtx,
      attributes: {
        "http.method": req.method, "http.target": req.originalUrl ?? req.url,
        "http.host": req.headers["host"] ?? "", "http.scheme": req.protocol ?? "http",
        "net.peer.ip": req.ip ?? "",
      },
    })
    const origEnd = res.end.bind(res)
    res.end = function (...args: any[]) {
      span.setAttribute("http.status_code", res.statusCode)
      if (res.statusCode >= 400) span.setStatus(SpanStatusCode.ERROR, `HTTP ${res.statusCode}`)
      span.end(); return origEnd(...args)
    }
    next()
  }
}