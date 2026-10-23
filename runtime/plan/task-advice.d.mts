type SchemaNode = {
  type?: string
  required?: string[]
  enum?: string[]
  properties?: Record<string, SchemaNode>
  items?: SchemaNode
}

export const taskAdviceSchema: SchemaNode

export function organizeAdvicePrompt(): string

export function formatTaskLine(task: {
  id?: string
  title?: string
  status?: string
  priority?: string
  dueAt?: string | null
  due?: string | null
}): string

export type TaskAdviceSuggestion =
  | { op: 'archive'; taskId: string; reason: string }
  | { op: 'merge'; taskId: string; mergeInto: string; reason: string }
  | {
      op: 'update'
      taskId: string
      reason: string
      patch: {
        title?: string
        notes?: string
        status?: 'todo' | 'doing' | 'done' | 'archived'
        priority?: 'urgent' | 'high' | 'med' | 'low'
        dueAt?: string | null
        tags?: string[]
      }
    }

export function parseTaskAdvice(
  raw: unknown,
  tasks: ReadonlyArray<{ id?: string } | null | undefined> | null | undefined,
): {
  accepted: TaskAdviceSuggestion[]
  rejected: { index: number; reason: string }[]
  summary: string
}

export function describeAdvice(suggestion: {
  op?: string
  mergeInto?: string
  patch?: {
    title?: string
    notes?: string
    status?: string
    priority?: string
    dueAt?: string | null
    tags?: string[]
  }
}): string
