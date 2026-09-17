/// <reference types="vite/client" />

interface FdeDesktopBridge {
  pickDirectory: () => Promise<{ path: string | null }>
  openExternal: (url: string) => Promise<void>
  appInfo: () => Promise<{ version: string; bffPort: number; resources: string }>
}

interface Window {
  fdeDesktop?: FdeDesktopBridge
}
