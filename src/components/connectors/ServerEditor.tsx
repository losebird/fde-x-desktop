import { SurfaceBanner, SurfaceButton, SurfaceDialog, SurfaceField, SurfaceInput, SurfaceSegmented, SurfaceTextarea } from '@/components/surface'
import { TemplatePicker } from '@/components/connectors/TemplatePicker'
import type { DraftErrors, McpDraft } from '@/components/connectors/draft'
import type { McpDiscoverRow, McpRecipe } from '@/lib/runtime-api'

export function ServerEditor({
  open,
  editing,
  draft,
  errors,
  recipes,
  discovered,
  probeNote,
  probeOk,
  saveNote,
  saving,
  hostConnected,
  onOpenChange,
  onChange,
  onRecipe,
  onDiscover,
  onTest,
  onSave,
}: {
  open: boolean
  editing: string
  draft: McpDraft
  errors: DraftErrors
  recipes: McpRecipe[]
  discovered: McpDiscoverRow[]
  probeNote: string
  probeOk: boolean | null
  saveNote: string
  saving: boolean
  hostConnected: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<McpDraft>) => void
  onRecipe: (recipe: McpRecipe) => void
  onDiscover: (row: McpDiscoverRow) => void
  onTest: () => void
  onSave: () => void
}) {
  const recipe = recipes.find((row) => row.id === draft.recipeId)
  const fields = recipe?.fields || []
  return (
    <SurfaceDialog open={open} onOpenChange={onOpenChange} wide title={editing ? '编辑连接器' : '添加连接器'}>
      <div className="space-y-3">
        {!editing ? (
          <TemplatePicker
            recipes={recipes}
            discovered={discovered}
            recipeId={draft.recipeId}
            draftName={draft.name}
            onRecipe={onRecipe}
            onDiscover={onDiscover}
          />
        ) : null}
        <SurfaceField label="名称" error={errors.name} hint="只能用字母、数字、- 和 _，最多 32 个字。">
          <SurfaceInput
            aria-label="名称"
            value={editing || draft.name}
            disabled={Boolean(editing)}
            aria-invalid={Boolean(errors.name)}
            onChange={(event) => onChange({ name: event.target.value })}
          />
        </SurfaceField>
        <div>
          <div className="mb-1.5 text-kit-sm font-medium text-kit-ink">连接方式</div>
          <SurfaceSegmented
            label="连接方式"
            value={draft.transport}
            onChange={(transport) => onChange({ transport })}
            options={[
              { id: 'stdio', label: '本机命令' },
              { id: 'streamable-http', label: '网络地址' },
            ]}
          />
        </div>
        {draft.transport === 'stdio' ? (
          <>
            {fields.filter((field) => field.key !== 'url').map((field) => (
              <SurfaceField key={field.key} label={field.label}>
                <SurfaceInput
                  aria-label={field.label}
                  type={field.secret ? 'password' : 'text'}
                  value={draft.fieldValues[field.key] || ''}
                  onChange={(event) => onChange({ fieldValues: { ...draft.fieldValues, [field.key]: event.target.value } })}
                />
              </SurfaceField>
            ))}
            <SurfaceField label="启动命令" error={errors.command}>
              <SurfaceInput
                aria-label="启动命令"
                className="font-mono"
                value={draft.command}
                aria-invalid={Boolean(errors.command)}
                onChange={(event) => onChange({ command: event.target.value })}
              />
            </SurfaceField>
            <SurfaceField label="参数" hint="一行一个。">
              <SurfaceTextarea aria-label="参数" className="font-mono" rows={3} value={draft.args} onChange={(event) => onChange({ args: event.target.value })} />
            </SurfaceField>
            <SurfaceField label="环境变量" error={errors.env} hint="每行写成 名称=值。">
              <SurfaceTextarea aria-label="环境变量" className="font-mono" rows={4} value={draft.env} aria-invalid={Boolean(errors.env)} onChange={(event) => onChange({ env: event.target.value })} />
            </SurfaceField>
          </>
        ) : (
          <>
            <SurfaceField label="地址" error={errors.url}>
              <SurfaceInput
                aria-label="地址"
                className="font-mono"
                value={draft.fieldValues.url || draft.url}
                aria-invalid={Boolean(errors.url)}
                onChange={(event) => onChange({
                  url: event.target.value,
                  fieldValues: { ...draft.fieldValues, url: event.target.value },
                })}
              />
            </SurfaceField>
            <SurfaceField label="请求头" error={errors.headers} hint="每行写成 名称: 值。">
              <SurfaceTextarea aria-label="请求头" className="font-mono" rows={3} value={draft.headers} aria-invalid={Boolean(errors.headers)} onChange={(event) => onChange({ headers: event.target.value })} />
            </SurfaceField>
          </>
        )}
        <SurfaceBanner tone={hostConnected ? 'quiet' : 'warn'}>
          {hostConnected ? '保存后，已接通的核心会自己更新。' : '核心还没接通。保存会先写入档案，接通后再生效。'}
        </SurfaceBanner>
        {probeNote ? <SurfaceBanner tone={probeOk ? 'info' : 'danger'}>{probeNote}</SurfaceBanner> : null}
        {saveNote ? <SurfaceBanner tone="danger">{saveNote}</SurfaceBanner> : null}
        <div className="flex justify-end gap-2 pt-1">
          <SurfaceButton onClick={onTest} disabled={saving}>测试连接</SurfaceButton>
          <SurfaceButton onClick={() => onOpenChange(false)}>取消</SurfaceButton>
          <SurfaceButton variant="primary" onClick={onSave} disabled={saving}>{saving ? '保存中' : '保存'}</SurfaceButton>
        </div>
      </div>
    </SurfaceDialog>
  )
}
