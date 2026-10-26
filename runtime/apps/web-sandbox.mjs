/** Opaque origin for hosted web HTML/iframes. Browser-safe; no Node imports. */
export const WEB_APP_IFRAME_SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals'
export const WEB_APP_CSP_SANDBOX = `sandbox ${WEB_APP_IFRAME_SANDBOX}`
