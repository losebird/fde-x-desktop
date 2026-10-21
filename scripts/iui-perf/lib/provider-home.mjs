import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const GROK_ROUTE = 'grok2api'
export const GROK_MODEL = 'grok-4.6'
export const KEY_ENV = 'GROK2API_API_KEY'

export async function writeProviderSettings(home, { baseUrl, api, effort }) {
  await mkdir(home, { recursive: true })
  const efforts = effort
    ? `          reasoningEfforts:
            off: null
            low: low
            medium: medium
            high: high
`
    : ''
  const effortLine = effort ? `  reasoningEffort: ${effort}\n` : ''
  const text = `llm-pi-ai:
  providers:
    ${GROK_ROUTE}:
      displayName: grok2api
      apiKeyEnv: ${KEY_ENV}
      api: ${api}
      baseURL: ${JSON.stringify(baseUrl)}
      models:
        - id: ${GROK_MODEL}
          name: ${GROK_MODEL}
${efforts}agent-default-model:
  provider: ${GROK_ROUTE}
  model: ${GROK_MODEL}
${effortLine}`
  await writeFile(join(home, 'settings.yaml'), text, { mode: 0o600 })
}
