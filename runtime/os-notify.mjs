import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_SWIFT = join(HERE, 'os-notify-helper.swift')
const GLASS = '/System/Library/Sounds/Glass.aiff'
const HELPER_ID = 'com.fde-x.workstation.notify'
export const FDE_BUNDLE_ID = 'com.fde-x.workstation'
let helperBuild = null
let gates = { taskDueSoonNotify: true, mcpDownNotify: true }

export function setOsNotifyGates(patch = {}) {
  gates = {
    taskDueSoonNotify: patch.taskDueSoonNotify !== false,
    mcpDownNotify: patch.mcpDownNotify !== false,
  }
  return gates
}

function appleString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function osascriptNotifyArgs(title, body) {
  const heading = appleString(title || 'FDE-X')
  const text = appleString(body || '')
  return [
    '-e', `tell application id "${FDE_BUNDLE_ID}"`,
    '-e', `display notification "${text}" with title "${heading}" sound name "Glass"`,
    '-e', 'end tell',
  ]
}

function helperIconSource() {
  const resources = process.env.FDE_RESOURCES
  const candidates = [
    resources ? join(resources, '..', 'icon.icns') : '',
    '/Applications/FDE-X.app/Contents/Resources/icon.icns',
  ].filter(Boolean)
  return candidates.find((path) => existsSync(path)) || ''
}

function installHelperIcon(paths) {
  const src = helperIconSource()
  if (!src) return
  const resourcesDir = join(paths.appDir, 'Contents', 'Resources')
  mkdirSync(resourcesDir, { recursive: true })
  try {
    copyFileSync(src, join(resourcesDir, 'AppIcon.icns'))
  } catch {
    /* icon is best-effort */
  }
}

export function notifyHelperHome(dshHome = process.env.FDE_DSH_HOME) {
  return join(dshHome || join(homedir(), '.dsh-fde-x'), 'notify-helper')
}

export function notifyHelperPaths(dshHome) {
  const root = notifyHelperHome(dshHome)
  const appDir = join(root, 'FDE-X Notify.app')
  return {
    root,
    appDir,
    bin: join(appDir, 'Contents', 'MacOS', 'notify'),
    plist: join(appDir, 'Contents', 'Info.plist'),
    stamp: join(root, 'source.stamp'),
    log: join(root, 'last.log'),
  }
}

function helperPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>notify</string>
  <key>CFBundleIdentifier</key>
  <string>${HELPER_ID}</string>
  <key>CFBundleName</key>
  <string>FDE-X</string>
  <key>CFBundleDisplayName</key>
  <string>FDE-X</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>NSUserNotificationAlertStyle</key>
  <string>alert</string>
  <key>NSUserNotificationsUsageDescription</key>
  <string>任务完成时在后台提醒你。</string>
