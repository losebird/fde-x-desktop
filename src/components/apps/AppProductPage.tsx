import { useState } from 'react'
import clsx from 'clsx'
import { AppCapabilityBar } from '@/components/apps/AppCapabilityBar'
import { SpecCards } from '@/components/apps/SpecCards'
import { SpecChart } from '@/components/apps/SpecChart'
import { SpecFeed } from '@/components/apps/SpecFeed'
import { SpecForm } from '@/components/apps/SpecForm'
import { SpecKanban } from '@/components/apps/SpecKanban'
import { SpecStat } from '@/components/apps/SpecStat'
import { SpecTable } from '@/components/apps/SpecTable'
import {
  declaredPlatformUses,
  mockRowsForEntity,
  pageColumnUses,
  pageLooksLikeLedger,
  viewById,
  visibleWorkSurfaceBlocks,
  workSurfacePages,
  type FdeAppDetail,
  type FdeAppPage,
  type FdeAppView,
  type FdePlatformUse,
} from '@/lib/app-spec'

type Props = {
  app: FdeAppDetail
  workspaceCwd: string
  onRefresh: () => void
}

export function AppProductPage({ app, workspaceCwd, onRefresh }: Props) {
  const { pages, extraViews } = workSurfacePages(app.spec)
  const [pageId, setPageId] = useState(pages[0]?.id || '')
  const [reloadToken, setReloadToken] = useState(0)
  const page = pages.find((row) => row.id === pageId) || pages[0]
  const preview = app.status !== 'active'

  const refresh = () => {
    setReloadToken((value) => value + 1)
    onRefresh()
  }

  if (!page) return null
  const pageEntity = pageEntityName(app.spec, page, extraViews)
  const columnUses = pageColumnUses(app.spec, pageEntity)
  const hasCompose = page.blocks.some((block) => block.kind === 'compose' || block.kind === 'form')

  return (
    <div
      className="space-y-4"
      data-app-product="true"
      data-app-uses={declaredPlatformUses(app.spec).join(',')}
    >
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line">
        <div className="flex items-center gap-1" data-app-product-nav="true">
          {pages.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setPageId(row.id)}
              className={clsx(
                'h-9 px-3 text-sm -mb-px border-b-2 transition-colors',
                row.id === page.id
                  ? 'border-brand text-ink font-medium'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {row.label || row.id}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4" data-app-ledger={pageLooksLikeLedger(page) ? 'true' : undefined}>
        {renderBlocks(visibleWorkSurfaceBlocks(page)).map((group, index) => (
          <div
            key={`${page.id}-g-${index}`}
            className={group.pair ? 'grid grid-cols-1 xl:grid-cols-2 gap-3 items-start' : undefined}
            data-app-compose-chart={group.pair ? 'true' : undefined}
          >
            {group.blocks.map((block, blockIndex) => (
              <ProductBlock
                key={`${page.id}-${block.kind}-${index}-${blockIndex}`}
                app={app}
                workspaceCwd={workspaceCwd}
                preview={preview}
                reloadToken={reloadToken}
                onRefresh={refresh}
                view={'view' in block ? viewById(app.spec, block.view, extraViews) : undefined}
                statViews={block.kind === 'stats' ? block.views.map((id) => viewById(app.spec, id, extraViews)).filter((row): row is FdeAppView => Boolean(row)) : []}
                kind={block.kind}
                capabilityUses={
                  block.kind === 'compose' || block.kind === 'form'
                    ? columnUses
                    : block.kind === 'cards' && !hasCompose
                      ? columnUses
                      : []
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function pageEntityName(spec: FdeAppDetail['spec'], page: FdeAppPage, extraViews: FdeAppView[]): string {
  for (const block of page.blocks) {
    if (block.kind === 'stats') continue
    const view = 'view' in block ? viewById(spec, block.view, extraViews) : undefined
    if (view?.entity) return view.entity
  }
  for (const block of page.blocks) {
    if (block.kind !== 'stats') continue
    const view = viewById(spec, block.views[0], extraViews)
    if (view?.entity) return view.entity
  }
  return spec.entities[0]?.name || ''
}

function renderBlocks(blocks: FdeAppPage['blocks']): { pair: boolean; blocks: FdeAppPage['blocks'] }[] {
  const groups: { pair: boolean; blocks: FdeAppPage['blocks'] }[] = []
  for (let i = 0; i < blocks.length; i++) {
    const current = blocks[i]
    const next = blocks[i + 1]
    const compose = current.kind === 'compose' || current.kind === 'form'
    if (compose && next?.kind === 'chart') {
      groups.push({ pair: true, blocks: [current, next] })
      i += 1
      continue
    }
    groups.push({ pair: false, blocks: [current] })
  }
  return groups
}

function ProductBlock({
  app, workspaceCwd, preview, reloadToken, onRefresh, view, statViews, kind, capabilityUses,
}: {
  app: FdeAppDetail
  workspaceCwd: string
  preview: boolean
  reloadToken: number
  onRefresh: () => void
  view?: FdeAppView
  statViews: FdeAppView[]
  kind: FdeAppPage['blocks'][number]['kind']
  capabilityUses: FdePlatformUse[]
}) {
  if (kind === 'stats') {
    return (
      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-3" data-app-overview="true">
        {statViews.map((stat) => (
          <SpecStat
            key={stat.id || stat.label}
            app={app}
            view={stat}
            workspaceCwd={workspaceCwd}
            previewRows={preview ? mockRowsForEntity(app.spec, stat.entity) : undefined}
            variant="tile"
          />
        ))}
      </div>
    )
  }
  if (!view) return null
  const previewRows = preview ? mockRowsForEntity(app.spec, view.entity) : undefined
  if (kind === 'compose' || kind === 'form') {
    return (
      <div className="border border-line rounded-xl bg-surface p-4 space-y-3 min-w-0">
        <div className="text-sm font-medium">{view.label || '记下'}</div>
        <SpecForm
          app={app}
          entity={view.entity}
          workspaceCwd={workspaceCwd}
          readOnly={app.status !== 'active'}
          layout="compose"
          submitLabel={view.label}
          onDone={onRefresh}
          renderSubmit={capabilityUses.length ? (submitButton) => (
            <AppCapabilityBar spec={app.spec} appId={app.id} uses={capabilityUses} primary={submitButton} />
          ) : undefined}
        />
      </div>
    )
  }
  if (kind === 'chart') {
    return <SpecChart app={app} view={view} workspaceCwd={workspaceCwd} previewRows={previewRows} reloadToken={reloadToken} />
  }
  if (kind === 'feed') {
    return <SpecFeed app={app} view={view} workspaceCwd={workspaceCwd} previewRows={previewRows} reloadToken={reloadToken} />
  }
  if (kind === 'cards') {
    return (
      <SpecCards
        app={app}
        view={view}
        workspaceCwd={workspaceCwd}
        previewRows={previewRows}
        reloadToken={reloadToken}
        recordActions={capabilityUses.length ? (
          <AppCapabilityBar spec={app.spec} appId={app.id} uses={capabilityUses} />
        ) : undefined}
      />
    )
  }
  if (kind === 'kanban') {
    return <SpecKanban app={app} view={view} workspaceCwd={workspaceCwd} previewRows={previewRows} />
  }
  if (kind === 'table') {
    return (
      <SpecTable
        app={app}
        view={view}
        workspaceCwd={workspaceCwd}
        previewRows={previewRows}
        onRefresh={onRefresh}
      />
    )
  }
  return null
}
