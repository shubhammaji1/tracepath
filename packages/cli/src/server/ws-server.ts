import { WebSocketServer, WebSocket } from "ws"
import type { DashboardMessage, Span } from "@tracepath/core"

export interface SpanEvent { span: Span; source: "node"|"browser"; receivedAt: number }
export type DashboardEventHandler = (e: SpanEvent) => void

export class DashboardServer {
  private _wss: WebSocketServer | null = null
  private _clients = new Set<WebSocket>()
  private _handlers: DashboardEventHandler[] = []
  private _count = 0

  constructor(private readonly _port = 4317) {}

  start(): Promise<void> {
    return new Promise((res, rej) => {
      this._wss = new WebSocketServer({ port: this._port })
      this._wss.on("listening", () => res())
      this._wss.on("error", rej)
      this._wss.on("connection", ws => {
        this._clients.add(ws)
        ws.on("message", data => {
          try {
            const msg = JSON.parse(data.toString()) as DashboardMessage
            if (msg.type === "span" && msg.payload && "spanId" in msg.payload) {
              this._emit({ span: msg.payload as Span, source: msg.source, receivedAt: Date.now() })
            }
          } catch {}
        })
        ws.on("close", () => this._clients.delete(ws))
        ws.on("error", () => this._clients.delete(ws))
      })
    })
  }

  receiveRelayedSpans(spans: Span[], source: "browser"|"node" = "browser") {
    for (const s of spans) this._emit({ span: s, source, receivedAt: Date.now() })
  }
  onSpan(h: DashboardEventHandler) { this._handlers.push(h) }
  get spansReceived() { return this._count }
  get connectedClients() { return this._clients.size }
  stop(): Promise<void> { return new Promise(r => this._wss?.close(() => r())) }
  private _emit(e: SpanEvent) {
    this._count++
    for (const h of this._handlers) { try { h(e) } catch {} }
  }
}