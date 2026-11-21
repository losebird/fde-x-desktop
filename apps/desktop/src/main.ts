import { app, BrowserWindow, dialog, ipcMain, Notification, shell, type IpcMainInvokeEvent } from 'electron'
import { execFile, type ChildProcess } from 'node:child_process'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let bffChild: ChildProcess | null = null
let bffPort = 0
let uiToken = ''
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

const GLASS = '/System/Library/Sounds/Glass.aiff'

function noticeIconPath() {
  const icns = join(process.resourcesPath, 'icon.icns')
  if (existsSync(icns)) return icns
  const png = join(import.meta.dirname, '../build/icon.png')
  return existsSync(png) ? png : undefined
}

function playGlass() {
  if (process.platform === 'darwin' && existsSync(GLASS)) {
    execFile('afplay', [GLASS], () => undefined)
  }
}

type OsNoticePayload = {
  title?: string
  body?: string
  id?: string
  href?: string
  sessionId?: string
  cwd?: string
  peerId?: string
  groupId?: string
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

let lastNotice: Notification | null = null

function appleScriptBanner(title: string, body: string) {
  if (process.platform !== 'darwin') return
  const heading = String(title || 'FDE-X').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  const text = String(body || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  execFile('osascript', ['-e', `display notification "${text}" with title "${heading}" sound name "Glass"`], () => undefined)
}

function showDesktopNotice(payload: OsNoticePayload) {
  const title = String(payload.title || 'FDE-X')
  const body = String(payload.body || '')
  const focused = Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused())
  if (!focused) app.dock?.bounce('informational')
  let presented = false
  if (Notification.isSupported()) {
    const icon = noticeIconPath()
    const notice = new Notification({
      title,
      body,
      silent: true,
      ...(icon ? { icon } : {}),
    })
    lastNotice = notice
    notice.on('click', () => {
      focusMainWindow()
      if (!mainWindow || mainWindow.isDestroyed()) return
      mainWindow.webContents.send('fde:notice-open', {
        id: payload.id || '',
        href: payload.href || '',
        sessionId: payload.sessionId || '',
        cwd: payload.cwd || '',
        peerId: payload.peerId || '',
        groupId: payload.groupId || '',
      })
    })
    notice.on('show', () => {
      presented = true
    })
    notice.on('failed', (_event, error) => {
      console.warn('fde_notify_failed', error)
      try {
        const log = pack
          ? join(pack.roots.base, 'notify-failed.log')
          : join(app.getPath('userData'), 'notify-failed.log')
        appendFileSync(log, `${new Date().toISOString()} ${error}\n`)
      } catch {
        /* diagnostic only */
      }
      if (!presented) appleScriptBanner(title, body)
    })
    notice.show()
  }
  // Ad-hoc UN often fails; macOS also suppresses UN banners while FDE-X is frontmost.
  if (focused || !Notification.isSupported()) {
    appleScriptBanner(title, body)
  } else {
    playGlass()
    setTimeout(() => {
      if (!presented) appleScriptBanner(title, body)
    }, 600)
  }
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
  uiToken = spawned.uiToken
  await writeLastBffPort(pack.roots.base, spawned.port)
  const spawnedAt = Date.now()
  spawned.child.once('exit', () => {
    if (Date.now() - spawnedAt > 60_000) exitStreak = 0
    onBffExit()
  })
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

function readBrandLogoSvg(resources: string) {
  const candidates = [
    join(resources, 'app/dist/brand/logo.svg'),
    join(import.meta.dirname, '../build/logo.svg'),
    join(fileURLToPath(new URL('../../../public/brand/logo.svg', import.meta.url))),
  ]
  for (const path of candidates) {
    if (!path || !existsSync(path)) continue
    try {
      return readFileSync(path, 'utf8')
    } catch {
      continue
    }
  }
  return ''
}

async function setBackgroundPaused(paused: boolean) {
  if (!bffPort || quitting) return
  try {
    await fetch(`http://127.0.0.1:${bffPort}/api/v1/runtime/background`, {
      method: 'POST',
      headers: {
        Origin: pageOrigin(bffPort),
        'Content-Type': 'application/json',
        'x-fde-ui-token': uiToken,
      },
      body: JSON.stringify({ paused }),
    })
  } catch {
    /* BFF may be down during hide */
  }
}

function bindMainWindowLifecycle(win: BrowserWindow) {
  win.on('close', (event) => {
    if (process.platform === 'darwin' && !quitting) {
      event.preventDefault()
      win.hide()
    }
  })
  win.on('hide', () => { void setBackgroundPaused(true) })
  win.on('minimize', () => { void setBackgroundPaused(true) })
  win.on('show', () => { void setBackgroundPaused(false) })
  win.on('restore', () => { void setBackgroundPaused(false) })
}

function openMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (bffPort) loadMain(bffPort)
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    return
  }
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: true,
    title: 'FDE-X',
    icon: join(import.meta.dirname, '../build/icon.png'),
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  bindMainWindowLifecycle(mainWindow)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  loadMain(bffPort)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.alt || input.shift || input.isAutoRepeat) return
    if (!input.meta && !input.control) return
    const key = String(input.key || '')
    const lower = key.toLowerCase()
    let name = ''
    if (lower === 'k') name = 'search'
    else if (lower === 'n') name = 'session'
    else if (lower === 't') name = 'task'
    else if (lower === 'e') name = 'event'
    else if (key === '0') name = 'briefing'
    else if (key === ';') name = 'mute-im'
    else if (key === 'ArrowUp') name = 'session-prev'
    else if (key === 'ArrowDown') name = 'session-next'
    if (!name) return
    event.preventDefault()
    mainWindow?.webContents.send('fde:shortcut', name)
  })
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
  await initWindow.loadURL(initWindowDataUrl(readBrandLogoSvg(resources)))
  if (!initWindow.isDestroyed()) initWindow.show()

  const setStep = (text: string) => {
    if (initWindow.isDestroyed()) return
    initWindow.webContents.executeJavaScript(initWindowSetStepSource(text)).catch(() => undefined)
  }

  let installTick
  try {
    installTick = setInterval(() => {
      setStep('正在安装语义引擎（约 4 万个文件，可能需要几分钟）…')
    }, 4000)
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
        if (step === 'semantic_install') setStep('正在安装语义引擎（约 4 万个文件，可能需要几分钟）…')
        if (step === 'semantic_tree_hash') setStep(detail ? '校验 treeHash…' : '校验 treeHash…')
        if (step === 'write_install_state') setStep('写入安装状态…')
        if (step === 'complete') setStep('完成')
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setStep(`初始化失败：${message}`)
    dialog.showErrorBox('FDE-X 初始化失败', message)
    throw error
  } finally {
    if (installTick) clearInterval(installTick)
  }

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
          'x-fde-ui-token': uiToken,
        },
        body: '{}',
      })
    }
  } catch {
    // BFF 可能已退出
  }
  if (bffChild?.pid) {
    try { bffChild.kill('SIGTERM') } catch { /* already gone */ }
    const pid = bffChild.pid
    setTimeout(() => {
      try { process.kill(pid, 'SIGKILL') } catch { /* gone */ }
    }, 1500)
  }
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return
  if (Notification.isSupported()) Notification.removeAll()
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
  ipcMain.handle('fde:ui-token', () => uiToken)
  ipcMain.handle('fde:notify', (_event: IpcMainInvokeEvent, payload: OsNoticePayload = {}) => {
    showDesktopNotice(payload)
    return { ok: true }
  })

  return createWindow()
}).catch((error: unknown) => {
  console.error(error)
  app.exit(1)
})

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') return
  quitTimer = setTimeout(() => { void gracefulShutdown().finally(() => app.quit()) }, 60_000)
})

app.on('before-quit', () => {
  quitting = true
  if (quitTimer) clearTimeout(quitTimer)
  quitTimer = null
  void gracefulShutdown()
})

app.on('activate', () => {
  if (quitTimer) {
    clearTimeout(quitTimer)
    quitTimer = null
  }
  if (!mainWindow || mainWindow.isDestroyed()) {
    void createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
})

app.on('second-instance', () => {
  focusMainWindow()
})
