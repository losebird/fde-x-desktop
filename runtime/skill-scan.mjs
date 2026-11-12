import { execFile } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const PATTERNS = [
  { id: 'eval', severity: 'high', re: /\beval\s*\(/, title: '动态执行 eval' },
  { id: 'exec', severity: 'high', re: /\bexec\s*\(|child_process|subprocess|os\.system\s*\(/, title: '拉起子进程' },
  { id: 'shell-pipe', severity: 'critical', re: /curl\s+[^|\n]{0,80}\|\s*(?:sh|bash)|wget\s+[^|\n]{0,80}\|\s*(?:sh|bash)/i, title: '下载后直接执行' },
  { id: 'ssh', severity: 'high', re: /\.ssh\/|id_rsa|authorized_keys/, title: '触及 SSH 密钥' },
  { id: 'env-harvest', severity: 'high', re: /process\.env|os\.environ|API_KEY|SECRET_KEY|IMAP_PASS/, title: '读取环境变量或密钥名' },
  { id: 'exfil', severity: 'critical', re: /webhook\.site|ngrok\.io|pastebin\.com|discord\.com\/api\/webhooks/i, title: '外传通道' },
  { id: 'hidden-instr', severity: 'medium', re: /ignore (?:all )?previous|hidden instruction|do not tell the user/i, title: '隐藏指令' },
  { id: 'obfuscation', severity: 'medium', re: /String\.fromCharCode|atob\(|Buffer\.from\([^)]+,\s*['"]base64['"]/, title: '混淆或解码载荷' },
]

const WEIGHT = { critical: 40, high: 20, medium: 10, low: 4 }

async function walkFiles(root, acc = [], depth = 0) {
  if (depth > 6) return acc
  let rows = []
  try {
    rows = await readdir(root, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const row of rows) {
    if (row.name === '.git' || row.name === 'node_modules') continue
    const abs = join(root, row.name)
    if (row.isDirectory()) {
      await walkFiles(abs, acc, depth + 1)
      continue
    }
    if (!row.isFile()) continue
    if (!/\.(md|mjs|js|cjs|ts|py|sh|bash|zsh|ps1|rb)$/i.test(row.name) && row.name.toUpperCase() !== 'SKILL.MD') continue
    acc.push(abs)
  }
  return acc
}

export function scoreSkillFindings(findings, { executable = false } = {}) {
  let score = 0
  for (const row of Array.isArray(findings) ? findings : []) {
    score += WEIGHT[row.severity] || 4
  }
  if (executable) score = Math.round(score * 1.3)
  if (score > 100) score = 100
  const verdict = score >= 50 ? 'do-not-install' : score >= 25 ? 'review' : 'ok'
  return { score, verdict }
}

export function scanSkillText(rel, text) {
  const findings = []
  const body = String(text || '')
  for (const rule of PATTERNS) {
    if (rule.re.test(body)) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        title: rule.title,
        file: rel,
      })
    }
  }
  return findings
}

async function scanWithCli(root) {
  try {
    const { stdout } = await execFileAsync('skillspector', [root, '--json'], { timeout: 45_000 })
    const parsed = JSON.parse(String(stdout || '{}'))
    const findings = Array.isArray(parsed.findings) ? parsed.findings : []
    const score = Number(parsed.score)
    const verdict = String(parsed.verdict || parsed.recommendation || '').trim()
    return {
      engine: 'skillspector',
      findings,
      score: Number.isFinite(score) ? score : scoreSkillFindings(findings).score,
      verdict: verdict || scoreSkillFindings(findings).verdict,
    }
  } catch {
    return null
  }
}

export async function scanSkillPack(root) {
  const cli = await scanWithCli(root)
  if (cli) return cli
  const files = await walkFiles(root)
  const findings = []
  let executable = false
  for (const abs of files) {
    const rel = abs.slice(root.length).replace(/^[/\\]/, '')
    if (/\.(py|sh|bash|zsh|ps1|mjs|js|cjs)$/i.test(rel)) executable = true
    let text = ''
    try {
      const info = await stat(abs)
      if (info.size > 512 * 1024) continue
      text = await readFile(abs, 'utf8')
    } catch {
      continue
    }
    findings.push(...scanSkillText(rel, text))
  }
  const scored = scoreSkillFindings(findings, { executable })
  return {
    engine: 'skillspector-static',
    findings,
    score: scored.score,
    verdict: scored.verdict,
  }
}

export function scanAdvice(scan) {
  if (!scan) return '扫描未完成。'
  if (scan.verdict === 'do-not-install') return '风险较高，建议不要安装。若你确认来源可信，仍可继续。'
  if (scan.verdict === 'review') return '有需要留意的项。请看过再决定是否安装。'
  if ((scan.findings || []).length) return '有提示项，整体可装。'
  return '未发现明显风险。'
}
