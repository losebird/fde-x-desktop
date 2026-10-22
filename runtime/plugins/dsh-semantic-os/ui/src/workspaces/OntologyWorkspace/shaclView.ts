import type { ShaclShapeSummary, ShaclValidationResponse } from "./types";

export function asShapeList(raw: unknown): ShaclShapeSummary[] {
  const rows = Array.isArray(raw) ? raw : [];
  const out: ShaclShapeSummary[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const id = String(rec.id || rec.uri || "").trim();
    if (!id) continue;
    const constraints = Array.isArray(rec.constraints) ? rec.constraints.map((item) => String(item)) : [];
    out.push({
      id,
      target_class: String(rec.target_class || rec.targetClass || "") || undefined,
      constraint_count: Number(rec.constraint_count || constraints.length || 0) || 0,
      constraints,
      violation_count: Number(rec.violation_count || 0) || 0,
    });
  }
  return out;
}

export function asRegistry(raw: unknown): { uri: string; name: string }[] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const rec = row as Record<string, unknown>;
      const uri = String(rec.uri || "").trim();
      return { uri, name: String(rec.name || uri) };
    })
    .filter((row) => row.uri);
}

export function asViolations(raw: unknown): ShaclValidationResponse["violations"] {
  const rows = Array.isArray(raw) ? raw : [];
  return rows.filter((row) => row && typeof row === "object") as ShaclValidationResponse["violations"];
}
