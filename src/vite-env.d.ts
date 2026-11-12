/// <reference types="vite/client" />
/// <reference path="./types/iui-client.d.ts" />

interface FdeDesktopBridge {
  pickDirectory: () => Promise<{ path: string | null }>
  openExternal: (url: string) => Promise<void>
  appInfo: () => Promise<{ version: string; bffPort: number; resources: string }>
  uiToken?: () => Promise<string>
  notify?: (payload: { title: string; body?: string; id?: string; href?: string; sessionId?: string; cwd?: string; peerId?: string; groupId?: string }) => Promise<{ ok: boolean }>
  onShortcut?: (cb: (name: string) => void) => () => void
  onNoticeOpen?: (cb: (payload: { id?: string; href?: string; sessionId?: string; cwd?: string; peerId?: string; groupId?: string }) => void) => () => void
}

interface Window {
  fdeDesktop?: FdeDesktopBridge
}
