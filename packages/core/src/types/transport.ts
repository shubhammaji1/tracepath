import type { Span } from "./span.js"
export interface SpanExporter {
  export(spans: ReadonlyArray<Span>): Promise<ExportResult>
  shutdown(): Promise<void>
}
export const ExportResultCode = { SUCCESS: 0, FAILED: 1 } as const
export type ExportResultCode = (typeof ExportResultCode)[keyof typeof ExportResultCode]
export interface ExportResult { code: ExportResultCode; error?: Error }
export interface SpanProcessor {
  onStart(span: import("./tracer.js").MutableSpan, parentContext: import("./context.js").Context): void
  onEnd(span: Span): void
  forceFlush(): Promise<void>
  shutdown(): Promise<void>
}
export interface DashboardMessage {
  type: "span" | "trace_complete" | "ping" | "pong" | "connected"
  payload?: Span | { traceId: string } | Record<string, never>
  timestamp: number
  source: "node" | "browser"
}