import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fdeDesktop', {
  pickDirectory: () => ipcRenderer.invoke('fde:pick-directory'),
  openExternal: (url: string) => ipcRenderer.invoke('fde:open-external', url),
  appInfo: () => ipcRenderer.invoke('fde:app-info'),
  uiToken: () => ipcRenderer.invoke('fde:ui-token'),
  notify: (payload: { title: string; body?: string; id?: string; href?: string; sessionId?: string; cwd?: string; peerId?: string; groupId?: string }) => ipcRenderer.invoke('fde:notify', payload),
  onShortcut: (cb: (name: string) => void) => {
    const handler = (_event: unknown, name: string) => cb(name)
    ipcRenderer.on('fde:shortcut', handler)
    return () => ipcRenderer.removeListener('fde:shortcut', handler)
  },
  onNoticeOpen: (cb: (payload: { id?: string; href?: string; sessionId?: string; cwd?: string; peerId?: string; groupId?: string }) => void) => {
    const handler = (_event: unknown, payload: { id?: string; href?: string; sessionId?: string; cwd?: string; peerId?: string; groupId?: string }) => cb(payload)
    ipcRenderer.on('fde:notice-open', handler)
    return () => ipcRenderer.removeListener('fde:notice-open', handler)
  },
})
