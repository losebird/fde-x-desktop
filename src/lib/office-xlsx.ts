import ExcelJS from 'exceljs'

export type SheetView = { name: string; rows: string[][] }

function cellText(value: ExcelJS.CellValue): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toLocaleString('zh-CN')
  if (typeof value === 'object') {
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('')
    }
    if ('text' in value && typeof value.text === 'string') return value.text
    if ('formula' in value) {
      if (value.result != null && value.result !== '') return cellText(value.result as ExcelJS.CellValue)
      return `=${value.formula}`
    }
    if ('error' in value) return String(value.error || '')
  }
  return String(value)
}

function parseInput(text: string): ExcelJS.CellValue {
  const trimmed = text.trim()
  if (trimmed === '') return null
  if (trimmed.startsWith('=')) return { formula: trimmed.slice(1) }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  return text
}

export class XlsxPackage {
  private workbook: ExcelJS.Workbook

  constructor(workbook: ExcelJS.Workbook) {
    this.workbook = workbook
  }

  static async fromArrayBuffer(buffer: ArrayBuffer) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    return new XlsxPackage(workbook)
  }

  sheets(): SheetView[] {
    return this.workbook.worksheets.map((ws) => {
      const colCount = Math.max(8, ws.columnCount || 1)
      const rowCount = Math.max(12, ws.rowCount || 1)
      const rows: string[][] = []
      for (let r = 1; r <= rowCount; r += 1) {
        const row: string[] = []
        const excelRow = ws.getRow(r)
        for (let c = 1; c <= colCount; c += 1) {
          row.push(cellText(excelRow.getCell(c).value))
        }
        rows.push(row)
      }
      return { name: ws.name, rows }
    })
  }

  setCell(sheetIndex: number, row0: number, col0: number, text: string) {
    const ws = this.workbook.worksheets[sheetIndex]
    if (!ws) return
    const cell = ws.getRow(row0 + 1).getCell(col0 + 1)
    cell.value = parseInput(text)
  }

  async toUint8Array() {
    const buf = await this.workbook.xlsx.writeBuffer()
    return new Uint8Array(buf)
  }
}
