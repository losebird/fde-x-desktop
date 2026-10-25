import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const CANCEL_PROVENANCE_PATCHES = [
  {
    file: `@deepseek-ai/dsh-api-session-controller/lib/index.js`,
    prev: `		agent.cancel({ kind: "user" }, { keepInbox: true });`,
    next: `		agent.cancel({ kind: "user", source: "session/cancel", keepInbox: true }, { keepInbox: true });`,
  },
  {
    file: `@deepseek-ai/dsh-api-session-controller/lib/types/commands.js`,
    prev: `        agent.cancel({ kind: 'user' }, { keepInbox: true });`,
    next: `        agent.cancel({ kind: 'user', source: 'session/cancel', keepInbox: true }, { keepInbox: true });`,
  },
  {
    file: `@deepseek-ai/dsh-agent/lib/index.js`,
    prev: `		if (agent?.status === "running") agent.cancel({ kind: "user" });`,
    next: `		if (agent?.status === "running") agent.cancel({ kind: "user", source: "archive-stop", keepInbox: false }, { keepInbox: false });`,
  },
  {
    file: `@deepseek-ai/dsh-agent/lib/types/archive-admission.js`,
    prev: `            agent.cancel({ kind: 'user' });`,
    next: `            agent.cancel({ kind: 'user', source: 'archive-stop', keepInbox: false }, { keepInbox: false });`,
  },
  {
    file: `@deepseek-ai/dsh-acp/lib/index.js`,
    prev: `		if (inflight === void 0) this.agent.cancel({ kind: "user" });`,
    next: `		if (inflight === void 0) this.agent.cancel({ kind: "user", source: "acp", keepInbox: false }, { keepInbox: false });`,
  },
  {
    file: `@deepseek-ai/dsh-acp/lib/index.js`,
    prev: `			if (inflight === void 0 || !inflight.messageQueued) this.agent.cancel({ kind: "user" });`,
    next: `			if (inflight === void 0 || !inflight.messageQueued) this.agent.cancel({ kind: "user", source: "acp", keepInbox: false }, { keepInbox: false });`,
  },
  {
    file: `@deepseek-ai/dsh-acp/lib/index.js`,
    prev: `		if (inflight.messageQueued) this.agent.cancel({ kind: "user" });`,
    next: `		if (inflight.messageQueued) this.agent.cancel({ kind: "user", source: "acp", keepInbox: false }, { keepInbox: false });`,
  },
  {
    file: `@deepseek-ai/dsh-goal-round-driver/lib/index.js`,
    prev: `			if (change.operation === "pause" && agent.status === "running" && ctx.agents.currentInitiator() !== agent) agent.cancel({ kind: "user" }, { keepInbox: true });`,
    next: `			if (change.operation === "pause" && agent.status === "running" && ctx.agents.currentInitiator() !== agent) agent.cancel({ kind: "user", source: "goal-pause", keepInbox: true }, { keepInbox: true });`,
  },
  {
    file: `@deepseek-ai/dsh-agent-loop/lib/index.js`,
    prev: `		case "user":
		case "parent":
		case "disposed": return { kind: cause.kind };`,
    next: `		case "user": {
			const copied = { kind: "user" };
			if (typeof cause.source === "string" && cause.source) copied.source = cause.source;
			if (typeof cause.keepInbox === "boolean") copied.keepInbox = cause.keepInbox;
			return copied;
		}
		case "parent":
		case "disposed": return { kind: cause.kind };`,
  },
]

function occurrences(text, needle) {
  let count = 0
  let from = 0
  while (from <= text.length) {
    const at = text.indexOf(needle, from)
    if (at < 0) return count
    count += 1
    from = at + needle.length
  }
  return count
}

export function applyCancelProvenance(installRoot) {
  const root = join(String(installRoot || ''), 'node_modules')
  const results = []
  for (const patch of CANCEL_PROVENANCE_PATCHES) {
    const abs = join(root, patch.file)
    if (!existsSync(abs)) {
      results.push({ file: patch.file, status: 'absent' })
      continue
    }
    const text = readFileSync(abs, 'utf8')
    const count = occurrences(text, patch.prev)
    if (text.includes(patch.next) && count === 0) {
      results.push({ file: patch.file, status: 'already' })
      continue
    }
    if (count !== 1) {
      const error = new Error(`cancel provenance ${patch.file} matched ${count}`)
      error.code = 'CANCEL_PROVENANCE'
      throw error
    }
    writeFileSync(abs, text.replace(patch.prev, patch.next))
    results.push({ file: patch.file, status: 'patched' })
  }
  return results
}
