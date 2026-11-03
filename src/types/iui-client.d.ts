declare module '@iui/client/settings/IuiSettingsSection.tsx' {
  import type { ComponentType } from 'react'

  export function settingsPrimitivesAvailable(): boolean

  export class IuiSettingsCardController {
    constructor(scope: unknown)
    inject(): {
      hooks: { iuiSettings: { subscribe(listener: () => void): () => void; getSnapshot(): unknown } }
      edit: (field: string, text: string) => void
      resetField: (field: string) => void
      save: () => void
      discard: () => void
    }
    dispose(): void
  }

  export const IuiSettingsSection: ComponentType<{
    t: (key: string) => string
    useIuiSettings: (select: (s: never) => never) => never
    edit: (field: string, text: string) => void
    resetField: (field: string) => void
    save: () => void
    discard: () => void
  }>
}

declare module '@iui/client/settings/index.ts' {
  export const iuiSettingsZh: Record<string, string>
  export const iuiSettingsEn: Record<string, string>
}

declare module '@iui/client/asset-loader.ts' {
  export function setGenuiAssetBase(baseURL: string): void
}

declare module '@iui/client/i18n/index.ts' {
  export function setLocale(id: string): void
}

declare module '@iui/client/settings/config-bridge.ts' {
  export function setActiveIuiFormScope(scope: unknown): void
}

declare module '@iui/client/runtime-config.ts' {
  export function refreshRuntimeConfig(): Promise<unknown>
}
