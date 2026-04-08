import type { SpanExporter, ExportResult, DashboardMessage } from "@tracepath/core"
import type { Span } from "@tracepath/core"
import { ExportResultCode } from "@tracepath/core"
import { WebSocket } from "ws"

export class DashboardExporter implements SpanExporter {
  private _ws: WebSocket | null = null
  private _connected = false; private _connecting = false
  private _buffer: Span[] = []; private _retryTimer: NodeJS.Timeout | null = null
  private readonly _url: string; private readonly _retry: boolean; private readonly _retryMs: number

  constructor(opts: { url?: string; reconnect?: boolean; reconnectDelayMs?: number } = {}) {
    this._url = opts.url ?? "ws://localhost:4317"
    this._retry = opts.reconnect ?? true; this._retryMs = opts.reconnectDelayMs ?? 2000
  }

  async export(spans: ReadonlyArray<Span>): Promise<ExportResult> {
    if (!this._connected && !this._connecting) this._connect()
    if (!this._connected) {
      this._buffer.push(...spans.slice(0, 100 - this._buffer.length))
      return { code: ExportResultCode.SUCCESS }
    }
    for (const s of spans) this._send(s)
    return { code: ExportResultCode.SUCCESS }
  }

  async shutdown(): Promise<void> {
    if (this._retryTimer) { clearTimeout(this._retryTimer); this._retryTimer = null }
    this._ws?.close(); this._ws = null
  }

  private _connect(): void {
    if (this._connecting) return; this._connecting = true
    try {
      const ws = new WebSocket(this._url, { handshakeTimeout: 3000 })
      ws.on("open", () => {
        this._ws = ws; this._connected = true; this._connecting = false
        const buf = this._buffer.splice(0); for (const s of buf) this._send(s)
      })
      ws.on("close", () => {
        this._connected = false; this._connecting = false; this._ws = null
        if (this._retry) this._retryTimer = setTimeout(() => this._connect(), this._retryMs)
      })
      ws.on("error", () => { this._connecting = false })
    } catch { this._connecting = false }
  }

  private _send(span: Span): void {
    if (!this._ws || !this._connected) return
    const msg: DashboardMessage = { type: "span", payload: span, timestamp: Date.now(), source: "node" }
    try { this._ws.send(JSON.stringify(msg)) } catch { /* ignore */ }
  }
}