import { askAiForResult, type AskAiOptions } from '@/lib/ask-ai'

declare global {
  interface Window {
    __fdeAsk?: (opts: AskAiOptions) => ReturnType<typeof askAiForResult>
  }
}

export function installFdeAskDev() {
  if (!import.meta.env.DEV) return
  window.__fdeAsk = (opts) => askAiForResult(opts)
}
