#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const desktopRoot = join(here, '..')
const repoRoot = join(here, '../../..')
const destRoot = process.argv[2]
  ? join(process.argv[2], 'FDE-X Notify.app')
  : join(desktopRoot, 'build', 'notify-helper', 'FDE-X Notify.app')
const swift = join(repoRoot, 'runtime', 'os-notify-helper.swift')
const icon = existsSync('/Applications/FDE-X.app/Contents/Resources/icon.icns')
  ? '/Applications/FDE-X.app/Contents/Resources/icon.icns'
  : join(desktopRoot, 'build', 'icon.icns')
const bin = join(destRoot, 'Contents', 'MacOS', 'notify')
const resources = join(destRoot, 'Contents', 'Resources')

mkdirSync(join(destRoot, 'Contents', 'MacOS'), { recursive: true })
mkdirSync(resources, { recursive: true })
writeFileSync(join(destRoot, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>notify</string>
  <key>CFBundleIdentifier</key>
  <string>com.fde-x.workstation.notify</string>
  <key>CFBundleName</key>
  <string>FDE-X</string>
  <key>CFBundleDisplayName</key>
  <string>FDE-X</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSUserNotificationAlertStyle</key>
  <string>alert</string>
  <key>NSUserNotificationsUsageDescription</key>
  <string>任务完成时在后台提醒你。</string>
</dict>
</plist>
`)
if (existsSync(icon)) copyFileSync(icon, join(resources, 'AppIcon.icns'))
else if (existsSync(join(desktopRoot, 'build', 'icon.png'))) {
  copyFileSync(join(desktopRoot, 'build', 'icon.png'), join(resources, 'AppIcon.png'))
}
const sdk = String(execFileSync('xcrun', ['--show-sdk-path'], { encoding: 'utf8' })).trim()
const args = ['swiftc', '-O']
if (sdk) args.push('-sdk', sdk)
args.push('-framework', 'Cocoa', '-framework', 'UserNotifications', '-o', bin, swift)
execFileSync('xcrun', args, { stdio: 'inherit' })
execFileSync('codesign', ['--force', '--sign', '-', '--identifier', 'com.fde-x.workstation.notify', destRoot], { stdio: 'inherit' })
console.log(destRoot)
