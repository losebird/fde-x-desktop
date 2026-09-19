const SURFACE_DEFAULT = `工作面 layout（surface，必填）：按需求写栏目怎么排、密度、主操作在哪。用户没提 layout 时用默认：
\`\`\`json
"surface": {
  "nav": "tabs",
  "density": "cozy",
  "cards": { "minWidth": "regular", "hero": "cover" },
  "ledger": { "composeChart": "pair", "feed": "rows" },
  "primary": { "where": "card", "kind": "play" }
}
\`\`\`
枚举：nav tabs|stack；density air|cozy|packed；cards.minWidth narrow|regular|wide；cards.hero cover|below；cards.columns 1-6；ledger.composeChart pair|stack；ledger.feed rows|full；primary.where card|compose|chrome；primary.kind play|open|compose。`

const PAGES_RULES = `每个对象单独一栏 pages；有链接/视频字段 → 分组 cards + compose，行动打开或播放；有数字或日期台账 → 同一栏 stats+compose+chart+feed。不要永远同一套脚手架换列名。`

const USES_RULES = `uses 只声明真正要用的平台能力：问数/起草写 ai，并排用写 float，稿和附件走文件模块写 files，动作只起草记忆卡片写 memory，拟回进 IM 输入框写 im，早报/MCP 源写 briefing，引用业务对象并预览确认写 biz，摘成待办写 plan（须能写入 plan 任务）。没接到的不要写，前端不会画假按钮。`

const TITLE_RULES = `titleField 必须是人能读的业务名（名称/标题），禁止用单号或自动编号填标题。`

const COMMON_TAIL = `若返回 errors，修正后重新提交。不要写外部业务系统除非用户已接业务。禁止套固定品类模板。`

function dataPlacementBlock(dataHint?: string): string {
  if (dataHint?.trim()) return dataHint.trim()
  return '数据放哪：本地 SQLite 台账。不要默认铺满 uses，没点名的能力不要写进 uses。'
}

export function appBuilderPrompt(input: {
  mode: 'create' | 'revise'
  description: string
  dataHint?: string
  appId?: string
  currentSpecJson?: string
}): string {
  const { mode, description, dataHint, appId, currentSpecJson } = input
  const dataBlock = dataPlacementBlock(dataHint)

  if (mode === 'create') {
    return [
      `需求：${description.trim()}`,
      dataBlock,
      SURFACE_DEFAULT,
      `请生成 fde-app/v1 spec（含 surface、pages、uses 与被引用的 views），并调用 fde_app_spec_submit({ requestId, spec })，不要传 appId。`,
      PAGES_RULES,
      TITLE_RULES,
      USES_RULES,
      COMMON_TAIL,
    ].join('\n')
  }

  const id = appId?.trim() || ''
  const specJson = currentSpecJson?.trim() || ''
  return [
    `修订需求：${description.trim()}`,
    id ? `appId：${id}` : '',
    specJson ? `当前 spec JSON：\n${specJson}` : '',
    dataBlock,
    SURFACE_DEFAULT,
    `输出完整下一版 spec（fde-app/v1）：保持 slug 不变；不要删字段、不要改已有字段类型；按新需求更新 surface、pages、views、labels、uses。`,
    PAGES_RULES,
    TITLE_RULES,
    USES_RULES,
    id
      ? `调用 fde_app_spec_submit({ requestId, spec, appId: "${id}" }) 提交修订。`
      : '调用 fde_app_spec_submit({ requestId, spec, appId }) 提交修订（appId 见上）。',
    COMMON_TAIL,
  ].filter(Boolean).join('\n')
}
