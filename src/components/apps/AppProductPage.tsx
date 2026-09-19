import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { AppCapabilityBar } from '@/components/apps/AppCapabilityBar'
import { SpecCards } from '@/components/apps/SpecCards'
import { SpecChart } from '@/components/apps/SpecChart'
import { SpecFeed } from '@/components/apps/SpecFeed'
import { SpecForm } from '@/components/apps/SpecForm'
import { SpecKanban } from '@/components/apps/SpecKanban'
import { SpecStat } from '@/components/apps/SpecStat'
import { SpecTable } from '@/components/apps/SpecTable'
import { runDeclaredPlatformUse } from '@/lib/app-platform'
import {
  declaredPlatformUses,
  mockRowsForEntity,
  pageLooksLikeLedger,
  pairComposeChart,
  recordActionUses,
  resolvedSurface,
  specHasUse,
  viewById,
  visibleWorkSurfaceBlocks,
  workSurfacePages,
  type FdeAppDetail,
  type FdeAppPage,
  type FdeAppView,
  type FdePlatformUse,
  type ResolvedFdeAppSurface,
} from '@/lib/app-spec'

type Props = {
  app: FdeAppDetail
  workspaceCwd: string
  onRefresh: () => void
}

function initialPageId(pages: FdeAppPage[], surface: ResolvedFdeAppSurface): string {
  if (surface.defaultPage && pages.some((row) => row.id === surface.defaultPage)) {
    return surface.defaultPage
  }
  return pages[0]?.id || ''
}

