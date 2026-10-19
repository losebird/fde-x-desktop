/**
 * Canvas occupancy: Memory lives on the FDE-X 记忆 page.
 * Host tools stay in index.js. This client half must not register
 * conversation.view / DSH shell overlays.
 */
window.__ModuleLoader__.load({
  id: 'dsh-semantic-os',
  factory: () => ({
    inject: [],
    apply() {},
  }),
})
