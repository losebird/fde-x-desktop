import { askAiForResult } from '@/lib/ask-ai'
import type { JsonSchemaLite } from '@/lib/json-schema-lite'
import { runtimeApi } from '@/lib/runtime-api'

export type AppAgentJob = {
  rid: string
  preset: string
  prompt: string
  writeBack?: string
}

export type AgentWriteBackPrompt = {
  rid: string
  field: string
  value: unknown
}

function writeBackSchema(field: string): JsonSchemaLite {
  return {
    type: 'object',
    required: [field],
    properties: {
      [field]: {},
    },
  }
}

export async function runAppAgentJobs(
  jobs: AppAgentJob[],
  opts: {
    appName: string
    actionLabel: string
    slug: string
    entity: string
    workspaceCwd: string
    promptWriteBack: (next: AgentWriteBackPrompt) => Promise<boolean>
    onError: (message: string) => void
  },
): Promise<void> {
  for (const job of jobs) {
    const schema = job.writeBack ? writeBackSchema(job.writeBack) : undefined
    const result = await askAiForResult<Record<string, unknown>>({
      intent: `${opts.appName} · ${opts.actionLabel}`,
      preset: job.preset,
      title: `${opts.appName} · ${opts.actionLabel}`,
      context: ['workspace', 'apps'],
      prompt: job.prompt,
      schema,
    })
    if (!result.ok) {
      opts.onError(result.error === 'timeout' ? 'AI 未在时限内返回结果' : result.error)
      return
    }
    if (!job.writeBack) continue
    const value = result.data[job.writeBack]
    const accepted = await opts.promptWriteBack({ rid: job.rid, field: job.writeBack, value })
    if (!accepted) continue
    try {
      await runtimeApi.patchAppRecord(opts.slug, opts.entity, job.rid, opts.workspaceCwd, {
        [job.writeBack]: value,
      })
    } catch (cause) {
      opts.onError(cause instanceof Error ? cause.message : '写入失败')
      return
    }
  }
}

export function isAgentActionStep(data: unknown): data is { step: 'agent'; jobs: AppAgentJob[] } {
  if (!data || typeof data !== 'object') return false
  const row = data as { step?: string; jobs?: unknown }
  return row.step === 'agent' && Array.isArray(row.jobs)
}
