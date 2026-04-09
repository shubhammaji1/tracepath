import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import type { Span } from '@tracepath/core'
import { SpanStatusCode } from '@tracepath/core'
import { SpanRow } from './components/SpanRow.js'
import type { SpanEvent } from '../server/ws-server.js'

interface TraceView {
  traceId: string
  spans: Span[]
  startTime: number
  hasError: boolean
}

interface Props {
  onSpanEvent: (h: (e: SpanEvent) => void) => void
  // getClientCount is a fn so we always read the live server value, not a
  // stale snapshot captured at render time (that was the clients:0 bug)
  getClientCount: () => number
  port: number
}

const pct = (arr: number[], p: number): number => {
  if (!arr.length) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  return sorted[Math.ceil((p / 100) * sorted.length) - 1] ?? 0
}

export const Dashboard: React.FC<Props> = ({ onSpanEvent, getClientCount, port }) => {
  const { exit } = useApp()
  const [traces, setTraces]       = useState<TraceView[]>([])
  const [errors, setErrors]       = useState<Span[]>([])
  const [durations, setDurations] = useState<number[]>([])
  const [total, setTotal]         = useState(0)
  const [clients, setClients]     = useState(0)
  const [tab, setTab]             = useState<'traces' | 'errors'>('traces')

  // Poll live client count every second — re-renders when a new SDK connects
  useEffect(() => {
    const t = setInterval(() => setClients(getClientCount()), 1000)
    return () => clearInterval(t)
  }, [getClientCount])

  useInput((k) => {
    if (k === 'q') exit()
    if (k === '1') setTab('traces')
    if (k === '2') setTab('errors')
  })

  const handle = useCallback((e: SpanEvent) => {
    const { span } = e
    setTotal(n => n + 1)
    setClients(getClientCount()) // immediate update on first span
    if (span.duration !== undefined) {
      setDurations(d => [...d.slice(-999), span.duration!])
    }
    if (span.status.code === SpanStatusCode.ERROR) {
      setErrors(prev => [span, ...prev.slice(0, 49)])
    }
    setTraces(prev => {
      const existing = prev.find(t => t.traceId === span.traceId)
      if (existing) {
        return prev.map(t =>
          t.traceId === span.traceId
            ? {
                ...t,
                spans: [...t.spans.filter(s => s.spanId !== span.spanId), span]
                  .sort((a, b) => a.startTime - b.startTime),
                hasError: t.hasError || span.status.code === SpanStatusCode.ERROR,
              }
            : t,
        )
      }
      return [
        {
          traceId: span.traceId,
          spans: [span],
          startTime: span.startTime,
          hasError: span.status.code === SpanStatusCode.ERROR,
        },
        ...prev,
      ].slice(0, 50)
    })
  }, [getClientCount])

  useEffect(() => { onSpanEvent(handle) }, [onSpanEvent, handle])

  const p50       = Math.round(pct(durations, 50))
  const p99       = Math.round(pct(durations, 99))
  const errColor  = errors.length > 0 ? 'red' : 'green'
  const cliColor  = clients > 0 ? 'cyan' : 'gray'

  return (
    <Box flexDirection="column" padding={1}>

      {/* Header — plain ASCII separators, no Unicode box chars */}
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <Text bold color="cyan">tracepath</Text>
        <Text dimColor>| ws://localhost:{port} | q=quit 1=traces 2=errors</Text>
      </Box>

      {/* Stats bar — inline text avoids borderStyle double-render bug */}
      <Box marginBottom={1} paddingX={1}>
        <Text>
          <Text dimColor>spans </Text><Text bold>{total}</Text>
          <Text dimColor>  errors </Text><Text bold color={errColor}>{errors.length}</Text>
          <Text dimColor>  p50 </Text><Text bold color="green">{p50}ms</Text>
          <Text dimColor>  p99 </Text>
          <Text bold color={p99 > 500 ? 'yellow' : 'green'}>{p99}ms</Text>
          <Text dimColor>  clients </Text><Text bold color={cliColor}>{clients}</Text>
        </Text>
      </Box>

      {/* Tab bar */}
      <Box flexDirection="row" gap={3} marginBottom={1}>
        <Text
          bold={tab === 'traces'}
          color={tab === 'traces' ? 'cyan' : undefined}
          dimColor={tab !== 'traces'}
        >
          [1] traces
        </Text>
        <Text
          bold={tab === 'errors'}
          color={tab === 'errors' ? 'cyan' : undefined}
          dimColor={tab !== 'errors'}
        >
          [2] errors{errors.length > 0 ? ` (${errors.length})` : ''}
        </Text>
      </Box>

      {/* ── Traces ─────────────────────────────────────────────────────── */}
      {tab === 'traces' && (
        <Box flexDirection="column">
          {traces.length === 0 ? (
            <Text dimColor>Waiting for traces... start your app with @tracepath/node</Text>
          ) : (
            traces.slice(0, 15).map(t => (
              <Box key={t.traceId} flexDirection="column" marginBottom={1}>
                {t.spans.map(s => (
                  <SpanRow key={s.spanId} span={s} depth={s.parentSpanId ? 1 : 0} />
                ))}
              </Box>
            ))
          )}
        </Box>
      )}

      {/* ── Errors ─────────────────────────────────────────────────────── */}
      {tab === 'errors' && (
        <Box flexDirection="column">
          {errors.length === 0 ? (
            <Text color="green">No errors!</Text>
          ) : (
            errors.slice(0, 20).map(s => (
              <Box key={s.spanId} flexDirection="column" marginBottom={1}>
                <SpanRow span={s} />
                {s.events
                  .filter(ev => ev.name === 'exception')
                  .map((ev, i) => (
                    <Box key={i} paddingLeft={4}>
                      <Text color="red">
                        {String(ev.attributes?.['exception.type'] ?? '')}:{' '}
                        {String(ev.attributes?.['exception.message'] ?? '')}
                      </Text>
                    </Box>
                  ))}
              </Box>
            ))
          )}
        </Box>
      )}

    </Box>
  )
}
