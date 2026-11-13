/** Display names for Host settings schema keys. Forms still generate from the schema. */

const NS_TITLE = {
  'ui-settings-account': '核心问卷',
  'ui-theme': '界面主题',
  locale: '语言',
  iui: 'IUI 交互',
  'session-log-deepseek': '会话日志',
  'agent-default-model': '默认模型',
  'bash-sandbox': '终端沙箱',
  permission: '权限',
  subagent: '子代理',
  'web-search-deepseek': '网页搜索',
  'agent-loop': '代理循环',
  'subagent-model-selection-settings': '子代理模型',
  'dsh-experimental-speech-to-text': '语音输入',
  'speech-to-text': '语音输入',
  'fde-x-dsh-bridge': 'FDE 桥',
}

const FIELD_TITLE = {
  version: '版本',
  step: '步骤',
  purpose: '用途',
  process: '流程',
  completion: '完成方式',
  usage: '用量说明',
  preference: '偏好',
  fontSize: '字号',
  themeId: '主题编号',
  fenceFeedback: '围栏反馈',
  formatReferee: '格式裁判',
  customTokensJson: '自定义 token（JSON）',
  userTemplatesJson: '用户模板（JSON）',
  jevEnabled: '启用 JEV',
  jevApiKey: 'JEV API 密钥',
  jevBaseUrl: 'JEV 地址',
  jevModel: 'JEV 模型',
  structuredOutputsMode: '结构化输出',
  structuredOutputsProbeUrl: '结构化探测地址',
  structuredOutputsProbeKey: '结构化探测密钥',
  developerTools: '开发者工具',
  reasoningEffort: '推理力度',
  standardDenyServers: '默认拒绝的连接器',
  enabled: '启用',
  cwd: '工作目录',
  timeoutMs: '超时（毫秒）',
  maxTimeoutMs: '最长超时（毫秒）',
  maxOutputBytes: '输出上限',
  maxSpillBytes: '溢出上限',
  graceMs: '宽限（毫秒）',
  defaultPreset: '默认预设',
}

const FIELD_TITLE_BY_NS = {
  'ui-theme.preference': '主题',
  'locale.preference': '语言',
  'ui-settings-account.developerTools': '开发者工具',
  'ui-settings-account.version': '向导版本',
  'ui-settings-account.step': '入门走到哪',
  'ui-settings-account.purpose': '主要用来干什么',
  'ui-settings-account.process': '助手怎么配合',
  'ui-settings-account.completion': '入门完成情况',
  'ui-settings-account.usage': '用量提示详细程度',
}

const OPTION_LABEL = {
  welcome: '欢迎',
  credit: '用量',
  purpose: '用途',
  process: '配合',
  done: '完成',
  office: '业务办公',
  development: '工程开发',
  both: '两项都用',
  null: '未选',
  compact: '少问多做',
  standard: '先对齐再做',
  detailed: '逐步确认',
  completed: '已完成',
  skipped: '已跳过',
  'api-key': '已配密钥',
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
  off: '关',
  auto: '自动',
  prefer: '优先',
}

function isIdent(text) {
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(String(text || '').trim())
}

export function settingsNsTitle(ns, fallback) {
  const id = String(ns || '').trim()
  if (NS_TITLE[id]) return NS_TITLE[id]
  const text = String(fallback || '').trim()
  if (NS_TITLE[text]) return NS_TITLE[text]
  return text || id
}

export function settingsFieldTitle(ns, name, hostTitle) {
  const key = String(name || '').trim()
  const fromHost = String(hostTitle || '').trim()
  if (fromHost && fromHost !== key && !isIdent(fromHost)) return fromHost
  const scoped = FIELD_TITLE_BY_NS[`${String(ns || '').trim()}.${key}`]
  if (scoped) return scoped
  if (FIELD_TITLE[key]) return FIELD_TITLE[key]
  return fromHost || key
}

export function settingsOptionLabel(value) {
  if (value === null || value === undefined) return OPTION_LABEL.null
  const key = String(value)
  if (Object.prototype.hasOwnProperty.call(OPTION_LABEL, key)) return OPTION_LABEL[key]
  return key
}
