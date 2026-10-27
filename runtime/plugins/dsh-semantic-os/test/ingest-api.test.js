import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const python = process.env.DSH_RUNTIME_PYTHON || process.env.DSH_SEMANTICA_PYTHON || 'python3'

function py(code) {
  const r = spawnSync(python, ['-c', code], {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'python' },
    timeout: 180000,
  })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout)
  return r.stdout.trim()
}

test('native ingest reads Chinese txt md docx xlsx pptx and pdf is not %PDF dump', () => {
  const out = py(`
import json, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, "python")
from openpyxl import Workbook
from pptx import Presentation
from pptx.util import Inches
from docx import Document
from bootstrap import run_ingest_directory, ingest_plain_text

home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = Path(tempfile.mkdtemp())
(cwd / "a.txt").write_text("你好世界。这是文本。", encoding="utf-8")
(cwd / "b.md").write_text("# 标题\\n\\n中文段落。", encoding="utf-8")
doc = Document(); doc.add_paragraph("你好文档表格也能读")
doc.save(cwd / "c.docx")
wb = Workbook(); wb.active["A1"] = "你好表格"; wb.save(cwd / "d.xlsx")
prs = Presentation(); slide = prs.slides.add_slide(prs.slide_layouts[5])
box = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(4), Inches(1))
box.text_frame.text = "你好幻灯片"
prs.save(cwd / "e.pptx")
pdf = cwd / "f.pdf"
pdf.write_bytes(b"%PDF-1.1\\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\\n4 0 obj<< /Length 48 >>stream\\nBT /F1 12 Tf 20 100 Td (Hello PDF) Tj ET\\nendstream\\nendobj\\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\\ntrailer<< /Root 1 0 R >>\\n%%EOF\\n")
got = run_ingest_directory(str(cwd), {"paths": [str(cwd / "a.txt"), str(cwd / "b.md"), str(cwd / "c.docx"), str(cwd / "d.xlsx"), str(cwd / "e.pptx"), str(cwd / "f.pdf")], "nodded": True})
by_name = {row["name"]: next((t["text"] for t in got.get("texts") or [] if t["path"].endswith(row["name"])), "") for row in got.get("files") or []}
pdf_text = ingest_plain_text(pdf)
print(json.dumps({
  "count": got.get("count"),
  "txt": "你好" in by_name.get("a.txt", ""),
  "md": "中文" in by_name.get("b.md", ""),
  "docx": "你好文档" in by_name.get("c.docx", ""),
  "xlsx": "你好表格" in by_name.get("d.xlsx", ""),
  "pptx": "你好幻灯片" in by_name.get("e.pptx", ""),
  "pdf_dump": pdf_text.startswith("%PDF"),
  "pdf_text": pdf_text[:80],
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.count, 6)
  assert.equal(got.txt, true)
  assert.equal(got.md, true)
  assert.equal(got.docx, true)
  assert.equal(got.xlsx, true)
  assert.equal(got.pptx, true)
  assert.equal(got.pdf_dump, false)
})

test('gitignore walk skips ignored files; chosen paths still ingest; second pass skips unchanged mtime', () => {
  const out = py(`
import json, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, "python")
from bootstrap import list_ingest_files, run_ingest_directory
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
root = Path(tempfile.mkdtemp())
(root / ".gitignore").write_text("secret.txt\\n.dsh/\\n", encoding="utf-8")
(root / "notes.md").write_text("公开笔记\\n", encoding="utf-8")
(root / "secret.txt").write_text("不该扫到\\n", encoding="utf-8")
ledger = root / ".dsh" / "lan-assist"
ledger.mkdir(parents=True)
target = ledger / "mail.projection.md"
target.write_text("- 出自 req_1:v1\\n", encoding="utf-8")
walk = [p.name for p in list_ingest_files(str(root), None)]
chosen = [p.name for p in list_ingest_files(str(root), [str(target)])]
first = run_ingest_directory(str(root), {"nodded": True})
second = run_ingest_directory(str(root), {"nodded": True})
print(json.dumps({
  "walk": walk,
  "chosen": chosen,
  "first": first.get("count"),
  "first_skipped": first.get("skipped"),
  "second": second.get("count"),
  "second_skipped": second.get("skipped"),
}, ensure_ascii=False))
`)
  const got = JSON.parse(out)
  assert.equal(got.walk.includes('notes.md'), true)
  assert.equal(got.walk.includes('secret.txt'), false)
  assert.equal(got.chosen.includes('mail.projection.md'), true)
  assert.equal(got.second, 0)
  assert.ok(got.second_skipped >= 1)
})

test('ingest writes provenance sqlite and verify_chain is valid', () => {
  const out = py(`
import json, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, "python")
from semantica.provenance import ProvenanceManager
from bootstrap import run_ingest_directory
home = tempfile.mkdtemp(); os.environ["DSH_HOME"] = home
cwd = Path(tempfile.mkdtemp())
(cwd / "a.txt").write_text("第一份。", encoding="utf-8")
(cwd / "b.txt").write_text("第二份。", encoding="utf-8")
run_ingest_directory(str(cwd), {"nodded": True})
db = cwd / ".dsh" / "provenance.db"
pm = ProvenanceManager(storage_path=str(db))
chain = pm.verify_chain()
print(json.dumps({"exists": db.is_file(), "chain": chain}, ensure_ascii=False, default=str))
`)
  const got = JSON.parse(out)
  assert.equal(got.exists, true)
  const chain = got.chain || {}
  assert.equal(chain.valid, true, JSON.stringify(got.chain))
})

test('add_documents ingest path sets parallel=False', () => {
  const src = readFileSync(new URL('../python/bootstrap.py', import.meta.url), 'utf8')
  const idx = src.indexOf('vs.add_documents')
  assert.ok(idx > 0)
  const slice = src.slice(idx, idx + 280)
  assert.match(slice, /parallel=False/)
})
