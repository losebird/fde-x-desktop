import clsx from 'clsx'
import { kitFocus } from '@/components/surface/classes'
import type { McpDiscoverRow, McpRecipe } from '@/lib/runtime-api'

export function TemplatePicker({
  recipes,
  discovered,
  recipeId,
  draftName,
  onRecipe,
  onDiscover,
}: {
  recipes: McpRecipe[]
  discovered: McpDiscoverRow[]
  recipeId: string
  draftName: string
  onRecipe: (recipe: McpRecipe) => void
  onDiscover: (row: McpDiscoverRow) => void
}) {
  if (!recipes.length && !discovered.length) return null
  return (
    <div className="space-y-3">
      {recipes.length ? (
        <div>
          <div className="mb-1.5 text-kit-sm font-medium text-kit-ink">从模板开始</div>
          <div className="flex flex-wrap gap-2">
            {recipes.map((recipe) => {
              const selected = recipeId === recipe.id
              return (
                <button
                  key={recipe.id}
                  type="button"
                  disabled={!recipe.available}
                  title={recipe.hint || recipe.title}
                  className={clsx(
                    'rounded-kit border px-2.5 py-1.5 text-kit-sm',
                    kitFocus,
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    selected ? 'border-transparent bg-kit-brand text-white' : 'border-kit-line bg-kit-card text-kit-ink hover:bg-kit-muted',
                  )}
                  onClick={() => onRecipe(recipe)}
                >
                  {recipe.title}
                </button>
              )
            })}
          </div>
          {recipeId ? (
            <div className="mt-1.5 text-kit-meta text-kit-secondary">{recipes.find((row) => row.id === recipeId)?.hint}</div>
          ) : null}
        </div>
      ) : null}
      {discovered.length ? (
        <div>
          <div className="mb-1.5 text-kit-sm font-medium text-kit-ink">本机发现</div>
          <div className="flex flex-wrap gap-2">
            {discovered.map((row) => {
              const selected = !recipeId && draftName === row.serverName
              return (
                <button
                  key={row.serverName}
                  type="button"
                  disabled={row.present}
                  title={row.present ? '已经添加过' : row.serverName}
                  className={clsx(
                    'rounded-kit border px-2.5 py-1.5 text-kit-sm',
                    kitFocus,
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    selected ? 'border-transparent bg-kit-brand text-white' : 'border-kit-line bg-kit-card text-kit-ink hover:bg-kit-muted',
                  )}
                  onClick={() => onDiscover(row)}
                >
                  {row.serverName}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
