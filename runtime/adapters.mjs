import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const checkedAt = () => new Date().toISOString()

async function pathExists(path) {
  if (!path) return false
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function inspectAdapters({ aiRuntime } = {}) {
  const dshBin = process.env.FDE_DSH_BIN
  const dshHome = aiRuntime?.dshHome || process.env.FDE_DSH_HOME || join(homedir(), '.dsh-fde-x')
  const profileName = process.env.FDE_DSH_PROFILE || 'fde-x'
  const profileModules = join(dshHome, 'profiles', profileName, 'node_modules')
  const definitions = [
    {
      capability: 'ai-runtime',
      paths: dshBin ? [dshBin] : [],
      detail: '核心 AI、文件、工具、MCP、Skills 与自动化适配入口',
    },
    {
      capability: 'im-business-adapter',
      paths: [join(profileModules, 'dsh-lan-assist')],
      detail: 'IM 与业务系统操作能力的防腐适配入口',
    },
    {
      capability: 'semantic-memory',
      paths: [join(profileModules, 'dsh-semantic-os')],
      detail: '保留 FalkorDB/FalkorDBLite 与语义索引，不迁入事务 SQLite',
    },
  ]

  return Promise.all(definitions.map(async (definition) => {
    const availability = await Promise.all(definition.paths.map(pathExists))
    const available = definition.paths.length > 0 && availability.every(Boolean)
    if (definition.capability === 'ai-runtime' && aiRuntime) {
      const status = aiRuntime.status()
      if (status.connected) {
        return {
          capability: definition.capability,
          state: 'healthy',
          version: status.version,
          detail: `核心 AI 运行时已接通；进程 ${status.pid ?? '未知'}，会话凭据仅保留在本地运行时内存中`,
          checkedAt: checkedAt(),
        }
      }
      if (status.state === 'starting') {
        return {
          capability: definition.capability,
          state: 'degraded',
          version: status.version,
          detail: '核心 AI 运行时正在受控启动和认证',
          checkedAt: checkedAt(),
        }
      }
      if (status.state === 'error') {
        return {
          capability: definition.capability,
          state: 'unavailable',
          version: status.version,
          detail: `核心 AI 运行时连接失败：${status.lastError ?? '未知错误'}`,
          checkedAt: checkedAt(),
        }
      }
    }
    if (definition.capability === 'semantic-memory' && aiRuntime && typeof aiRuntime.semanticOs === 'function' && aiRuntime.status?.().connected) {
      try {
        const ready = await aiRuntime.semanticOs('/ready', { method: 'GET' })
        if (ready && ready.ready) {
          return {
            capability: definition.capability,
            state: 'healthy',
            detail: ready.port ? `语义引擎就绪（127.0.0.1:${ready.port}）` : '语义引擎就绪',
            checkedAt: checkedAt(),
          }
        }
        return {
          capability: definition.capability,
          state: 'degraded',
          detail: `语义引擎未就绪：${ready?.doctor || ready?.detail || ready?.reason || '未知'}`,
          checkedAt: checkedAt(),
        }
      } catch (error) {
        return {
          capability: definition.capability,
          state: 'degraded',
          detail: `语义引擎未接通：${error instanceof Error ? error.message : String(error)}`,
          checkedAt: checkedAt(),
        }
      }
    }
    return {
      capability: definition.capability,
      state: available ? 'degraded' : 'unavailable',
      detail: available
        ? `${definition.detail}；插件已安装，运行时调用尚未接通`
        : `${definition.detail}；未发现本机安装`,
      checkedAt: checkedAt(),
    }
  }))
}
