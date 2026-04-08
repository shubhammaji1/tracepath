import React from "react"
import { Text, Box } from "ink"
interface Props { totalSpans: number; errorCount: number; p50: number; p99: number; connectedClients: number }
export const StatsBar: React.FC<Props> = ({ totalSpans, errorCount, p50, p99, connectedClients }) => (
  <Box flexDirection="row" gap={3} borderStyle="single" paddingX={1}>
    <Box gap={1}><Text dimColor>spans:</Text><Text bold>{totalSpans}</Text></Box>
    <Box gap={1}><Text dimColor>errors:</Text><Text bold color={errorCount > 0 ? "red" : "green"}>{errorCount}</Text></Box>
    <Box gap={1}><Text dimColor>p50:</Text><Text bold color="green">{Math.round(p50)}ms</Text></Box>
    <Box gap={1}><Text dimColor>p99:</Text><Text bold color={p99 > 500 ? "yellow" : "green"}>{Math.round(p99)}ms</Text></Box>
    <Box gap={1}><Text dimColor>clients:</Text><Text bold color={connectedClients > 0 ? "cyan" : "gray"}>{connectedClients}</Text></Box>
  </Box>
)