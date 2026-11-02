export type McpSegment = 'servers' | 'business'

let current: McpSegment = 'servers'
const listeners = new Set<(segment: McpSegment) => void>()

export function landMcpSegment(segment: McpSegment) {
  current = segment
  for (const fn of listeners) fn(segment)
}

export function takeMcpSegment(fallback: McpSegment = 'servers'): McpSegment {
  return current || fallback
}

export function onMcpSegment(fn: (segment: McpSegment) => void) {
  listeners.add(fn)
  fn(current)
  return () => { listeners.delete(fn) }
}
