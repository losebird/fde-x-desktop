const ENTITY_REPR = /^\s*Entity\s*\(/;

export function isEntityRepr(value: unknown): boolean {
  return typeof value === "string" && ENTITY_REPR.test(value);
}

function parseEntityText(value: string): string | null {
  const match = value.match(/Entity\s*\(\s*text\s*=\s*(['"])((?:\\.|(?!\1).)*)\1/);
  if (!match) return null;
  return match[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export type LabelNode = {
  id?: unknown;
  type?: unknown;
  content?: unknown;
  properties?: Record<string, unknown> | null;
};

function propertyBag(node: LabelNode): Record<string, unknown> {
  return node.properties && typeof node.properties === "object" ? node.properties : {};
}

export function displayLabel(node: LabelNode): string {
  const props = propertyBag(node);
  const id = asTrimmedString(node.id);
  if (id.startsWith("file:")) {
    const base = id.split(/[/\\]/).pop() || id;
    if (base && !isEntityRepr(base)) return base;
  }
  if (id.startsWith("session:")) {
    const snippet = asTrimmedString(props.content) || asTrimmedString(node.content);
    if (snippet) return snippet.split("\n")[0].slice(0, 24);
  }
  const candidates = [props.label, props.name, props.content, node.content, id];
  for (const raw of candidates) {
    const text = asTrimmedString(raw);
    if (!text || isEntityRepr(text)) continue;
    return text;
  }
  for (const raw of candidates) {
    const text = asTrimmedString(raw);
    if (!text || !isEntityRepr(text)) continue;
    const parsed = parseEntityText(text);
    if (parsed) return parsed;
  }
  return id && !isEntityRepr(id) ? id : "节点";
}

const JUNK_TYPES = new Set(["UNKNOWN", "entity", "Entity", "DATE", "PERSON"]);

export function shouldHideOnCanvas(node: LabelNode): boolean {
  const id = asTrimmedString(node.id);
  if (!id) return true;
  const props = propertyBag(node);
  const content = asTrimmedString(node.content) || asTrimmedString(props.content);
  if (isEntityRepr(id) || isEntityRepr(content)) return true;
  const type = asTrimmedString(node.type);
  if (JUNK_TYPES.has(type)) return true;
  return false;
}

export function rewriteApiNode<T extends LabelNode>(node: T): T {
  const label = displayLabel(node);
  const props = { ...(propertyBag(node)) };
  if (!asTrimmedString(props.label) || isEntityRepr(props.label)) props.label = label;
  if (!asTrimmedString(props.name) || isEntityRepr(props.name)) props.name = label;
  if (!asTrimmedString(props.content) || isEntityRepr(props.content)) props.content = label;
  return {
    ...node,
    content: label,
    properties: props,
  };
}

export function scoreSearchHit(node: LabelNode, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const label = displayLabel(node).toLowerCase();
  const id = asTrimmedString(node.id).toLowerCase();
  const type = asTrimmedString(node.type).toLowerCase();
  const props = propertyBag(node);
  const extras = [props.name, props.content, props.label]
    .map((value) => asTrimmedString(value).toLowerCase())
    .filter(Boolean);
  const haystacks = [label, id, type, ...extras];
  let score = 0;
  if (label === q || id === q) score = 1;
  else if (label.startsWith(q) || id.startsWith(q)) score = 0.92;
  else if (haystacks.some((text) => text.includes(q))) score = 0.78;
  if (score <= 0) return 0;
  return Math.min(score, 1);
}

export function searchNodes(nodes: LabelNode[], query: string, limit = 8): Array<{ node: LabelNode; score: number }> {
  return nodes
    .filter((node) => !shouldHideOnCanvas(node))
    .map((node) => ({ node: rewriteApiNode(node), score: scoreSearchHit(node, query) }))
    .filter((row) => row.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return displayLabel(left.node).localeCompare(displayLabel(right.node), "zh");
    })
    .slice(0, limit);
}