</dict>
</plist>
`
}

function sourceStamp() {
  const hash = createHash('sha256')
  hash.update(readFileSync(SOURCE_SWIFT))
  hash.update(helperPlist())
  return hash.digest('hex')
}

function helperReady(paths) {
  if (!existsSync(paths.bin) || !existsSync(paths.stamp) || !existsSync(SOURCE_SWIFT)) return false
  try {
    return readFileSync(paths.stamp, 'utf8').trim() === sourceStamp()
  } catch {
    return false
  }
}

export function helperBlocked(paths, read = readFileSync) {
  try {
    return String(read(paths.log, 'utf8')).includes('not allowed for this application')
  } catch {
    return false
  }
}

function run(cmd, args, io) {
  const execFileFn = io.execFile || execFile
  const child = execFileFn(cmd, args, { timeout: io.timeout || 40000 }, io.onExit || ((error, _stdout, stderr) => {
    if (error) console.warn('os_notify_exec_failed', cmd, error.message, stderr ? String(stderr).trim() : '')
  }))
  child?.unref?.()
  return child
}

export function buildNotifyHelper(io = {}) {
  if ((io.platform || process.platform) !== 'darwin') return Promise.resolve(null)
  if (!existsSync(SOURCE_SWIFT)) return Promise.resolve(null)
  const paths = io.paths || notifyHelperPaths(io.dshHome)
  if (helperReady(paths)) return Promise.resolve(paths.bin)
  mkdirSync(join(paths.appDir, 'Contents', 'MacOS'), { recursive: true })
  writeFileSync(paths.plist, helperPlist())
  installHelperIcon(paths)
  const execFileFn = io.execFileSync || execFile
  return new Promise((resolve) => {
    execFileFn('xcrun', ['--show-sdk-path'], { timeout: 15000 }, (sdkError, sdkOut) => {
      const sdk = String(sdkOut || '').trim()
      const args = ['swiftc', '-O']
      if (!sdkError && sdk) args.push('-sdk', sdk)
      args.push('-framework', 'Cocoa', '-framework', 'UserNotifications', '-o', paths.bin, SOURCE_SWIFT)
      execFileFn('xcrun', args, { timeout: 120000 }, (error, _stdout, stderr) => {
        if (error) {
          console.warn('os_notify_helper_build_failed', error.message, stderr ? String(stderr).trim() : '')
          resolve(null)
          return
        }
        writeFileSync(paths.stamp, sourceStamp())
        execFileFn('codesign', ['--force', '--sign', '-', paths.appDir], { timeout: 20000 }, () => {
          resolve(paths.bin)
        })
      })
    })
  })
}

export function deliverOsNotify({ title, body } = {}, io = {}) {
  const heading = String(title || 'FDE-X')
  const text = String(body || '')
  const platform = io.platform || process.platform
  if (platform !== 'darwin') return { used: 'none' }
  const exists = io.exists || existsSync
  const paths = io.paths || notifyHelperPaths(io.dshHome)
  const helperBin = io.helperBin || paths.bin
  if (helperBin && exists(helperBin) && paths.appDir && !helperBlocked(paths, io.readFile || readFileSync)) {
    try { writeFileSync(paths.log, '') } catch { /* last.log is diagnostic only */ }
    run('open', ['-n', '-g', '-a', paths.appDir, '--args', heading, text, paths.log], { ...io, timeout: 8000 })
    if (exists(GLASS)) run('afplay', [GLASS], { ...io, timeout: 8000 })
    return { used: 'helper' }
  }
  return { used: 'none' }
}

export function osNotify({ title, body } = {}, io = {}) {
  if (process.env.NODE_TEST_CONTEXT) return
  if (process.env.FDE_OS_NOTIFY === '0') return
  if (process.env.FDE_STATIC_DIR) return
  const result = deliverOsNotify({ title, body }, io)
  if (result.used !== 'helper' && !helperBuild) {
    helperBuild = buildNotifyHelper(io).catch((error) => {
      console.warn('os_notify_helper_build_failed', error)
      return null
    })
  }
  return result
}

export function osNotifyFromEnvelope(type, payload, io = {}) {
  const row = payload && typeof payload === 'object' ? payload : {}
  if (type === 'task.done') {
    const title = String(row.title || '').trim()
    osNotify({ title: 'FDE-X', body: title ? `会话完成：${title}` : '会话任务完成' }, io)
    return
  }
  if (type === 'task.changed' && row.status === 'done') {
    const title = String(row.title || '').trim()
    osNotify({ title: 'FDE-X', body: title ? `任务完成：${title}` : '任务完成' }, io)
    return
  }
  if (type === 'task.due.soon' && gates.taskDueSoonNotify) {
    const title = String(row.title || '').trim()
    osNotify({ title: 'FDE-X', body: title ? `即将到期：${title}` : '任务即将到期' }, io)
    return
  }
  if (type === 'mcp.health.changed' && row.ok === false && gates.mcpDownNotify) {
    const name = String(row.serverName || '').trim()
    osNotify({ title: 'FDE-X', body: name ? `连接器异常：${name}` : '连接器异常' }, io)
  }
}

if (!process.env.NODE_TEST_CONTEXT && process.platform === 'darwin' && process.env.FDE_OS_NOTIFY !== '0' && !process.env.FDE_STATIC_DIR) {
  helperBuild = buildNotifyHelper().catch((error) => {
    console.warn('os_notify_helper_build_failed', error)
    return null
  })
}
