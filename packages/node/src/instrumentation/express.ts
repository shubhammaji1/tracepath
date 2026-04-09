import type { Tracer } from '@tracepath/core'
import { SpanKind, SpanStatusCode, extractTraceContext, setSpanContext } from '@tracepath/core'
import { contextManager } from '../context-manager.js'
import type { TracepathSpan } from '@tracepath/core'

export function tracepathMiddleware(tracer: Tracer) {
  return function tracepathExpressMiddleware(req: any, res: any, next: () => void): void {
    // Extract incoming W3C traceparent header — links browser spans to this trace
    const parentCtx = extractTraceContext(contextManager.active(), req.headers)

    const span = tracer.startSpan(`${req.method} ${req.path ?? req.url}`, {
      kind: SpanKind.SERVER,
      context: parentCtx,
      attributes: {
        'http.method':  req.method,
        'http.target':  req.originalUrl ?? req.url,
        'http.host':    req.headers['host'] ?? '',
        'http.scheme':  req.protocol ?? 'http',
        'net.peer.ip':  req.ip ?? req.socket?.remoteAddress ?? '',
      },
    })

    // Set this SERVER span as the active context for the entire request lifecycle.
    // Any startActiveSpan() called inside a route handler will automatically
    // become a child span of this SERVER span.
    const spanCtx = (span as unknown as TracepathSpan).getSpanContext?.()
    const requestCtx = spanCtx ? setSpanContext(parentCtx, spanCtx) : parentCtx

    // Patch res.end to capture response status and end the span
    const origEnd = res.end.bind(res)
    res.end = function (...args: any[]) {
      span.setAttribute('http.status_code', res.statusCode)
      if (res.statusCode >= 400) {
        span.setStatus(SpanStatusCode.ERROR, `HTTP ${res.statusCode}`)
      }
      span.end()
      return origEnd(...args)
    }

    // Run the rest of the middleware chain inside the request context
    contextManager.with(requestCtx, () => next())
  }
}
