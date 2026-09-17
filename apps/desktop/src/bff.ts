import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

export type BffEnv = Record<string, string | undefined>

export async function spawnBff(
  serverEntry: string,
  env: BffEnv,
  electronNode: string,
): Promise<{ child: ChildProcess; port: number }> {
  const child = spawn(electronNode, [serverEntry], {
    env: { ...process.env, ...env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  const port = await new Promise<number>((resolve, reject) => {
    const rl = createInterface({ input: child.stdout })
    let stderr = ''
    let settled = false
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    const timeout = setTimeout(() => {
      if (settled) return
      settled = true
      rl.close()
      reject(new Error(`BFF 未在时限内输出 FDE_LISTENING：${stderr}`))
    }, 120_000)

    rl.on('line', (line) => {
      const match = /^FDE_LISTENING\s+(\d+)/u.exec(line.trim())
      if (match && !settled) {
        settled = true
        clearTimeout(timeout)
        rl.close()
        resolve(Number(match[1]))
      }
    })
    child.once('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(new Error(`BFF 提前退出 code=${code} stderr=${stderr}`))
    })
  })

  return { child, port }
}

export function serverEntryForApp(appRoot: string): string {
  return join(appRoot, 'runtime', 'server.mjs')
}
