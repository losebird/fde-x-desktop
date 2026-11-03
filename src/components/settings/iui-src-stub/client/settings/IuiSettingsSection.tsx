export function settingsPrimitivesAvailable(): boolean {
  return false
}

export class IuiSettingsCardController {
  inject() {
    return {
      hooks: {
        iuiSettings: {
          subscribe: () => () => undefined,
          getSnapshot: () => ({ available: false, writable: false, dirty: false, invalid: false, saving: false, failed: false }),
        },
      },
      edit: () => undefined,
      resetField: () => undefined,
      save: () => undefined,
      discard: () => undefined,
    }
  }

  dispose() {}
}

export function IuiSettingsSection() {
  return null
}
