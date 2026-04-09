import http from 'node:http'
import https from 'node:https'
import type { Tracer } from '@tracepath/core'
import { SpanKind, SpanStatusCode, injectTraceContext } from '@tracepath/core'
import { contextManager } from '../context-manager.js'

let _patched = false
let _tracer: Tracer | null = null
const _originals = new WeakMap<object, Function>()

export function instrumentHttp(tracer: Tracer): void {
  if (_patched) return
  _patched = true
  _tracer = tracer
  patch(http)
  patch(https)
}
export function uninstrumentHttp(): void {
  if (!_patched) return
  _patched = false
  unpatch(http)
  unpatch(https)
}

function patch(mod: typeof http | typeof https): void {
  const orig = mod.request.bind(mod)
  _originals.set(mod, orig)
  ;(mod as any).request = function (urlOrOpts: any, optsOrCb?: any, cb?: any) {
    if (!_tracer) return orig(urlOrOpts, optsOrCb, cb)
    let opts: http.RequestOptions = {}
    if (typeof urlOrOpts === 'string' || urlOrOpts instanceof URL) {
      const u = new URL(urlOrOpts.toString())
      opts = { hostname: u.hostname, path: u.pathname + u.search, protocol: u.protocol }
    } else {
      opts = urlOrOpts
    }
    const method = opts.method ?? 'GET'
    const host = opts.hostname ?? 'localhost'
    const path = opts.path ?? '/'
    const span = _tracer!.startSpan(`${method} ${host}${path}`, {
      kind: SpanKind.CLIENT,
      attributes: { 'http.method': method, 'http.host': host, 'http.target': path },
    })
    const hdrs: Record<string, string> = {}
    injectTraceContext(contextManager.active(), hdrs)
    opts = { ...opts, headers: { ...opts.headers, ...hdrs } }
    const urlStr = `${opts.protocol ?? 'http:'}//${opts.host ?? opts.hostname ?? 'localhost'}${opts.path ?? ''}`
    const req = typeof optsOrCb === 'function' ? orig(urlStr, optsOrCb) : orig(urlStr, optsOrCb, cb)
    req.on('response', (res: http.IncomingMessage) => {
      const code = res.statusCode ?? 0
      span.setAttribute('http.status_code', code)
      if (code >= 400) span.setStatus(SpanStatusCode.ERROR, `HTTP ${code}`)
      res.on('end', () => span.end())
    })
    req.on('error', (e: Error) => {
      span.recordException(e)
      span.end()
    })
    return req
  }
}

function unpatch(mod: typeof http | typeof https): void {
  const o = _originals.get(mod)
  if (o) {
    ;(mod as any).request = o
    _originals.delete(mod)
  }
}
