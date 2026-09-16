export type DirectoryPermission = 'granted' | 'prompt' | 'denied'

export type LocalDirectoryHandle = {
  kind: 'directory'
  name: string
  queryPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryPermission>
  requestPermission?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryPermission>
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<LocalDirectoryHandle>
  }
}

const DB_NAME = 'fde-x-workspace-directories'
const STORE_NAME = 'handles'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export function canPickWorkspaceDirectory() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export async function pickWorkspaceDirectory(): Promise<LocalDirectoryHandle> {
  if (!window.showDirectoryPicker) throw new Error('当前浏览器不支持本地文件夹选择')
  return window.showDirectoryPicker({ mode: 'readwrite' })
}

export async function saveWorkspaceDirectory(workspaceId: string, handle: LocalDirectoryHandle) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(handle, workspaceId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}

export async function getWorkspaceDirectory(workspaceId: string): Promise<LocalDirectoryHandle | null> {
  const db = await openDb()
  const handle = await new Promise<LocalDirectoryHandle | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(workspaceId)
    request.onsuccess = () => resolve((request.result as LocalDirectoryHandle | undefined) ?? null)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return handle
}

export async function removeWorkspaceDirectory(workspaceId: string) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(workspaceId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  db.close()
}

export async function getDirectoryPermission(handle: LocalDirectoryHandle): Promise<DirectoryPermission> {
  if (!handle.queryPermission) return 'prompt'
  return handle.queryPermission({ mode: 'readwrite' })
}
