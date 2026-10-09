import JSZip from 'jszip'

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function wAttr(el: Element, local: string) {
  return el.getAttributeNS(W_NS, local) || el.getAttribute(`w:${local}`) || el.getAttribute(local) || ''
}

function wKids(el: Element, local: string) {
  return [...el.getElementsByTagNameNS(W_NS, local)]
}

function wChild(el: Element, local: string) {
  return wKids(el, local)[0] || null
}

export type DocxRunStyle = {
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  fontSize?: string
  color?: string
  fontFamily?: string
}

export type DocxRunView = {
  key: string
  text: string
  style: DocxRunStyle
}

export type DocxBlockView = {
  key: string
  kind: 'p' | 'tbl'
  align?: string
  runs: DocxRunView[]
  rows?: DocxRunView[][][]
}

function runStyle(rPr: Element | null): DocxRunStyle {
  if (!rPr) return {}
  const szEl = wChild(rPr, 'sz')
  const colorEl = wChild(rPr, 'color')
  const fonts = wChild(rPr, 'rFonts')
  const half = Number(szEl ? wAttr(szEl, 'val') : '')
  const color = colorEl ? wAttr(colorEl, 'val') : ''
  const font = fonts
    ? (wAttr(fonts, 'eastAsia') || wAttr(fonts, 'ascii') || wAttr(fonts, 'hAnsi'))
    : ''
  return {
    fontWeight: wChild(rPr, 'b') ? '700' : undefined,
    fontStyle: wChild(rPr, 'i') ? 'italic' : undefined,
    textDecoration: wChild(rPr, 'u') ? 'underline' : undefined,
    fontSize: Number.isFinite(half) && half > 0 ? `${half / 2}pt` : undefined,
    color: color && color !== 'auto' && /^[0-9A-Fa-f]{6}$/.test(color) ? `#${color}` : undefined,
    fontFamily: font || undefined,
  }
}

export class DocxPackage {
  private zip: JSZip
  private doc: XMLDocument
  private xmlPath: string
  private textNodes = new Map<string, Element>()

  constructor(zip: JSZip, doc: XMLDocument, xmlPath: string) {
    this.zip = zip
    this.doc = doc
    this.xmlPath = xmlPath
  }

  static async fromArrayBuffer(buffer: ArrayBuffer) {
    const zip = await JSZip.loadAsync(buffer)
    const xmlPath = zip.file('word/document.xml') ? 'word/document.xml' : 'word/document2.xml'
    const file = zip.file(xmlPath)
    if (!file) throw new Error('不是有效的 docx')
    const xml = await file.async('string')
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    if (doc.getElementsByTagName('parsererror').length) throw new Error('docx 正文解析失败')
    return new DocxPackage(zip, doc, xmlPath)
  }

  private captureRun(r: Element, key: string): DocxRunView {
    const texts = wKids(r, 't')
    if (texts[0]) this.textNodes.set(key, texts[0])
    return {
      key,
      text: texts.map((t) => t.textContent || '').join(''),
      style: runStyle(wChild(r, 'rPr')),
    }
  }

  blocks(): DocxBlockView[] {
    this.textNodes.clear()
    const body = this.doc.getElementsByTagNameNS(W_NS, 'body')[0]
    if (!body) return []
    const blocks: DocxBlockView[] = []
    let i = 0
    for (const node of [...body.childNodes]) {
      if (!(node instanceof Element)) continue
      if (node.localName === 'p') {
        const jc = wChild(wChild(node, 'pPr') || node, 'jc')
        const runs = wKids(node, 'r').map((r, ri) => this.captureRun(r, `p${i}-r${ri}`))
        blocks.push({
          key: `p${i}`,
          kind: 'p',
          align: jc ? wAttr(jc, 'val') : undefined,
          runs,
        })
        i += 1
      } else if (node.localName === 'tbl') {
        const rows = wKids(node, 'tr').map((tr, ri) => (
          wKids(tr, 'tc').map((tc, ci) => (
            wKids(tc, 'r').map((r, rk) => this.captureRun(r, `t${i}-r${ri}-c${ci}-k${rk}`))
          ))
        ))
        blocks.push({ key: `t${i}`, kind: 'tbl', runs: [], rows })
        i += 1
      }
    }
    return blocks
  }

  setRunText(runKey: string, text: string) {
    const t = this.textNodes.get(runKey)
    if (!t) return
    t.setAttribute('xml:space', 'preserve')
    t.textContent = text
  }

  async toUint8Array() {
    const xml = new XMLSerializer().serializeToString(this.doc)
    this.zip.file(this.xmlPath, xml)
    return this.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  }
}
