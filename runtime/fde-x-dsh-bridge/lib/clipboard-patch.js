(function () {
  if (window.__fdeWriteClipboard) return

  function fdeCopyToast(message) {
    var text = String(message || '')
    if (!text) return
    var host = document.getElementById('fde-copy-toast-host')
    if (!host) {
      host = document.createElement('div')
      host.id = 'fde-copy-toast-host'
      host.setAttribute('aria-live', 'polite')
      host.style.cssText =
        'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;' +
        'pointer-events:none;max-width:min(92vw,420px)'
      document.body.appendChild(host)
    }
    var el = document.createElement('div')
    el.textContent = text
    el.style.cssText =
      'margin-top:8px;padding:10px 14px;border-radius:10px;font:13px/1.4 system-ui,sans-serif;' +
      'color:#fff;background:rgba(20,20,20,.92);box-shadow:0 4px 24px rgba(0,0,0,.18)'
    host.appendChild(el)
    window.setTimeout(function () {
      el.remove()
    }, 2600)
  }

  window.__fdeWriteClipboard = async function fdeWriteClipboard(text) {
    var value = String(text == null ? '' : text)
    if (!value) {
      fdeCopyToast('没有可复制的内容')
      return false
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(value)
        return true
      } catch (_err) {
        /* DSH stock writeClipboard stops here; we continue to execCommand. */
      }
    }

    try {
      var textarea = document.createElement('textarea')
      textarea.value = value
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '0'
      textarea.style.left = '0'
      textarea.style.width = '2em'
      textarea.style.height = '2em'
      textarea.style.padding = '0'
      textarea.style.border = 'none'
      textarea.style.outline = 'none'
      textarea.style.boxShadow = 'none'
      textarea.style.background = 'transparent'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      textarea.setSelectionRange(0, value.length)
      var copied =
        typeof document.execCommand === 'function' ? document.execCommand('copy') : false
      textarea.remove()
      if (copied) return true
    } catch (_err2) {}

    fdeCopyToast('复制失败，请检查浏览器剪贴板权限')
    return false
  }

  function patchOne(exp) {
    if (!exp || typeof exp.writeClipboard !== 'function') return
    if (exp.writeClipboard.__fdePatched) return
    exp.writeClipboard = function patchedWriteClipboard(text) {
      return window.__fdeWriteClipboard(text)
    }
    exp.writeClipboard.__fdePatched = true
  }

  window.__fdePatchClipboardExport = function fdePatchClipboardExport(exp) {
    patchOne(exp)
    if (exp && exp.default) patchOne(exp.default)
  }
})()
