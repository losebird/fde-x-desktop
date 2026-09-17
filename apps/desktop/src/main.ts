import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import type { ChildProcess } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnBff, serverEntryForApp } from './bff.js'
import { ensureFirstRun } from './first-run.js'
import {
  platformRuntimeKey,
  resolveAppRoot,
  resolvePackagedResources,
  userDataRoots,
} from './paths.js'

let mainWindow: BrowserWindow | null = null
let bffChild: ChildProcess | null = null
let bffPort = 0
let quitTimer: ReturnType<typeof setTimeout> | null = null

function buildBffEnv(resources: string, appRoot: string) {
  const roots = userDataRoots()
  const runtimeKey = platformRuntimeKey()
  const staticDir = process.env.FDE_DESKTOP_DEV === '1'
    ? join(appRoot, 'dist')
    : join(resources, 'app', 'dist')

  return {
    FDE_APP_ROOT: appRoot,
    FDE_RESOURCES: resources,
    FDE_DSH_BIN: join(resources, 'dsh', 'bin', process.platform === 'win32' ? 'dsh.cmd' : 'dsh'),
    FDE_VENDOR_DIR: join(resources, 'plugins'),
    FDE_SEMANTIC_RUNTIME_SRC: join(resources, 'semantic-runtime', runtimeKey),
    FDE_SEMANTIC_RUNTIME_MODE: 'readonly',
    FDE_DSH_HOME: roots.dshHome,
    FDE_DATABASE_PATH: roots.databasePath,
    FDE_RUNTIME_PORT: '0',
    FDE_RUNTIME_HOST: '127.0.0.1',
    FDE_ALLOWED_ORIGINS: 'app://fde-x',
    FDE_STATIC_DIR: staticDir,
    FDE_AI_WORKSPACE: appRoot,
  }
}

async function createWindow() {
  const resources = resolvePackagedResources()
  const appRoot = resolveAppRoot(resources)
  const roots = userDataRoots()
  await mkdir(join(roots.base, 'data'), { recursive: true })

  const initWindow = new BrowserWindow({
    width: 420,
    height: 240,
    show: true,
    title: 'FDE-X 初始化',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  initWindow.loadURL(`data:text/html,<html><body style="font-family:system-ui;padding:24px"><h2>正在初始化…</h2><p id="s">创建用户目录</p></body></html>`)

  const setStep = (text: string) => {
    initWindow.webContents.executeJavaScript(`document.getElementById('s').textContent=${JSON.stringify(text)}`).catch(() => undefined)
  }

  await ensureFirstRun(roots.dshHome, roots.installState, (step) => {
    if (step === 'create_dirs') setStep('创建用户目录…')
    if (step === 'complete') setStep('完成')
  })

  const { child, port } = await spawnBff(
    serverEntryForApp(appRoot),
    buildBffEnv(resources, appRoot),
    process.execPath,
  )
  bffChild = child
  bffPort = port

  initWindow.close()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: true,
    title: 'FDE-X',
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  await mainWindow.loadURL(`http://127.0.0.1:${port}/ai`)
}

async function gracefulShutdown() {
  if (!bffPort) return
  try {
    await fetch(`http://127.0.0.1:${bffPort}/api/v1/ai/shutdown`, {
      method: 'POST',
      headers: {
        Origin: `http://127.0.0.1:${bffPort}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
  } catch {
    // BFF 可能已退出
  }
  if (bffChild && !bffChild.killed) {
    bffChild.kill('SIGTERM')
  }
}

app.whenReady().then(() => {
  ipcMain.handle('fde:pick-directory', async () => {
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || !result.filePaths[0]) return { path: null }
    return { path: result.filePaths[0] }
  })
  ipcMain.handle('fde:open-external', async (_event: IpcMainInvokeEvent, url: string) => {
    await shell.openExternal(url)
  })
  ipcMain.handle('fde:app-info', async () => ({
    version: app.getVersion(),
    bffPort,
    resources: resolvePackagedResources(),
  }))

  return createWindow()
}).catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
  quitTimer = setTimeout(() => { void gracefulShutdown().finally(() => app.quit()) }, 60_000)
})

app.on('before-quit', () => {
  if (quitTimer) clearTimeout(quitTimer)
  void gracefulShutdown()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow()
  }
})
