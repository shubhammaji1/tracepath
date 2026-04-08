import React from "react"
import { Text, Box } from "ink"
import type { Span } from "@tracepath/core"
import { SpanStatusCode } from "@tracepath/core"

export const SpanRow: React.FC<{ span: Span; depth?: number }> = ({ span, depth = 0 }) => {
  const isErr = span.status.code === SpanStatusCode.ERROR
  const slow = (span.duration ?? 0) > 200
  const indent = "  ".repeat(depth); const prefix = depth > 0 ? "â””â”€ " : "â— "
  return (
    <Box flexDirection="row" gap={1}>
      <Text color={isErr ? "red" : "green"}>{isErr ? "âœ—" : "âœ“"}</Text>
      <Text>{indent}{prefix}</Text>
      <Text bold={depth === 0} wrap="truncate-end">{span.name}</Text>
      {span.attributes["http.status_code"] !== undefined && <Text dimColor>{` ${span.attributes["http.status_code"]}`}</Text>}
      <Text color={isErr ? "red" : slow ? "yellow" : "green"}>{`${Math.round(span.duration ?? 0)}ms`}</Text>
      {slow && !isErr && <Text color="yellow"> ðŸ¢</Text>}
      {isErr && <Text color="red"> {span.status.message}</Text>}
    </Box>
  )
}