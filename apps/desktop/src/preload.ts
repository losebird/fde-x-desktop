import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('fdeDesktop', {
  pickDirectory: () => ipcRenderer.invoke('fde:pick-directory'),
  openExternal: (url: string) => ipcRenderer.invoke('fde:open-external', url),
  appInfo: () => ipcRenderer.invoke('fde:app-info'),
})
