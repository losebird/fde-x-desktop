/// <reference types="vite/client" />
/// <reference path="./types/iui-client.d.ts" />

interface FdeDesktopBridge {
  pickDirectory: () => Promise<{ path: string | null }>
  openExternal: (url: string) => Promise<void>
  appInfo: () => Promise<{ version: string; bffPort: number; resources: string }>
  uiToken?: () => Promise<string>
  notify?: (payload: { title: string; body?: string }) => Promise<{ ok: boolean }>
}

interface Window {
  fdeDesktop?: FdeDesktopBridge
}
