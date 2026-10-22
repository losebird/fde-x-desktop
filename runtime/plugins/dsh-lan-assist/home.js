/**
 * Plugin home under $DSH_HOME. Uninstall does not delete this directory.
 * @module dsh-lan-assist/home
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

export const PLUGIN = 'dsh-lan-assist'
export const DEFAULT_LAN_PORT = 9527
export const CODE_TTL_MS = 10 * 60 * 1000
export const CODE_MAX_GUESSES = 5
export const ATTACH_MAX_BYTES = 200 * 1024 * 1024
export const ATTACH_TOTAL_BYTES = 500 * 1024 * 1024
export const BODY_MAX_BYTES = 700 * 1024 * 1024
export const RETRY_STEPS_MS = [30_000, 2 * 60_000, 10 * 60_000]
export const FAIL_AFTER_MS = 7 * 24 * 60 * 60 * 1000
export const EXPIRE_AFTER_MS = 14 * 24 * 60 * 60 * 1000
export const LOST_HOLD_MS = 48 * 60 * 60 * 1000
export const CHASE_AFTER_MS = 24 * 60 * 60 * 1000
export const LEDGER_KEEP_MS = 90 * 24 * 60 * 60 * 1000
export const SLEEP_GAP_MS = 2 * 60 * 1000
export const ONLINE_AFTER_MS = 90 * 1000
export const WITHDRAW_GRACE_MS = 2 * 60 * 1000
export const FOCUS_TTL_MS = 10 * 60 * 1000
export const OPENING_TTL_MS = 90 * 1000
export const PAIR_HELLO_MS = 8_000
export const LAN_PROBE_MS = 2_000
export const RELAY_INLINE_MAX = 256 * 1024
export const RELAY_OBJECT_QUOTA = 1024 * 1024 * 1024

export function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

export function assistHome(root = dshHome()) {
  return join(root, 'lan-assist')
}
