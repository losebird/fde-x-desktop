import { app, BrowserWindow, dialog, ipcMain, shell, type IpcMainInvokeEvent } from 'electron'
import type { ChildProcess } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnBff, serverEntryForApp } from './bff.js'
import { bindPreferredLoopbackPort, buildBffEnv, pageOrigin } from './bff-env.js'
import { ensureFirstRun } from './first-run.js'
import { initWindowDataUrl, initWindowSetStepSource } from './init-window.js'
import {
  platformRuntimeKey,
  resolveAppRoot,
  resolvePackagedResources,
  userDataRoots,
  type UserDataRoots,
} from './paths.js'

const MAX_BFF_EXITS = 3

let mainWindow: BrowserWindow | null = null
let bffChild: ChildProcess | null = null
let bffPort = 0
let quitTimer: ReturnType<typeof setTimeout> | null = null
let respawnTimer: ReturnType<typeof setTimeout> | null = null
let quitting = false
let exitStreak = 0
let pack: { resources: string; appRoot: string; roots: UserDataRoots } | null = null

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:'
  } catch {
    return false
  }
}

function desktopDev() {
  return process.env.FDE_DESKTOP_DEV === '1'
}

function pageUrl(port: number) {
  return `${pageOrigin(port)}/ai`
}

function bffPortFile(base: string) {
  return join(base, 'run', 'bff.port')
}

async function readLastBffPort(base: string) {
  try {
    const raw = Number(String(await readFile(bffPortFile(base), 'utf8')).trim())
    return Number.isInteger(raw) && raw > 0 ? raw : 0
  } catch {
    return 0
  }
}

async function writeLastBffPort(base: string, port: number) {
  await mkdir(join(base, 'run'), { recursive: true })
  await writeFile(bffPortFile(base), `${port}\n`, 'utf8')
}

async function envelopePath(resources: string, appRoot: string) {
  const href = pathToFileURL(join(appRoot, 'runtime', 'desktop-process-path.mjs')).href
  const mod = await import(href) as {
    desktopProcessPath: (input: { resources: string; inheritedPath?: string; extraDirs?: string[] }) => string
    cuaDriverDirs: (resources: string) => string[]
  }
  return mod.desktopProcessPath({
    resources,
    inheritedPath: process.env.PATH,
    extraDirs: mod.cuaDriverDirs(resources),
  })
}

async function startBff() {
  if (!pack) throw new Error('desktop pack not resolved')
  const port = await bindPreferredLoopbackPort(await readLastBffPort(pack.roots.base))
  const env = {
    ...buildBffEnv({
      resources: pack.resources,
      appRoot: pack.appRoot,
      port,
      roots: pack.roots,
      desktopDev: desktopDev(),
    }),
    PATH: await envelopePath(pack.resources, pack.appRoot),
  }
  const spawned = await spawnBff(
    serverEntryForApp(pack.appRoot),
    env,
    process.execPath,
    { cwd: pack.appRoot },
  )
  bffChild = spawned.child
  bffPort = spawned.port
  exitStreak = 0
  await writeLastBffPort(pack.roots.base, spawned.port)
  spawned.child.once('exit', onBffExit)
}

function onBffExit() {
  bffChild = null
  if (quitting) return
  exitStreak += 1
  if (exitStreak > MAX_BFF_EXITS) {
    void showBootFailed()
    return
  }
  const delay = 1000 * (2 ** (exitStreak - 1))
  if (respawnTimer) clearTimeout(respawnTimer)
  respawnTimer = setTimeout(() => {
    void startBff()
      .then(() => loadMain(bffPort))
      .catch((error: unknown) => {
        console.error(error)
        onBffExit()
      })
  }, delay)
}

async function showBootFailed() {
  const logs = pack?.roots.base || ''
  const picked = await dialog.showMessageBox({
    type: 'error',
    message: '核心没重新读起来',
    detail: logs,
    buttons: ['打开日志目录', '退出'],
    defaultId: 0,
    cancelId: 1,
  })
  if (picked.response === 0 && logs) await shell.openPath(logs)
  else app.quit()
}

function loadMain(port: number) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  void mainWindow.loadURL(pageUrl(port))
}

function openMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadMain(bffPort)
    mainWindow.show()
    return
  }
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
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  loadMain(bffPort)
}

async function createWindow() {
  if (bffChild && bffPort) {
    openMainWindow()
    return
  }

  const resources = resolvePackagedResources()
  const appRoot = resolveAppRoot(resources)
  const roots = userDataRoots()
  pack = { resources, appRoot, roots }
  await mkdir(join(roots.base, 'data'), { recursive: true })

  const initWindow = new BrowserWindow({
    width: 420,
    height: 260,
    show: false,
    title: 'FDE-X 初始化',
    backgroundColor: '#FAFAFA',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  await initWindow.loadURL(initWindowDataUrl())
  if (!initWindow.isDestroyed()) initWindow.show()

  const setStep = (text: string) => {
    if (initWindow.isDestroyed()) return
    initWindow.webContents.executeJavaScript(initWindowSetStepSource(text)).catch(() => undefined)
  }

  await ensureFirstRun({
    dshHome: roots.dshHome,
    installStatePath: roots.installState,
    semanticRuntimeSrc: join(resources, 'semantic-runtime', platformRuntimeKey()),
    vendorDir: join(resources, 'plugins'),
    platform: platformRuntimeKey(),
    skipSemanticCopy: desktopDev(),
    onProgress: (step, detail) => {
      if (step === 'create_dirs') setStep('创建用户目录…')
      if (step === 'semantic_probe') setStep('检查语义引擎安装状态…')
      if (step === 'semantic_verify_source') setStep('校验语义引擎包…')
      if (step === 'semantic_install') setStep('正在安装语义引擎（约 1.8 GB）…')
      if (step === 'semantic_tree_hash') setStep(detail ? '校验 treeHash…' : '校验 treeHash…')
      if (step === 'write_install_state') setStep('写入安装状态…')
      if (step === 'complete') setStep('完成')
    },
  })

  setStep('正在启动核心…')
  await startBff()
  if (!initWindow.isDestroyed()) initWindow.close()
  openMainWindow()
}

async function gracefulShutdown() {
  quitting = true
  if (respawnTimer) clearTimeout(respawnTimer)
  if (!bffPort && !bffChild) return
  try {
    if (bffPort) {
      await fetch(`http://127.0.0.1:${bffPort}/api/v1/ai/shutdown`, {
        method: 'POST',
        headers: {
          Origin: pageOrigin(bffPort),
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    }
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
    if (!isSafeExternalUrl(String(url || ''))) return
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
