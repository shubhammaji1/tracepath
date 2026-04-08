import React, { useState, useEffect, useCallback } from "react"
import { Box, Text, useInput, useApp } from "ink"
import type { Span } from "@tracepath/core"
import { SpanStatusCode } from "@tracepath/core"
import { SpanRow } from "./components/SpanRow.js"
import { StatsBar } from "./components/StatsBar.js"
import type { SpanEvent } from "../server/ws-server.js"

interface TraceView { traceId: string; spans: Span[]; startTime: number; hasError: boolean }
interface Props { onSpanEvent: (h: (e: SpanEvent) => void) => void; connectedClients: number; port: number }

const pct = (arr: number[], p: number) => {
  if (!arr.length) return 0
  const s = [...arr].sort((a,b) => a-b)
  return s[Math.ceil(p/100 * s.length) - 1] ?? 0
}

export const Dashboard: React.FC<Props> = ({ onSpanEvent, connectedClients, port }) => {
  const { exit } = useApp()
  const [traces, setTraces] = useState<TraceView[]>([])
  const [errors, setErrors] = useState<Span[]>([])
  const [durations, setDurations] = useState<number[]>([])
  const [total, setTotal] = useState(0)
  const [tab, setTab] = useState<"traces"|"errors">("traces")

  useInput((k) => { if (k === "q") exit(); if (k === "1") setTab("traces"); if (k === "2") setTab("errors") })

  const handle = useCallback((e: SpanEvent) => {
    const { span } = e
    setTotal(n => n+1)
    if (span.duration !== undefined) setDurations(d => [...d.slice(-999), span.duration!])
    if (span.status.code === SpanStatusCode.ERROR) setErrors(prev => [span, ...prev.slice(0,49)])
    setTraces(prev => {
      const ex = prev.find(t => t.traceId === span.traceId)
      if (ex) return prev.map(t => t.traceId === span.traceId
        ? { ...t, spans: [...t.spans, span].sort((a,b) => a.startTime - b.startTime), hasError: t.hasError || span.status.code === SpanStatusCode.ERROR }
        : t)
      return [{ traceId: span.traceId, spans: [span], startTime: span.startTime, hasError: span.status.code === SpanStatusCode.ERROR }, ...prev].slice(0, 50)
    })
  }, [])

  useEffect(() => { onSpanEvent(handle) }, [onSpanEvent, handle])

  return (
    <Box flexDirection="column" padding={1}>
      <Box flexDirection="row" gap={2} marginBottom={1}>
        <Text bold color="cyan">tracepath</Text>
        <Text dimColor>â”‚ ws://localhost:{port} â”‚ q to quit</Text>
      </Box>
      <StatsBar totalSpans={total} errorCount={errors.length} p50={pct(durations,50)} p99={pct(durations,99)} connectedClients={connectedClients} />
      <Box flexDirection="row" gap={2} marginY={1}>
        <Text bold={tab==="traces"} color={tab==="traces"?"cyan":undefined}>[1] traces</Text>
        <Text bold={tab==="errors"} color={tab==="errors"?"cyan":undefined}>[2] errors{errors.length>0?` (${errors.length})`:""}</Text>
      </Box>
      {tab === "traces" && (
        <Box flexDirection="column">
          {traces.length === 0
            ? <Text dimColor>Waiting for tracesâ€¦ start your app with @tracepath/node</Text>
            : traces.slice(0,15).map(t => (
                <Box key={t.traceId} flexDirection="column" marginBottom={1}>
                  {t.spans.map(s => <SpanRow key={s.spanId} span={s} depth={s.parentSpanId ? 1 : 0} />)}
                </Box>
              ))}
        </Box>
      )}
      {tab === "errors" && (
        <Box flexDirection="column">
          {errors.length === 0
            ? <Text color="green">No errors ðŸŽ‰</Text>
            : errors.slice(0,20).map(s => <SpanRow key={s.spanId} span={s} />)}
        </Box>
      )}
    </Box>
  )
}