export function AppProductPage({ app, workspaceCwd, onRefresh }: Props) {
  const { pages, extraViews } = workSurfacePages(app.spec)
  const surface = resolvedSurface(app.spec)
  const [pageId, setPageId] = useState(() => initialPageId(pages, surface))
  const [reloadToken, setReloadToken] = useState(0)
  const page = pages.find((row) => row.id === pageId) || pages[0]
  const preview = app.status !== 'active'
  const stackNav = surface.nav === 'stack'

  useEffect(() => {
    if (!pages.some((row) => row.id === pageId)) {
      setPageId(initialPageId(pages, surface))
    }
  }, [pageId, pages, surface])

  const refresh = () => {
    setReloadToken((value) => value + 1)
    onRefresh()
  }

  if (!page) return null
  const actionUses = recordActionUses(app.spec)

  const renderPageBody = (targetPage: FdeAppPage) => (
    <div className="space-y-2" data-app-ledger={pageLooksLikeLedger(targetPage) ? 'true' : undefined}>
      {renderBlocks(visibleWorkSurfaceBlocks(targetPage), surface).map((group, index) => (
        <div
          key={`${targetPage.id}-g-${index}`}
          className={group.pair ? 'grid grid-cols-2 gap-2 items-stretch' : undefined}
          data-app-compose-chart={group.pair ? 'true' : undefined}
        >
          {group.blocks.map((block, blockIndex) => (
            <ProductBlock
              key={`${targetPage.id}-${block.kind}-${index}-${blockIndex}`}
              app={app}
              workspaceCwd={workspaceCwd}
              preview={preview}
              reloadToken={reloadToken}
              onRefresh={refresh}
              surface={surface}
              view={'view' in block ? viewById(app.spec, block.view, extraViews) : undefined}
              statViews={block.kind === 'stats' ? block.views.map((id) => viewById(app.spec, id, extraViews)).filter((row): row is FdeAppView => Boolean(row)) : []}
              kind={block.kind}
              capabilityUses={
                block.kind === 'compose' || block.kind === 'form'
                  ? actionUses
                  : []
              }
            />
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <div
      className="space-y-2"
      data-app-product="true"
      data-app-uses={declaredPlatformUses(app.spec).join(',')}
      data-app-surface-nav={surface.nav}
      data-app-surface-density={surface.density}
      data-app-surface-primary-where={surface.primary.where}
      data-app-surface-hero={surface.cards.hero}
      data-app-surface-columns={surface.cards.columns ?? ''}
      data-app-surface-compose-chart={surface.ledger.composeChart}
    >
      {!stackNav && (
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
      )}
      {stackNav ? (
        <div className="space-y-4">
          {pages.map((stackPage) => (
            <section key={stackPage.id} className="space-y-2">
              <h2 className="text-xs font-semibold text-ink-muted tracking-wide">
                {stackPage.label || stackPage.id}
              </h2>
              {renderPageBody(stackPage)}
            </section>
          ))}
        </div>
      ) : (
        renderPageBody(page)
      )}
    </div>
  )
}

function renderBlocks(
  blocks: FdeAppPage['blocks'],
  surface: ResolvedFdeAppSurface,
): { pair: boolean; blocks: FdeAppPage['blocks'] }[] {
  const groups: { pair: boolean; blocks: FdeAppPage['blocks'] }[] = []
  const mayPair = pairComposeChart(surface)
  for (let i = 0; i < blocks.length; i++) {
    const current = blocks[i]
    const next = blocks[i + 1]
    const compose = current.kind === 'compose' || current.kind === 'form'
    if (mayPair && compose && next?.kind === 'chart') {
      groups.push({ pair: true, blocks: [current, next] })
      i += 1
      continue
    }
    groups.push({ pair: false, blocks: [current] })
  }
  return groups
}

function ProductBlock({
  app, workspaceCwd, preview, reloadToken, onRefresh, surface, view, statViews, kind, capabilityUses,
}: {
  app: FdeAppDetail
  workspaceCwd: string
  preview: boolean
  reloadToken: number
  onRefresh: () => void
  surface: ResolvedFdeAppSurface
  view?: FdeAppView
  statViews: FdeAppView[]
  kind: FdeAppPage['blocks'][number]['kind']
  capabilityUses: FdePlatformUse[]
}) {
  if (kind === 'stats') {
    return (
      <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-2" data-app-overview="true">
        {statViews.map((stat, index) => (
          <SpecStat
            key={stat.id || stat.label}
            app={app}
            view={stat}
            workspaceCwd={workspaceCwd}
            previewRows={preview ? mockRowsForEntity(app.spec, stat.entity) : undefined}
            variant="tile"
            tileIndex={index}
          />
        ))}
      </div>
    )
  }
  if (!view) return null
  const previewRows = preview ? mockRowsForEntity(app.spec, view.entity) : undefined
  if (kind === 'compose' || kind === 'form') {
    return (
      <div className="border border-line rounded-xl bg-surface p-3 space-y-2 min-w-0 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">{view.label || '记下'}</div>
          {specHasUse(app.spec, 'briefing') && (
            <button
              type="button"
              className="text-xs text-ink-muted hover:text-ink"
              data-app-use="briefing"
              onClick={() => { void runDeclaredPlatformUse('briefing', app.spec, app.id) }}
            >
              打开早报
            </button>
          )}
        </div>
        <SpecForm
          app={app}
          entity={view.entity}
          workspaceCwd={workspaceCwd}
          readOnly={app.status !== 'active'}
          layout="compose"
          submitLabel={view.label}
          onDone={onRefresh}
          renderSubmit={capabilityUses.length ? (submitButton) => (
            <AppCapabilityBar
              spec={app.spec}
              appId={app.id}
              uses={capabilityUses}
              primary={submitButton}
              title={app.spec.name}
            />
          ) : undefined}
        />
      </div>
    )
  }
  if (kind === 'chart') {
    return <SpecChart app={app} view={view} workspaceCwd={workspaceCwd} previewRows={previewRows} reloadToken={reloadToken} />
  }
  if (kind === 'feed') {
    return (
      <SpecFeed
        app={app}
        view={view}
        workspaceCwd={workspaceCwd}
        previewRows={previewRows}
        reloadToken={reloadToken}
        feedDensity={surface.ledger.feed}
      />
    )
  }
  if (kind === 'cards') {
    return (
      <SpecCards
        app={app}
        view={view}
        workspaceCwd={workspaceCwd}
        previewRows={previewRows}
        reloadToken={reloadToken}
        actionUses={capabilityUses}
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
