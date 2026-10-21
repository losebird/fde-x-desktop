/**
 * Same-origin /semantic-os prefix: product UI assets + sidecar proxy.
 * Browser never talks to the sidecar loopback.
 * @module dsh-semantic-os/http
 */

import { request as httpRequest } from 'node:http'
import { createHash } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOverlay, mergeConfig, saveOverlay } from './persist.js'
import { handleProduct } from './product.js'
import { savePeople } from './people.js'
import { PLUGIN_VERSION } from './version.js'

const ASSET_V = `v=${PLUGIN_VERSION}`

const PLUGIN_DIR = fileURLToPath(new URL('.', import.meta.url))
const WS_HOSTS = {
  explore: join(PLUGIN_DIR, 'dist/explore'),
  analyze: join(PLUGIN_DIR, 'dist/analyze'),
  decisions: join(PLUGIN_DIR, 'dist/decisions'),
  io: join(PLUGIN_DIR, 'dist/io'),
  ontology: join(PLUGIN_DIR, 'dist/ontology'),
  admin: join(PLUGIN_DIR, 'dist/admin'),
}

const PREFIX = '/semantic-os'

const THEME_CSS = `
html,body,#root{height:100%!important;max-height:100%!important;overflow:hidden!important;background:var(--dsw-alias-bg-base,#fff)!important;color:var(--dsw-alias-label-primary,#1f2328)!important}
:root{
  --app-bg:var(--dsw-alias-bg-base);
  --panel-bg:var(--dsw-alias-bg-layer-1);
  --panel-border:var(--dsw-alias-border-l2);
  --text-main:var(--dsw-alias-label-primary);
  --text-muted:#3d444d;
  --accent:var(--dsw-alias-brand-primary);
  --accent-strong:var(--dsw-alias-brand-primary);
  --ws-bg:var(--dsw-alias-bg-base);
  --ws-bg-base:var(--dsw-alias-bg-base);
  --ws-surface:var(--dsw-alias-bg-layer-1);
  --ws-card:var(--dsw-alias-bg-layer-2);
  --ws-text:var(--dsw-alias-label-primary);
  --ws-text-dim:#3d444d;
  --ws-text-muted:#3d444d;
  --ws-border:var(--dsw-alias-border-l2);
  --ws-border-strong:var(--dsw-alias-border-l1);
  --ws-accent:var(--dsw-alias-brand-primary);
  --ws-accent-soft:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent);
  --xy-background-color:var(--dsw-alias-bg-base);
  --xy-background-color-default:var(--dsw-alias-bg-base);
  --xy-node-background-color-default:var(--dsw-alias-bg-layer-1);
  --xy-node-color-default:var(--dsw-alias-label-primary);
  --xy-controls-button-background-color-default:var(--dsw-alias-bg-layer-1);
  --xy-controls-button-color-default:var(--dsw-alias-label-primary);
}
.landing-page,.app-shell,.workspace-shell,.workspace-body,.ws-page,.ws-scroll{
  background:var(--dsw-alias-bg-base)!important;
  color:var(--dsw-alias-label-primary)!important;
}
.app-shell{height:100%!important;max-height:100%!important;overflow:hidden!important}
.landing-page,.workspace-body,.ws-page,.ws-scroll,.vocab-workspace{
  overflow-y:auto!important;
  min-height:0!important;
}
.landing-page::before{display:none!important}
.landing-preview{
  background:var(--dsw-alias-bg-layer-1)!important;
  border-color:var(--dsw-alias-border-l2)!important;
  box-shadow:none!important;
}
.landing-preview-topbar{background:var(--dsw-alias-bg-layer-2)!important}
.landing-title,.landing-copy,.ws-title,h1,h2{color:var(--dsw-alias-label-primary)!important}
.landing-title span{
  background:none!important;
  color:var(--dsw-alias-brand-primary)!important;
  -webkit-text-fill-color:var(--dsw-alias-brand-primary)!important;
}
.landing-subtitle,.landing-status-version,.ws-body{color:var(--dsw-alias-label-primary)!important}
.landing-status-text,.landing-kicker{color:var(--dsw-alias-brand-primary)!important;border-color:var(--dsw-alias-border-l2)!important;background:var(--dsw-alias-bg-layer-1)!important}
.landing-cta-primary,.ws-btn--primary{background:var(--dsw-alias-brand-primary)!important;border-color:transparent!important;color:var(--dsw-alias-label-primary-foreground,#fff)!important;-webkit-text-fill-color:var(--dsw-alias-label-primary-foreground,#fff)!important;box-shadow:none!important}
.landing-cta-secondary,.ws-btn,.ws-btn--ghost{background:var(--dsw-alias-bg-layer-1)!important;border-color:var(--dsw-alias-border-l2)!important;color:var(--dsw-alias-label-primary)!important}
.app-rail{background:var(--dsw-alias-bg-layer-1)!important;border-color:var(--dsw-alias-border-l2)!important}
.ws-card{background:var(--dsw-alias-bg-layer-1)!important;border-color:var(--dsw-alias-border-l2)!important;color:var(--dsw-alias-label-primary)!important}
.react-flow,.react-flow__renderer,.react-flow__viewport,.react-flow__background{background:var(--dsw-alias-bg-base)!important}
.landing-capability-band{
  background:var(--dsw-alias-bg-layer-1)!important;
  border-color:var(--dsw-alias-border-l2)!important;
}
.landing-capability,.landing-capability-label{
  color:var(--dsw-alias-label-primary)!important;
  background:var(--dsw-alias-bg-layer-2)!important;
  border-color:var(--dsw-alias-border-l2)!important;
}
.landing-capability:hover{color:var(--dsw-alias-label-primary)!important;background:var(--dsw-alias-bg-layer-1)!important}
.landing-workspace-card,.landing-workspace-card--primary{
  background:var(--dsw-alias-bg-layer-1)!important;
  border-color:var(--dsw-alias-border-l2)!important;
  color:var(--dsw-alias-label-primary)!important;
  box-shadow:none!important;
}
.workspace-loading{background:var(--dsw-alias-bg-base)!important;color:var(--dsw-alias-label-primary)!important}
.dsos-onto-hub{background:var(--dsw-alias-bg-base,#fff)!important;color:var(--dsw-alias-label-primary)!important;font-size:14px}.dsos-onto-hub [style*="uppercase"],.dsos-onto-hub [style*="letter-spacing"]{color:var(--dsw-alias-label-primary)!important;opacity:1!important;font-size:12px!important}.dsos-onto-hub h1,.dsos-onto-hub h2,.dsos-onto-hub h3,.dsos-onto-hub h4,.dsos-onto-hub p,.dsos-onto-hub label,.dsos-onto-hub span,.dsos-onto-hub button,.dsos-onto-hub a{color:var(--dsw-alias-label-primary)!important}.dsos-onto-hub input,.dsos-onto-hub select,.dsos-onto-hub textarea{color:var(--dsw-alias-label-primary)!important;background:var(--dsw-alias-bg-layer-1,#f6f8fa)!important}
.dsos-onto-hub input,.dsos-onto-hub select,.dsos-onto-hub textarea{background:var(--dsw-alias-bg-layer-1,#f6f8fa)!important;color:var(--dsw-alias-label-primary)!important;border-color:var(--dsw-alias-border-l2)!important}

.palantir-bg,.palantir-grid,.explore-shell,.explore-scene-stage,.explore-scene-card,.explore-scene-stack{
  background:var(--dsw-alias-bg-base)!important;
}
.palantir-vignette{opacity:0!important;background:none!important}
.explore-scene-footer,.explore-toolbar,.explore-search-command,.explore-tool-cluster,.explore-plugin-dock-tab,.explore-inspector-shell,.explore-inspector-card,.explore-workflow-bar,.explore-status-strip{
  background:var(--dsw-alias-bg-layer-1)!important;
  color:var(--dsw-alias-label-primary)!important;
  border-color:var(--dsw-alias-border-l2)!important;
  box-shadow:none!important;
}
.explore-tool-cluster-label{color:var(--dsw-alias-label-primary)!important}
.explore-tool-button-label{color:inherit!important;-webkit-text-fill-color:inherit!important}
.explore-tool-button[data-active="true"] .explore-tool-button-label,.explore-tool-button-primary .explore-tool-button-label,.explore-mode-segment[data-active="true"] .explore-tool-button-label{color:var(--dsw-alias-label-primary-foreground,#fff)!important;-webkit-text-fill-color:var(--dsw-alias-label-primary-foreground,#fff)!important}
.explore-tool-button[data-active="true"] svg,.explore-tool-button-primary svg,.explore-mode-segment[data-active="true"] svg{color:inherit;stroke:currentColor}
.explore-mode-segment,.explore-tool-button{color:var(--dsw-alias-label-primary)!important;border-color:var(--dsw-alias-border-l2)!important;background:var(--dsw-alias-bg-layer-2)!important}
.landing-command-card,.landing-dossier-card,.landing-timeline-card,.landing-preview,.landing-timeline-track,.landing-timeline-badge{
  background:var(--dsw-alias-bg-layer-1)!important;
  background-image:none!important;
  border-color:var(--dsw-alias-border-l2)!important;
  color:var(--dsw-alias-label-primary)!important;
  box-shadow:none!important;
}
.explore-scene-footer,.explore-scene-footer>*{
  background:var(--dsw-alias-bg-layer-1)!important;
  background-image:none!important;
  color:var(--dsw-alias-label-primary)!important;
  border-color:var(--dsw-alias-border-l2)!important;
}
.workspace-header,.workspace-header--compact,.workspace-tab{
  background:var(--dsw-alias-bg-layer-1)!important;
  color:var(--dsw-alias-label-primary)!important;
  border-color:var(--dsw-alias-border-l2)!important;
}
.ws-panel--inset,.ws-sidebar,.ws-input,.ws-textarea{
  background:var(--dsw-alias-bg-layer-1)!important;
  color:var(--dsw-alias-label-primary)!important;
  border-color:var(--dsw-alias-border-l2)!important;
}
.explore-scene-shell,.glass-hud,.glass-header,.graph-loading-card,.graph-stage-loader-card{
  background:var(--dsw-alias-bg-layer-1)!important;
  color:var(--dsw-alias-label-primary)!important;
  border-color:var(--dsw-alias-border-l2)!important;
}
.dsh-explore-host .explore-scene-shell { flex: 1 1 auto !important; min-height: 220px !important; }
.dsh-explore-host .explore-plugin-dock {
  flex: 0 0 auto !important;
  height: auto !important;
  max-height: 220px !important;
  min-height: 0 !important;
}
.dsh-explore-host .explore-scene-footer { flex: 0 0 auto !important; }

.dsh-explore-host .explore-plugin-dock-card,
.dsh-explore-host .explore-plugin-dock-stack {
  flex: 0 1 auto !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: 220px !important;
}
.dsh-explore-host .explore-plugin-dock-body {
  flex: 0 1 auto !important;
  max-height: 160px !important;
  overflow: auto !important;
}

.react-flow,.react-flow__node-default,.react-flow__controls,.react-flow__minimap{
  background:var(--dsw-alias-bg-base)!important;
  color:var(--dsw-alias-label-primary)!important;
}
.vocab-detail-glass,.vocab-workspace{
  background:var(--dsw-alias-bg-base)!important;
  color:var(--dsw-alias-label-primary)!important;
}
.landing-workspace-card-title,.landing-workspace-card-eyebrow,.landing-workspace-card-desc{
  color:var(--dsw-alias-label-primary)!important;
  opacity:1!important;
  -webkit-text-fill-color:var(--dsw-alias-label-primary)!important;
}
.landing-workspace-card-desc{color:color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))!important;-webkit-text-fill-color:color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))!important}
.explore-search-command button,.workspace-tab,.ws-btn,.ws-btn--ghost,.ws-btn--primary{
  opacity:1!important;
}
.ws-empty-title,.ws-empty-body,.workspace-title,.workspace-subtitle,.workspace-kicker{
  color:var(--dsw-alias-label-primary)!important;
  opacity:1!important;
}
.workspace-subtitle,.ws-empty-body{color:color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))!important}

.ws-empty,.ws-empty-title{color:var(--dsw-alias-label-primary)!important}
.ws-empty-body{color:color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))!important}
.ws-eyebrow{color:var(--dsw-alias-brand-primary)!important}

.landing-preview,.landing-kicker,.landing-capability-band,
.landing-metrics,.landing-section-header,.landing-workspace-grid,section[aria-label="Workspaces"],
.landing-hero,.landing-copy,.landing-cta-row,.landing-status-bar{display:none!important}
.landing-page,.landing-shell,.landing-title,.landing-subtitle{display:none!important}
.landing-shell{max-width:980px!important;padding:20px 28px 40px!important;box-sizing:border-box!important}
.brand-pill{
  width:auto!important;min-width:44px;height:auto!important;padding:10px 6px!important;
  border-radius:8px!important;background:transparent!important;
  color:var(--dsw-alias-label-primary)!important;
  border:1px solid transparent!important;
  font-size:11px!important;font-weight:600!important;letter-spacing:0!important;
  box-shadow:none!important;
}
.brand-pill:hover{background:var(--dsw-alias-bg-layer-2)!important;border-color:var(--dsw-alias-border-l2)!important}
.app-rail .nav-button[data-active="true"],.brand-pill[data-active="true"]{background:var(--dsw-alias-bg-layer-2)!important}
#dsos-home-guide{
  position:fixed;inset:0;z-index:25;overflow:auto;box-sizing:border-box;
  padding:20px 28px 40px;
  background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary);
}
#dsos-home-guide .dsos-home-kicker,#dsos-home-guide .dsos-home-lead,#dsos-home-guide .dsos-home-grid{max-width:980px}
body[data-dsos-cat]:not([data-dsos-cat="home"]) #dsos-home-guide{display:none!important}
.dsos-home-kicker{margin:0 0 6px!important;font-size:12px!important;font-weight:650!important;letter-spacing:0.02em!important;color:var(--dsw-alias-brand-primary)!important}
.dsos-home-lead{margin:0 0 16px!important;max-width:42em!important;font-size:14px!important;line-height:1.65!important;color:color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))!important}
.dsos-home-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:12px!important}
.dsos-home-card{
  display:flex!important;flex-direction:column!important;align-items:flex-start!important;
  margin:0!important;padding:16px 16px 18px!important;text-align:left!important;
  border:1px solid var(--dsw-alias-border-l2)!important;border-radius:12px!important;
  background:var(--dsw-alias-bg-layer-1,#f6f8fa)!important;color:var(--dsw-alias-label-primary)!important;
  box-shadow:none!important;cursor:pointer!important;
}
.dsos-home-card:hover{border-color:var(--dsw-alias-brand-primary)!important;background:var(--dsw-alias-bg-layer-2,#eef1f4)!important}
.dsos-home-card h3{margin:0 0 8px!important;font-size:15px!important;font-weight:650!important;line-height:1.3!important}
.dsos-home-card p{margin:0!important;font-size:13px!important;line-height:1.55!important;color:color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))!important}
@media (max-width:860px){.dsos-home-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}

.ws-page,.ws-scroll,.ws-body,.workspace-body{
  background:var(--dsw-alias-bg-base)!important;
  color:var(--dsw-alias-label-primary)!important;
}

.app-rail{display:none!important;width:0!important;min-width:0!important;padding:0!important;margin:0!important;border:0!important;overflow:hidden!important}
.app-shell{width:100%!important}
.app-shell>.landing-page,.app-shell>.workspace-shell,.landing-page,.workspace-shell{
  flex:1 1 auto!important;min-width:0!important;width:100%!important;
}
#dsos-cat{
  display:flex;flex-wrap:wrap;align-items:center;gap:8px;
  position:sticky;top:0;z-index:30;width:100%;box-sizing:border-box;
  padding:8px 12px;flex:0 0 auto;
  border-bottom:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-1,#f6f8fa);
  color:var(--dsw-alias-label-primary);
}
body[data-dsos-cat="home"] #dsos-cat{display:none!important}
#dsos-cat .dsos-cat-btn{
  height:32px;padding:0 12px;border-radius:8px;cursor:pointer;font-size:12px;
  border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-base,#fff);
  color:var(--dsw-alias-label-primary);
}
#dsos-cat .dsos-cat-btn.primary{
  background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-label-primary-foreground, var(--dsw-alias-label-on-primary, #fff));
}
#dsos-cat .dsos-cat-input{
  min-width:160px;height:32px;padding:0 10px;border-radius:8px;font-size:12px;
  border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-base,#fff);
  color:var(--dsw-alias-label-primary);
}
#dsos-cat .dsos-cat-hint{font-size:12px;color:color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))}
#dsos-cat .dsos-cat-err{font-size:12px;color:#d14343}
#dsos-cat .dsos-cat-ok{font-size:12px;color:var(--dsw-alias-brand-primary)}
body[data-dsos-io="1"] .workspace-body .ws-card{display:none!important}
body[data-dsos-sparql="1"] .workspace-body .ws-page{display:none!important}
[data-dsos-sparql-hide],[data-dsos-brand-hide]{display:none!important}
.workspace-kicker,.workspace-title,.workspace-subtitle,.workspace-header-main{display:none!important}
#dsos-home-guide .dsos-home-pills{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;max-width:980px}
#dsos-home-guide .dsos-home-pill{
  display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:650;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1,#f6f8fa);
  color:var(--dsw-alias-label-primary);
}
#dsos-home-guide .dsos-home-title{margin:0 0 10px;max-width:980px;font-size:36px;line-height:1.15;font-weight:700}
#dsos-home-guide .dsos-home-shortcuts{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px;max-width:980px}
#dsos-home-guide .dsos-home-cta{
  height:36px;padding:0 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:650;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base,#fff);
  color:var(--dsw-alias-label-primary);
}
#dsos-home-guide .dsos-home-cta.primary{
  background:var(--dsw-alias-brand-primary);border-color:transparent;color:var(--dsw-alias-label-primary-foreground, var(--dsw-alias-label-on-primary, #fff));
}
#dsos-ws-title{
  display:none;position:sticky;top:0;z-index:29;width:100%;box-sizing:border-box;
  padding:10px 16px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-1,#f6f8fa);color:var(--dsw-alias-label-primary);
}
body[data-dsos-cat]:not([data-dsos-cat="home"]) #dsos-ws-title{display:block}
#dsos-ws-title .dsos-ws-kicker{margin:0;font-size:12px;font-weight:650;letter-spacing:0.02em;color:var(--dsw-alias-brand-primary)}
#dsos-ws-title .dsos-ws-name{margin:2px 0 0;font-size:22px;line-height:1.25;font-weight:700}
#dsos-ws-title .dsos-ws-sub{margin:4px 0 0;font-size:13px;line-height:1.5;color:color-mix(in srgb, var(--dsw-alias-label-primary) 82%, var(--dsw-alias-label-secondary))}
.dsh-explore-host .explore-main-grid{grid-template-columns:minmax(0,1fr)!important;position:relative!important}
.dsh-explore-host .explore-inspector-shell{position:absolute!important;top:8px!important;right:8px!important;bottom:8px!important;width:312px!important;max-width:36vw!important;z-index:24!important;min-height:0!important;height:auto!important;display:flex!important;flex-direction:column!important;pointer-events:auto!important;overflow:hidden!important;border-radius:12px!important;background:var(--dsw-alias-bg-layer-1,#f6f8fa)!important;color:var(--dsw-alias-label-primary,#1f2328)!important;border:1px solid var(--dsw-alias-border-l2,rgba(31,35,40,0.15))!important;box-shadow:0 10px 28px color-mix(in srgb,var(--dsw-alias-label-primary,#1f2328) 14%,transparent)!important}
.dsh-explore-host .explore-inspector-card,.dsh-explore-host .explore-inspector-scroll,.dsh-explore-host .explore-inspector-shell .sem-inspector{height:100%!important;min-height:0!important;background:var(--dsw-alias-bg-layer-1,#f6f8fa)!important;color:var(--dsw-alias-label-primary,#1f2328)!important}
.dsh-explore-host .explore-inspector-scroll{overflow-y:auto!important}
.dsh-explore-host .explore-inspector-shell .node-panel-summary,.dsh-explore-host .explore-inspector-shell .node-panel-body,.dsh-explore-host .explore-inspector-shell aside,.dsh-explore-host .explore-inspector-shell h3,.dsh-explore-host .explore-inspector-shell p,.dsh-explore-host .explore-inspector-shell span{color:var(--dsw-alias-label-primary,#1f2328)!important}
.dsh-explore-host .explore-inspector-shell input{background:var(--dsw-alias-bg-base,#fff)!important;color:var(--dsw-alias-label-primary,#1f2328)!important;border:1px solid var(--dsw-alias-border-l2,rgba(31,35,40,0.15))!important}
.dsh-explore-host .explore-inspector-shell input::placeholder{color:var(--dsos-placeholder,#3d444d)!important;opacity:1!important}
.dsh-explore-host .explore-inspector-shell section,.dsh-explore-host .explore-inspector-shell .node-panel-collapse{background:var(--dsw-alias-bg-layer-2,#eef1f4)!important;border-color:var(--dsw-alias-border-l2,rgba(31,35,40,0.15))!important;color:var(--dsw-alias-label-primary,#1f2328)!important}
.dsh-explore-host .explore-inspector-shell button{color:var(--dsw-alias-label-primary,#1f2328)!important}
.dsh-explore-host .explore-inspector-shell .explore-inspector-primary{background:var(--dsw-alias-brand-primary,#0969da)!important;color:var(--dsw-alias-label-primary-foreground,#fff)!important;-webkit-text-fill-color:var(--dsw-alias-label-primary-foreground,#fff)!important;border-color:transparent!important}
.dsh-explore-host .explore-plugin-dock-body{color:var(--dsw-alias-label-primary,#1f2328)!important}
.dsh-explore-host .dsos-effect-toggle{color:var(--dsw-alias-label-primary,#1f2328)!important;-webkit-text-fill-color:var(--dsw-alias-label-primary,#1f2328)!important;background:var(--dsw-alias-bg-layer-1,#f6f8fa)!important}
.dsh-explore-host .dsos-effect-toggle.is-on{background:var(--dsw-alias-brand-primary,#0969da)!important;border-color:var(--dsw-alias-brand-primary,#0969da)!important;color:var(--dsw-alias-label-primary-foreground,#fff)!important;-webkit-text-fill-color:var(--dsw-alias-label-primary-foreground,#fff)!important}
@media (max-width:1260px){.dsh-explore-host .explore-main-grid{grid-template-columns:minmax(0,1fr)!important}.dsh-explore-host .explore-inspector-shell{position:absolute!important;top:8px!important;right:8px!important;bottom:8px!important;width:312px!important;max-width:36vw!important}}
`


const HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host',
])


export function isTrustedRequest(req) {
  const host = header(req.headers, 'host')
  if (!host) return false
  const hostUrl = parseAuthority(host)
  if (!hostUrl || !isLoopbackHostname(hostUrl.hostname)) return false
  if (header(req.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(req.headers, 'origin')
  if (origin === undefined) return req.method === 'GET' || req.method === 'HEAD'
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

function json(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(buf.length),
  })
  res.end(buf)
}

function readBody(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > max) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function escapeAttr(value) {
  return String(value).replace(/"/g, '&quot;')
}

function isLatin1Header(value) {
  const text = String(value || '')
  return Boolean(text) && !/[\r\n\t\u0100-\uFFFF]/.test(text)
}

function header(headers, name) {
  const key = String(name).toLowerCase()
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === key) return Array.isArray(v) ? v[0] : v
  }
  return undefined
}

function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

function isLoopbackHostname(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = String(hostname || '').split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function redactDoctor(text) {
  return String(text || '').replace(/sk-[A-Za-z0-9_\-]*[….]?/g, '[key]')
}

function publicState(snap) {
  return {
    ready: Boolean(snap && snap.ready),
    reason: (snap && snap.reason) || null,
    detail: (snap && snap.detail) || '',
    version: (snap && snap.version) || '',
    python: (snap && snap.python) || '',
    port: (snap && snap.port) || null,
    doctor: redactDoctor((snap && snap.doctor) || ''),
    llmProvider: (snap && snap.llmProvider) || '',
    llmModel: (snap && snap.llmModel) || '',
    llmReady: Boolean(snap && snap.llmReady),
    install: snap && snap.install ? snap.install : null,
  }
}

function normalizeLang(value) {
  const raw = String(value || '').toLowerCase()
  return raw.startsWith('zh') ? 'zh' : 'en'
}


function bustRelativeModuleUrls(body) {
  return String(body).replace(
    /(from\s*["']|import\s*\(\s*["'])(\.\.?\/[^"'?#]+?\.(?:js|css))(?:\?v=[^"']*)?/g,
    (_full, prefix, spec) => `${prefix}${spec}?${ASSET_V}`,
  )
}

function rewriteOfficialColors(body, kind) {
  let out = String(body)
  if (kind === 'js') {
    const swaps = [
      ['canvas:"#0A0D11"', 'canvas:window.__dsos("canvas","#ffffff")'],
      ['app:"#08090B"', 'app:window.__dsos("app","#ffffff")'],
      ['stage:"#0B0E12"', 'stage:window.__dsos("stage","#ffffff")'],
      ['strong:"#F3F0E8"', 'strong:window.__dsos("textStrong","#1f2328")'],
      ['body:"#D5D9DD"', 'body:window.__dsos("textBody","#1f2328")'],
      ['muted:"#9AA3AE"', 'muted:window.__dsos("textMuted","#3d444d")'],
      ['subtle:"#6F7A86"', 'subtle:window.__dsos("textSubtle","#3d444d")'],
      ['defaultText:"#D7D1C4"', 'defaultText:window.__dsos("textBody","#1f2328")'],
      ['background:"linear-gradient(180deg, #0B0E12 0%, #07080B 100%)"', 'background:window.__dsos("sceneBg","#ffffff")'],
      ['vignette:"radial-gradient(ellipse at center, transparent 42%, rgba(2, 3, 5, 0.82) 100%)"', 'vignette:window.__dsos("vignette","transparent")'],
      ['shell:"rgba(17, 21, 27, 0.82)"', 'shell:window.__dsos("shell","#ffffff")'],
      ['inputBg:"rgba(5, 7, 10, 0.52)"', 'inputBg:window.__dsos("inputBg","#ffffff")'],
      ['background:"linear-gradient(180deg, rgba(14, 18, 24, 0.86), rgba(8, 11, 15, 0.92))"', 'background:window.__dsos("timelineBg","#ffffff")'],
      ['u?"Pause":"Run"', 'u?window.__dsosT("Pause"):window.__dsosT("Run")'],
      ['return"Stabilizing layout"', 'return window.__dsosT("Stabilizing layout")'],
      ['return"Hydrating graph scene"', 'return window.__dsosT("Hydrating graph scene")'],
      ['return"Preparing graph session"', 'return window.__dsosT("Preparing graph session")'],
      ['return"Loading nodes"', 'return window.__dsosT("Loading nodes")'],
      ['return"Loading relationships"', 'return window.__dsosT("Loading relationships")'],
      ['return"Computing node styling"', 'return window.__dsosT("Computing node styling")'],
      ['return"Graph ready"', 'return window.__dsosT("Graph ready")'],
      ['," nodes · ",', ',window.__dsosT(" nodes · "),'],
      ['," edges"', ',window.__dsosT(" edges")'],
      ['," active"', ',window.__dsosT(" active")'],
      ['children:"66% coverage"', 'children:window.__dsosT("66% coverage")'],
      ['children:"Drug Candidate"', 'children:window.__dsosT("Drug Candidate")'],
      ['children:"Pathway Activation"', 'children:window.__dsosT("Pathway Activation")'],
      ['children:"No decision selected"', 'children:window.__dsosT("No decision selected")'],
      ['children:"0 events"', 'children:window.__dsosT("0 events")'],
      ['children:"0 vocabulary schemes loaded"', 'children:window.__dsosT("0 vocabulary schemes loaded")'],
      ['children:"Suggestions"', 'children:window.__dsosT("Suggestions")'],
      ['children:"Pairwise alignment matrix"', 'children:window.__dsosT("Pairwise alignment matrix")'],
      ['children:"Create or update alignment"', 'children:window.__dsosT("Create or update alignment")'],
      ['children:"Cross-ontology mappings"', 'children:window.__dsosT("Cross-ontology mappings")'],
      ['children:"Generate, edit, and validate shapes"', 'children:window.__dsosT("Generate, edit, and validate shapes")'],
      ['children:"Shape library"', 'children:window.__dsosT("Shape library")'],
      ['children:"Total health score"', 'children:window.__dsosT("Total health score")'],
      ['children:"Versions & Change Proposals"', 'children:window.__dsosT("Versions & Change Proposals")'],
      ['children:"Entity Search"', 'children:window.__dsosT("Entity Search")'],
      ['children:"Quality and governance signals"', 'children:window.__dsosT("Quality and governance signals")'],
      ['children:"Relation"', 'children:window.__dsosT("Relation")'],
      ['children:"Source"', 'children:window.__dsosT("Source")'],
      ['label:"Relations"', 'label:window.__dsosT("Relations")'],
      ['placeholder:"Search classes, properties, concepts…"', 'placeholder:window.__dsosT("Search classes, properties, concepts…")'],
      ['label:"Suggestions"', 'label:window.__dsosT("Suggestions")'],
      ['children:"SHACL STUDIO"', 'children:window.__dsosT("SHACL STUDIO")'],
      ['children:"Generate strict"', 'children:window.__dsosT("Generate strict")'],
      ['children:"0 shapes"', 'children:window.__dsosT("0 shapes")'],
      ['placeholder:"Ontology URI"', 'placeholder:window.__dsosT("Ontology URI")'],
      ['children:"ONTOLOGY"', 'children:window.__dsosT("ONTOLOGY")'],
      ['label:"Ontology"', 'label:window.__dsosT("Ontology")'],
      ['children:" above."', 'children:window.__dsosT(" above.")'],
      ['placeholder:"Filter by ID, category, outcome…"', 'placeholder:window.__dsosT("Filter by ID, category, outcome…")'],
      ['label:"Manage"', 'label:window.__dsosT("Manage")'],
      ['children:"Manage"', 'children:window.__dsosT("Manage")'],
      ['label:"Explore"', 'label:window.__dsosT("Explore")'],
      ['children:"Explore"', 'children:window.__dsosT("Explore")'],
      ['label:"Analyze"', 'label:window.__dsosT("Analyze")'],
      ['children:"Analyze"', 'children:window.__dsosT("Analyze")'],
      ['label:"Enrich"', 'label:window.__dsosT("Enrich")'],
      ['children:"Enrich"', 'children:window.__dsosT("Enrich")'],
      ['label:"Decisions"', 'label:window.__dsosT("Decisions")'],
      ['children:"Decisions"', 'children:window.__dsosT("Decisions")'],
      ['label:"Workspaces"', 'label:window.__dsosT("Workspaces")'],
      ['children:"Workspaces"', 'children:window.__dsosT("Workspaces")'],
      ['label:"Vocabulary"', 'label:window.__dsosT("Vocabulary")'],
      ['children:"Vocabulary"', 'children:window.__dsosT("Vocabulary")'],
      ['label:"Registry"', 'label:window.__dsosT("Registry")'],
      ['children:"Registry"', 'children:window.__dsosT("Registry")'],
      ['label:"Search"', 'label:window.__dsosT("Search")'],
      ['children:"Search"', 'children:window.__dsosT("Search")'],
      ['label:"Trace"', 'label:window.__dsosT("Trace")'],
      ['children:"Trace"', 'children:window.__dsosT("Trace")'],
      ['label:"Versions"', 'label:window.__dsosT("Versions")'],
      ['children:"Versions"', 'children:window.__dsosT("Versions")'],
      ['label:"Editor"', 'label:window.__dsosT("Editor")'],
      ['children:"Editor"', 'children:window.__dsosT("Editor")'],
      ['label:"Alignments"', 'label:window.__dsosT("Alignments")'],
      ['children:"Alignments"', 'children:window.__dsosT("Alignments")'],
      ['label:"Health"', 'label:window.__dsosT("Health")'],
      ['children:"Health"', 'children:window.__dsosT("Health")'],
      ['label:"Mappings"', 'label:window.__dsosT("Mappings")'],
      ['children:"Mappings"', 'children:window.__dsosT("Mappings")'],
      ['label:"Ontology Hub"', 'label:window.__dsosT("Ontology Hub")'],
      ['children:"Ontology Hub"', 'children:window.__dsosT("Ontology Hub")'],
      ['label:"Graph Governance"', 'label:window.__dsosT("Graph Governance")'],
      ['children:"Graph Governance"', 'children:window.__dsosT("Graph Governance")'],
      ['label:"Graph Studio"', 'label:window.__dsosT("Graph Studio")'],
      ['children:"Graph Studio"', 'children:window.__dsosT("Graph Studio")'],
      ['label:"Primary Workspace"', 'label:window.__dsosT("Primary Workspace")'],
      ['children:"Primary Workspace"', 'children:window.__dsosT("Primary Workspace")'],
      ['label:"Intelligence Layer"', 'label:window.__dsosT("Intelligence Layer")'],
      ['children:"Intelligence Layer"', 'children:window.__dsosT("Intelligence Layer")'],
      ['label:"Knowledge Explorer"', 'label:window.__dsosT("Knowledge Explorer")'],
      ['children:"Knowledge Explorer"', 'children:window.__dsosT("Knowledge Explorer")'],
      ['label:"PROV-O Lineage"', 'label:window.__dsosT("PROV-O Lineage")'],
      ['children:"PROV-O Lineage"', 'children:window.__dsosT("PROV-O Lineage")'],
      ['label:"KG Overview"', 'label:window.__dsosT("KG Overview")'],
      ['children:"KG Overview"', 'children:window.__dsosT("KG Overview")'],
      ['label:"Ontology Summary"', 'label:window.__dsosT("Ontology Summary")'],
      ['children:"Ontology Summary"', 'children:window.__dsosT("Ontology Summary")'],
      ['label:"Import & Export"', 'label:window.__dsosT("Import & Export")'],
      ['children:"Import & Export"', 'children:window.__dsosT("Import & Export")'],
      ['label:"Reasoning Playground"', 'label:window.__dsosT("Reasoning Playground")'],
      ['children:"Reasoning Playground"', 'children:window.__dsosT("Reasoning Playground")'],
      ['label:"SPARQL Querying"', 'label:window.__dsosT("SPARQL Querying")'],
      ['children:"SPARQL Querying"', 'children:window.__dsosT("SPARQL Querying")'],
      ['label:"Vocabulary Browser"', 'label:window.__dsosT("Vocabulary Browser")'],
      ['children:"Vocabulary Browser"', 'children:window.__dsosT("Vocabulary Browser")'],
      ['children:"Manage"', 'children:window.__dsosT("Manage")'],
      ['children:"Explore"', 'children:window.__dsosT("Explore")'],
      ['children:"Analyze"', 'children:window.__dsosT("Analyze")'],
      ['children:"Enrich"', 'children:window.__dsosT("Enrich")'],
      ['children:"Decisions"', 'children:window.__dsosT("Decisions")'],
      ['children:"Workspaces"', 'children:window.__dsosT("Workspaces")'],
      ['children:"Vocabulary"', 'children:window.__dsosT("Vocabulary")'],
      ['children:"Registry"', 'children:window.__dsosT("Registry")'],
      ['children:"Search"', 'children:window.__dsosT("Search")'],
      ['children:"Trace"', 'children:window.__dsosT("Trace")'],
      ['children:"Versions"', 'children:window.__dsosT("Versions")'],
      ['children:"Editor"', 'children:window.__dsosT("Editor")'],
      ['children:"Alignments"', 'children:window.__dsosT("Alignments")'],
      ['children:"Health"', 'children:window.__dsosT("Health")'],
      ['children:"Mappings"', 'children:window.__dsosT("Mappings")'],
      ['children:"Classes"', 'children:window.__dsosT("Classes")'],
      ['children:"Concepts"', 'children:window.__dsosT("Concepts")'],
      ['children:"Properties"', 'children:window.__dsosT("Properties")'],
      ['children:"Refresh"', 'children:window.__dsosT("Refresh")'],
      ['children:"Density"', 'children:window.__dsosT("Density")'],
      ['children:"Nodes"', 'children:window.__dsosT("Nodes")'],
      ['children:"Edges"', 'children:window.__dsosT("Edges")'],
      ['children:"Turtle shape editor"', 'children:window.__dsosT("Turtle shape editor")'],
      ['children:"No shapes generated yet."', 'children:window.__dsosT("No shapes generated yet.")'],
      ['children:"Validation report"', 'children:window.__dsosT("Validation report")'],
      ['children:"Validate"', 'children:window.__dsosT("Validate")'],
      ['children:"Create strict SHACL Turtle from ontology structure, inspect shape targets, run validation, and jump from violations back into the graph."', 'children:window.__dsosT("Create strict SHACL Turtle from ontology structure, inspect shape targets, run validation, and jump from violations back into the graph.")'],
      ['label:"SHACL"', 'label:window.__dsosT("SHACL")'],
      ['children:"SHACL"', 'children:window.__dsosT("SHACL")'],
      ['placeholder:"Enter Node ID…"', 'placeholder:window.__dsosT("Enter Node ID…")'],
      ['placeholder:"Enter Node ID..."', 'placeholder:window.__dsosT("Enter Node ID...")'],
      ['children:"Export JSON"', 'children:window.__dsosT("Export JSON")'],
      ['children:"Export MD"', 'children:window.__dsosT("Export MD")'],
      ['children:"PROV-O Lineage Viewer"', 'children:window.__dsosT("PROV-O Lineage Viewer")'],
      ['children:"Enter a Node ID in the toolbar above and click Trace to view its W3C PROV-O lineage diagram."', 'children:window.__dsosT("Enter a Node ID in the toolbar above and click Trace to view its W3C PROV-O lineage diagram.")'],
      ['children:"Load Ontology"', 'children:window.__dsosT("Load Ontology")'],
      ['children:"Entity Search"', 'children:window.__dsosT("Entity Search")'],
      ['placeholder:"Search ontologies by name, URI, or namespace…"', 'placeholder:window.__dsosT("Search ontologies by name, URI, or namespace…")'],
      ['children:"No ontologies loaded yet"', 'children:window.__dsosT("No ontologies loaded yet")'],
      ['children:"Loading workspace…"', 'children:window.__dsosT("Loading workspace…")'],
    ]
    for (const [from, to] of swaps) out = out.replaceAll(from, to)
    out = out
      .replaceAll('"#0A0D11"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('"#0B0E12"', 'window.__dsos("stage","#ffffff")')
      .replaceAll('"#07080B"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('"#08090B"', 'window.__dsos("app","#ffffff")')
      .replaceAll('"#0E1927"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('"#0B0D10"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('"#0B0F15"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('"#050c18"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('"#0a1628"', 'window.__dsos("stage","#ffffff")')
      .replaceAll('"#0a1525"', '"#ffffff"')
      .replaceAll('"#050b13"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('"#1a2d3d"', 'window.__dsos("stage","#ffffff")')
      .replaceAll('"#010409"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('"#21262d"', 'window.__dsos("stage","#ffffff")')
      .replaceAll('"#07111f"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('"#060d1a"', 'window.__dsos("canvas","#ffffff")')
      .replaceAll('rgba(4,10,18,0.88)', '#f6f8fa')
      .replaceAll('vm=function(d){return"/"+d}', `vm=function(d){return"/semantic-os/"+d+"?${ASSET_V}"}`)
      .replaceAll('style:Yl,', 'className:"dsos-onto-hub",style:Yl,')
      .replaceAll('" above."', 'window.__dsosT(" above.")')
      .replaceAll('" SHACL Studio"', 'window.__dsosT(" SHACL Studio")')
      .replaceAll('" Generate strict"', 'window.__dsosT(" Generate strict")')
      .replaceAll('," shapes"]', ',window.__dsosT(" shapes")]')
      .replaceAll('u==="all"?"All"', 'u==="all"?window.__dsosT("All")')
      .replaceAll(',"Validate"]', ',window.__dsosT("Validate")]')
      .replaceAll('||"Turtle shape editor"', '||window.__dsosT("Turtle shape editor")')
      .replaceAll('"Import from a URL, upload a file, or create a new ontology to get started. Click "', 'window.__dsosT("Import from a URL, upload a file, or create a new ontology to get started. Click ")')
      .replaceAll(':"No ontologies loaded yet"', ':window.__dsosT("No ontologies loaded yet")')
      .replaceAll('children:"Generate or edit SHACL Turtle, then run validation."', 'children:window.__dsosT("Generate or edit SHACL Turtle, then run validation.")')
      .replaceAll('"Generate or edit SHACL Turtle, then run validation."', 'window.__dsosT("Generate or edit SHACL Turtle, then run validation.")')
      .replaceAll(',"Load Ontology"]', ',window.__dsosT("Load Ontology")]')
      .replaceAll(',"Entity Search"]', ',window.__dsosT("Entity Search")]')
      .replaceAll('g==="all"?window.__dsosT("All"):g.toUpperCase()', 'g==="all"?window.__dsosT("All"):window.__dsosT(g.toUpperCase())')
      .replaceAll('g==="all"?"All":g.toUpperCase()', 'g==="all"?window.__dsosT("All"):window.__dsosT(g.toUpperCase())')
      .replaceAll('i.useState("Ontology Hub")', 'i.useState(window.__dsosT("Ontology Hub"))')
      .replaceAll('g==="all"?"All"', 'g==="all"?window.__dsosT("All")')
      .replaceAll('_==="scratch"?"From Scratch"', '_==="scratch"?window.__dsosT("From Scratch")')
      .replaceAll('_==="data"?"From Data"', '_==="data"?window.__dsosT("From Data")')
      .replaceAll('label:"Description"', 'label:window.__dsosT("Description")')
      .replaceAll('children:"Source"', 'children:window.__dsosT("Source")')
      .replaceAll('children:"Relation"', 'children:window.__dsosT("Relation")')
      .replaceAll('label:"Display Name *"', 'label:window.__dsosT("Display Name *")')
      .replaceAll('label:"Namespace URI *"', 'label:window.__dsosT("Namespace URI *")')
      .replaceAll('placeholder:"e.g. internal, draft"', 'placeholder:window.__dsosT("e.g. internal, draft")')
      .replaceAll('children:"Ontology"', 'children:window.__dsosT("Ontology")')
      .replaceAll('["Confidence "', '[window.__dsosT("Confidence ")')
      .replaceAll('rgba(5,12,22,0.72)', '#f6f8fa')
      .replaceAll('background:"#0d1117"', 'background:window.__dsos("stage","#ffffff")')
      .replaceAll('background:"#0a1525"', 'background:"#ffffff"')
      .replaceAll('linear-gradient(135deg, rgba(13,17,23,0.75), rgba(22,27,34,0.6))', '#f6f8fa')
      .replaceAll('linear-gradient(135deg, rgba(13,17,23,0.6), rgba(22,27,34,0.4))', '#f6f8fa')
      .replaceAll('rgba(0,0,0,0.22)', '#eef1f4')
      .replaceAll('rgba(0,0,0,0.28)', '#eef1f4')
      .replaceAll('"#0a1525"', '"#ffffff"')
      .replaceAll('rgba(3, 9, 18, 0.84)', '#f6f8fa')
      .replaceAll('rgba(3, 9, 18, 0.92)', '#f6f8fa')
      .replaceAll('rgba(9,19,34,0.78)', '#f6f8fa')
      .replaceAll('rgba(3, 9, 18, 0.8)', '#f6f8fa')
      .replaceAll('rgba(3, 9, 18, 0.88)', '#f6f8fa')
      .replaceAll('rgba(3,9,18,0.5)', '#f6f8fa')
      .replaceAll('rgba(9, 19, 34, 0.8)', '#f6f8fa')
      .replaceAll('rgba(9, 19, 34, 0.95)', '#f6f8fa')
      .replaceAll('rgba(11,21,34,0.98)', '#f6f8fa')
      .replaceAll('rgba(11,25,42,0.94)', '#f6f8fa')
      .replaceAll('rgba(7,14,25,0.9)', '#f6f8fa')
      .replaceAll('rgba(6,13,22,0.96)', '#f6f8fa')
      .replaceAll('rgba(0,0,0,0.24)', '#eef1f4')
      .replaceAll('rgba(0, 0, 0, 0.7)', 'rgba(15,15,15,0.45)')
      .replaceAll('rgba(9, 19, 34, 0.78)', '#f6f8fa')
      .replaceAll('rgba(3,9,18,0.8)', '#f6f8fa')
      .replaceAll('rgba(3,9,18,0.78)', 'rgba(15,15,15,0.45)')
      .replaceAll('rgba(15,35,52,0.88)', '#f6f8fa')
      .replaceAll('rgba(5,12,22,0.6)', '#f6f8fa')
      .replaceAll('linear-gradient(135deg, rgba(11,25,42,0.94), rgba(7,14,25,0.9))', '#f6f8fa')
      .replaceAll('linear-gradient(180deg, rgba(11,21,34,0.98), rgba(6,13,22,0.96))', '#f6f8fa')
      .replaceAll('#8fa8c6', '#3d444d')
      .replaceAll('#6a7f97', '#3d444d')
      .replaceAll('#5a7a9a', '#3d444d')
      .replaceAll('#c6d4e3', '#1f2328')
      .replaceAll('rgba(3, 9, 18, 0.6)', '#f6f8fa')
      .replaceAll('rgba(7, 17, 31, 0.94)', '#f6f8fa')
      .replaceAll('rgba(7, 17, 31, 0.92)', '#f6f8fa')
      .replaceAll('rgba(7, 17, 31, 0.82)', '#f6f8fa')
      .replaceAll('rgba(5, 11, 21, 0.92)', '#ffffff')
      .replaceAll('rgba(14, 18, 24, 0.86)', '#f6f8fa')
      .replaceAll('rgba(8, 11, 15, 0.92)', '#f6f8fa')
  }
  return out
    .replaceAll('#0d1117', '#ffffff')
    .replaceAll('#c9d1d9', '#1f2328')
    .replaceAll('#060d1a', '#ffffff')
    .replaceAll('#07111f', '#ffffff')
    .replaceAll('#091322', '#ffffff')
    .replaceAll('#050b15', '#ffffff')
    .replaceAll('#03070f', '#ffffff')
    .replaceAll('#ebf3ff', '#1f2328')
    .replaceAll('#ddeeff', '#1f2328')
    .replaceAll('#f0f7ff', '#1f2328')
}

/**
 * @param {{
 *   sidecar: { snapshot: Function, retryReady: Function, getApiKey: Function },
 *   getConfig: () => Record<string, unknown>,
 * }} opts
 */
export function createHandler(opts) {
  const { sidecar, getConfig } = opts

  return async function handler(req, res) {
    if (!isTrustedRequest(req) && req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      return json(res, 403, { ok: false, error: 'forbidden' })
    }

    let url
    try {
      url = new URL(req.url || '/', 'http://dsh.local')
    } catch {
      res.writeHead(400)
      res.end()
      return
    }
    const pathname = url.pathname

    const product = await handleProduct(req, res, url, opts)
    if (product !== false) return

    if (pathname === `${PREFIX}/ready` && req.method === 'GET') {
      return json(res, 200, { ok: true, ...publicState(sidecar.snapshot()) })
    }

    if (pathname === `${PREFIX}/retry-ready` && req.method === 'POST') {
      const next = await sidecar.retryReady()
      return json(res, 200, { ok: true, ...publicState(next) })
    }

    if (pathname === `${PREFIX}/settings` && req.method === 'GET') {
      await loadOverlay()
      return json(res, 200, {
        ok: true,
        config: mergeConfig(getConfig()),
        ready: publicState(sidecar.snapshot()),
      })
    }

    if (pathname === `${PREFIX}/settings` && req.method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req, 32 * 1024) || '{}')
        const saved = await saveOverlay(body)
        if (opts.sessionIngest && typeof opts.sessionIngest.reschedule === 'function') {
          opts.sessionIngest.reschedule()
        }
        if (opts.peopleSync && typeof opts.peopleSync.reschedule === 'function') {
          opts.peopleSync.reschedule()
        }
        const roster = Array.isArray(body.people) ? body.people : Array.isArray(body.items) ? body.items : null
        const people = roster ? await savePeople(roster) : null
        return json(res, 200, {
          ok: true,
          config: mergeConfig({ ...getConfig(), ...saved }),
          ...(people ? { people: people.people } : {}),
        })
      } catch (error) {
        return json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    }

    if (pathname === `${PREFIX}/explorer` && (req.method === 'GET' || req.method === 'HEAD')) {
      const cwd = url.searchParams.get('cwd') || header(req.headers, 'x-dsh-cwd') || ''
      if (!cwd || (opts.workspaceAuthority && !(await opts.workspaceAuthority.allows(cwd)))) {
        return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
      }
      return json(res, 410, { ok: false, error: 'GONE', detail: 'semantic tab' })
    }

    const proxied = proxyPath(pathname)
    if (proxied) {
      const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
      const needsCwd = proxied.startsWith('/api') || proxied.startsWith('/_dsh/')
      if (needsCwd && (!cwd || (opts.workspaceAuthority && !(await opts.workspaceAuthority.allows(cwd))))) {
        return json(res, 403, { ok: false, error: 'CWD_NOT_AUTHORIZED' })
      }
      return proxy(req, res, sidecar, proxied + url.search, { rewriteJs: proxied.startsWith('/assets/') })
    }

    const wsHost = pathname.match(/^\/semantic-os\/ws\/(explore|analyze|decisions|io|ontology|admin)(?:\/|$)/)
    if (wsHost) {
      return serveWsHost(req, res, pathname, wsHost[1])
    }

    res.writeHead(404)
    res.end()
  }
}


function serveWsHost(req, res, pathname, kind) {
  const prefix = `${PREFIX}/ws/${kind}`
  const sliced = pathname.slice(prefix.length)
  const rel = sliced.replace(/^\/+/, '') || `${kind}.js`
  const safe = rel.split('/').filter((part) => part && part !== '.' && part !== '..').join('/')
  const root = WS_HOSTS[kind]
  const file = join(root, safe || `${kind}.js`)
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404)
    res.end()
    return
  }
  const types = {
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.html': 'text/html; charset=utf-8',
    '.map': 'application/json',
  }
  res.writeHead(200, {
    'content-type': types[extname(file)] || 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(file).pipe(res)
}

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export function webSocketAccept(key) {
  return createHash('sha1').update(String(key || '') + WS_GUID).digest('base64')
}

export function createUpgradeHandler(sidecar, workspaceAuthority) {
  return async function upgrade(req, socket, head) {
    let url
    try {
      url = new URL(req.url || '/', 'http://dsh.local')
    } catch {
      socket.destroy()
      return
    }
    const cwd = header(req.headers, 'x-dsh-cwd') || url.searchParams.get('cwd') || ''
    if (!cwd || (workspaceAuthority && !(await workspaceAuthority.allows(cwd)))) {
      socket.destroy()
      return
    }
    const key = header(req.headers, 'sec-websocket-key')
    if (!key) {
      socket.destroy()
      return
    }
    const proto = header(req.headers, 'sec-websocket-protocol')
    const lines = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${webSocketAccept(key)}`,
    ]
    if (proto) lines.push(`Sec-WebSocket-Protocol: ${Array.isArray(proto) ? proto[0] : proto}`)
    try {
      socket.write(`${lines.join('\r\n')}\r\n\r\n`)
    } catch {
      socket.destroy()
      return
    }
    socket.on('error', () => { try { socket.destroy() } catch { /* closed */ } })
    socket.on('end', () => { try { socket.destroy() } catch { /* closed */ } })
    void sidecar
    void head
  }
}

function proxyPath(pathname) {
  if (pathname === PREFIX || pathname === `${PREFIX}/`) return null
  if (!pathname.startsWith(`${PREFIX}/`)) return null
  const rest = pathname.slice(PREFIX.length)
  if (rest === '/explorer') return null
  if (rest === '/ws/explore' || rest.startsWith('/ws/explore/')) return null
  if (rest === '/ws/analyze' || rest.startsWith('/ws/analyze/')) return null
  if (rest === '/ws/decisions' || rest.startsWith('/ws/decisions/')) return null
  if (rest === '/ws/admin' || rest.startsWith('/ws/admin/')) return null
  if (rest === '/ws/ontology' || rest.startsWith('/ws/ontology/')) return null
  if (rest === '/ws/io' || rest.startsWith('/ws/io/')) return null
  if (
    rest === '/ready' || rest === '/retry-ready' || rest === '/settings' || rest === '/deps'
    || rest.startsWith('/ingest') || rest.startsWith('/session-ingest') || rest === '/nodes' || rest.startsWith('/settings/')
    || rest === '/python' || rest === '/import' || rest === '/bridge'
    || rest === '/writes' || rest === '/archive-record'
    || rest === '/lineage' || rest === '/export' || rest === '/annotations'
    || rest === '/people' || rest === '/people/left-ids' || rest === '/api/reason'
  ) return null
  if (
    rest.startsWith('/assets')
    || rest === '/favicon.svg'
    || rest === '/icons.svg'
    || rest.startsWith('/ws/')
    || rest.startsWith('/_dsh/')
  ) {
    return rest
  }
  return null
}


function proxy(req, res, sidecar, targetPath, options = {}) {
  const snap = sidecar.snapshot()
  if (!snap.ready || !snap.port) {
    return json(res, 503, { ok: false, error: 'NOT_READY', reason: snap.reason || 'not_ready' })
  }
  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || HOP.has(key.toLowerCase())) continue
    headers[key] = value
  }
  headers.host = `127.0.0.1:${snap.port}`
  delete headers['if-none-match']
  delete headers['if-modified-since']
  delete headers['If-None-Match']
  delete headers['If-Modified-Since']
  if (sidecar.getApiKey()) headers['x-api-key'] = sidecar.getApiKey()
  const cwd = header(req.headers, 'x-dsh-cwd') || new URL(targetPath, 'http://dsh.local').searchParams.get('cwd') || ''
  if (cwd && isLatin1Header(cwd)) headers['x-dsh-cwd'] = cwd
  else delete headers['x-dsh-cwd']
  if (cwd && !isLatin1Header(cwd)) {
    try {
      const next = new URL(targetPath, 'http://dsh.local')
      if (!next.searchParams.get('cwd')) next.searchParams.set('cwd', cwd)
      targetPath = next.pathname + next.search
    } catch { /* keep */ }
  }

  const upstream = httpRequest({
    host: '127.0.0.1',
    port: snap.port,
    path: targetPath,
    method: req.method,
    headers,
  }, (up) => {
    const outHeaders = {}
    for (const [key, value] of Object.entries(up.headers)) {
      if (value === undefined) continue
      const lower = key.toLowerCase()
      if (lower === 'x-frame-options' || lower === 'transfer-encoding') continue
      if (lower === 'etag' || lower === 'last-modified') continue
      outHeaders[key] = value
    }
    const ctype = String(up.headers['content-type'] || '')
    const rewriteJs = options.rewriteJs && /javascript|ecmascript/i.test(ctype)
    const rewriteCss = options.rewriteJs && /css/i.test(ctype)
    if (!rewriteJs && !rewriteCss) {
      res.writeHead(up.statusCode || 502, outHeaders)
      up.pipe(res)
      return
    }
    const chunks = []
    up.on('data', (chunk) => chunks.push(chunk))
    up.on('end', () => {
      let body = Buffer.concat(chunks).toString('utf8')
      if (rewriteJs) {
        body = body
          .replaceAll('"/assets/', '"/semantic-os/assets/')
          .replaceAll("'/assets/", "'/semantic-os/assets/")
          .replaceAll('`/assets/', '`/semantic-os/assets/')
        body = body.replace(/(\/semantic-os\/assets\/[^"'\s?]+)/g, `$1?${ASSET_V}`)
      }
      body = rewriteOfficialColors(body, rewriteJs ? 'js' : 'css')
      if (rewriteJs) body = bustRelativeModuleUrls(body)
      if (rewriteCss) body += `\n${THEME_CSS}`
      const buf = Buffer.from(body, 'utf8')
      delete outHeaders['content-length']
      outHeaders['content-length'] = String(buf.length)
      outHeaders['cache-control'] = 'no-store, no-cache, must-revalidate'
      outHeaders['pragma'] = 'no-cache'
      res.writeHead(up.statusCode || 502, outHeaders)
      res.end(buf)
    })
  })
  upstream.on('error', () => {
    if (!res.headersSent) json(res, 502, { ok: false, error: 'SIDECAR_UNREACHABLE' })
    else res.destroy()
  })
  req.pipe(upstream)
}

