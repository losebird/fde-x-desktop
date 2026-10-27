export const TERMINAL_FONT_SIZE = 12

export function proposeTerminalGrid(width: number, height: number, fontSize = TERMINAL_FONT_SIZE) {
  const w = Math.max(0, width)
  const h = Math.max(0, height)
  let cellWidth = fontSize * 0.6
  let cellHeight = fontSize * 1.2
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
      const measured = ctx.measureText('W').width
      if (measured > 0) cellWidth = measured
    }
  }
  const cols = Math.max(2, Math.floor(w / cellWidth) || 2)
  const rows = Math.max(1, Math.floor(h / cellHeight) || 1)
  return { cols, rows }
}
