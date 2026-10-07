import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

export const TERMINAL_FONT_SIZE = 12

export function proposeTerminalGrid(width: number, height: number, fontSize = TERMINAL_FONT_SIZE) {
  const host = document.createElement('div')
  host.style.width = `${Math.max(0, width)}px`
  host.style.height = `${Math.max(0, height)}px`
  host.style.position = 'absolute'
  host.style.left = '-9999px'
  host.style.overflow = 'hidden'
  document.body.appendChild(host)
  const term = new Terminal({ fontSize, convertEol: true })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(host)
  const dim = fit.proposeDimensions()
  term.dispose()
  host.remove()
  const cols = Math.max(2, Number(dim?.cols) || 2)
  const rows = Math.max(1, Number(dim?.rows) || 1)
  return { cols, rows }
}
