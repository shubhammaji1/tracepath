import React from 'react'
import { Text, Box } from 'ink'
import type { Span } from '@tracepath/core'
import { SpanStatusCode } from '@tracepath/core'

export const SpanRow: React.FC<{ span: Span; depth?: number }> = ({ span, depth = 0 }) => {
  const isErr    = span.status.code === SpanStatusCode.ERROR
  const isSlow   = (span.duration ?? 0) > 200
  const indent   = '  '.repeat(depth)
  const prefix   = depth > 0 ? '+- ' : '>> '
  const durColor = isErr ? 'red' : isSlow ? 'yellow' : 'green'
  const icon     = isErr ? '[x]' : '[v]'

  return (
    <Box flexDirection="row">
      <Text color={isErr ? 'red' : 'green'}>{icon} </Text>
      <Text>{indent}{prefix}</Text>
      <Text bold={depth === 0} wrap="truncate-end">{span.name}</Text>
      {span.attributes['http.status_code'] !== undefined && (
        <Text dimColor>  {String(span.attributes['http.status_code'])}</Text>
      )}
      <Text color={durColor}>  {Math.round(span.duration ?? 0)}ms</Text>
      {isSlow && !isErr && <Text color="yellow">  [SLOW]</Text>}
      {isErr && span.status.message && (
        <Text color="red">  ! {span.status.message}</Text>
      )}
    </Box>
  )
}
