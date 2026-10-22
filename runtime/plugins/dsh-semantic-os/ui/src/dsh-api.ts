import { rewriteApiNode, searchNodes, shouldHideOnCanvas } from "./dsh-graph-label";
import { clearWorkspaceCwd, setWorkspaceCwd, workspaceCwd } from "./dsh-workspace";

const API_PREFIX = "/semantic-os/api/";
const EXPLORER_API_ROOTS = [
  "graph",
  "temporal",
  "enrich",
  "provenance",
  "reason",
  "decisions",
  "import",
  "export",
  "sparql",
  "ontology",
  "vocabulary",
  "analytics",
  "annotations",
];

export type ReasonMode = "forward" | "rete" | "datalog";

export type ApiBridgeOptions = {
  reasonMode?: () => ReasonMode;
  /** Unused: Run is always preview; write only via x-dsh-reason-write. */
  previewOnly?: boolean;
  ioLock?: boolean;
  mergeConfirm?: boolean;
};

function explorerApiRest(path: string): string | null {
  let p = String(path || "").split("?")[0];
  if (p.startsWith("/semantic-os/api/") || p === "/semantic-os/api") {
    p = p.slice("/semantic-os".length);
  }
  if (p === "/api") return "";
  if (!p.startsWith("/api/")) return null;
  return p.slice("/api/".length);
}

function isExplorerApiPath(path: string): boolean {
  const rest = explorerApiRest(path);
  if (rest == null) return false;
  if (!rest) return true;
  return EXPLORER_API_ROOTS.some((root) => rest === root || rest.startsWith(root + "/"));
}

function rewriteUrl(raw: string): string {
  try {
    const url = new URL(raw, window.location.origin);
    if (isExplorerApiPath(url.pathname) && url.pathname.startsWith("/api/")) {
      url.pathname = "/semantic-os" + url.pathname;
      return url.toString();
    }
  } catch {
    /* keep */
  }
  if (isExplorerApiPath(raw.split("?")[0]) && raw.startsWith("/api/")) return "/semantic-os" + raw;
  return raw;
}

function pathnameOf(input: RequestInfo | URL): string {
  try {
    if (typeof input === "string") return new URL(input, window.location.origin).pathname;
    if (input instanceof URL) return input.pathname;
    if (input instanceof Request) return new URL(input.url, window.location.origin).pathname;
  } catch {
    /* keep */
  }
  return "";
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

type ReasonBody = {
  facts?: unknown;
  rules?: unknown;
  mode?: ReasonMode;
  apply_to_graph?: boolean;
  [key: string]: unknown;
};

let lastReasonBody: ReasonBody | null = null;

export function getLastReasonBody(): ReasonBody | null {
  return lastReasonBody ? { ...lastReasonBody } : null;
}

export function clearLastReasonBody(): void {
  lastReasonBody = null;
}

export { graphNonempty };

function patchReasonBody(raw: string, opts: ApiBridgeOptions, writeOn: boolean): string {
  try {
    const body = JSON.parse(raw) as ReasonBody;
    if (opts.reasonMode) body.mode = opts.reasonMode();
    body.apply_to_graph = Boolean(writeOn);
    lastReasonBody = {
      facts: body.facts,
      rules: body.rules,
      mode: body.mode,
      apply_to_graph: body.apply_to_graph,
    };
    return JSON.stringify(body);
  } catch {
    return raw;
  }
}

function isReasonWrite(headers: Headers): boolean {
  return headers.get("x-dsh-reason-write") === "1";
}

function graphNonempty(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const row = payload as Record<string, unknown>;
  if (typeof row.node_count === "number") return row.node_count > 0;
  if (typeof row.nodes === "number") return row.nodes > 0;
  const nodes = row.nodes ?? row.items;
  if (Array.isArray(payload)) return payload.length > 0;
  if (Array.isArray(nodes)) return nodes.length > 0;
  return false;
}

async function interceptImport(
  orig: typeof fetch,
  cwd: string,
  nextInit: RequestInit,
): Promise<Response> {
  const rawBody = nextInit.body;
  let file: File | null = null;
  if (typeof FormData !== "undefined" && rawBody instanceof FormData) {
    const got = rawBody.get("file");
    if (got instanceof File) file = got;
  }
  if (!file) return jsonResponse(400, { detail: "只认 json 或 csv。" });
  const name = file.name || "";
  const ext = name.toLowerCase().split(".").pop();
  if (ext !== "json" && ext !== "csv") {
    return jsonResponse(400, { detail: "只认 json 或 csv。" });
  }
  const text = await file.text();
  let nonempty = false;
  try {
    const listed = await orig(`/semantic-os/nodes?cwd=${encodeURIComponent(cwd)}`, {
      headers: { "x-dsh-cwd": cwd },
    });
    const payload = await listed.json().catch(() => null);
    nonempty = graphNonempty(payload);
  } catch {
    nonempty = false;
  }
  if (nonempty && !window.confirm("图里已有内容。导入会覆盖当前图，确定吗？")) {
    return jsonResponse(400, { detail: "已取消导入。" });
  }
  const res = await orig("/semantic-os/import", {
    method: "POST",
    headers: { "content-type": "application/json", "x-dsh-cwd": cwd },
    body: JSON.stringify({ cwd, filename: name, data: text, confirm: true }),
  });
  if (res.ok) return res;
  const data = await res.json().catch(() => ({}));
  return jsonResponse(res.status || 400, {
    ...data,
    detail: "导入失败，已恢复上一份图。",
  });
}

async function interceptExport(
  orig: typeof fetch,
  cwd: string,
  nextInit: RequestInit,
): Promise<Response> {
  let format = "json";
  try {
    if (typeof nextInit.body === "string") {
      const parsed = JSON.parse(nextInit.body);
      format = String(parsed.format || "json").toLowerCase();
    }
  } catch {
    /* keep */
  }
  if (format !== "json" && format !== "csv") {
    return jsonResponse(400, { detail: "只认 json 或 csv。" });
  }
  const destRaw = window.prompt("绝对路径", "");
  if (destRaw == null) return jsonResponse(400, { detail: "已取消导出。" });
  const destVal = String(destRaw).trim();
  const send = async (confirm: boolean): Promise<Response> => {
    const res = await orig("/semantic-os/export", {
      method: "POST",
      headers: { "content-type": "application/json", "x-dsh-cwd": cwd },
      body: JSON.stringify({
        cwd,
        format,
        dest: destVal || undefined,
        confirm: confirm || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data && data.error === "OUTSIDE_CWD") {
      if (window.confirm("导出路径在当前目录外。确定继续？")) return send(true);
      return jsonResponse(400, { detail: "已取消导出。" });
    }
    if (data && data.error === "REJECT_FORMAT") {
      return jsonResponse(400, { detail: "只认 json 或 csv。" });
    }
    if (!res.ok || (data && data.ok === false)) {
      return jsonResponse(res.status || 400, { detail: data.detail || "只认 json 或 csv。" });
    }
    if (!destVal && data.data != null) {
      const text = typeof data.data === "string" ? data.data : JSON.stringify(data.data, null, 2);
      return new Response(text, {
        status: 200,
        headers: {
          "content-type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="graph.${format}"`,
        },
      });
    }
    return jsonResponse(200, data);
  };
  return send(false);
}

async function interceptMerge(
  orig: typeof fetch,
  nextInput: RequestInfo | URL,
  nextInit: RequestInit,
): Promise<Response> {
  if (!window.confirm("合并不可撤销。确定把这两个实体合成一条？")) {
    return jsonResponse(400, { detail: "已取消合并。" });
  }
  const res = await orig(nextInput as RequestInfo, nextInit);
  if (res.ok) return res;
  const data = await res.json().catch(() => ({}));
  return jsonResponse(res.status || 400, {
    ...data,
    detail: "合并没写成。",
  });
}


function chineseFailFor(path: string): string {
  if (/\/api\/ontology\/shacl\//.test(path)) return "规则没检查成。";
  if (/\/api\/ontology\/registry/.test(path)) return "词表列表没读成。";
  if (/\/api\/provenance/.test(path)) return "血缘没读成。";
  return "";
}

function hasChinese(value: unknown): boolean {
  return typeof value === "string" && /[\u4e00-\u9fff]/.test(value);
}

async function withChineseFail(res: Response, path: string): Promise<Response> {
  const fail = chineseFailFor(path);
  if (!fail || res.ok) return res;
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const detail = hasChinese(row.detail) ? row.detail : fail;
  return jsonResponse(res.status || 400, { ...row, detail });
}


function rewriteGraphPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const row = payload as Record<string, unknown>;
  if (Array.isArray(row.nodes)) {
    const nodes = row.nodes
      .filter((node) => !shouldHideOnCanvas(node as { id?: unknown; type?: unknown; content?: unknown; properties?: Record<string, unknown> }))
      .map((node) => rewriteApiNode(node as { id?: unknown; type?: unknown; content?: unknown; properties?: Record<string, unknown> }));
    return {
      ...row,
      nodes,
      ...(typeof row.count === "number" ? { count: nodes.length } : {}),
      ...(typeof row.total === "number" ? { total: nodes.length } : {}),
      ...(typeof row.node_count === "number" ? { node_count: nodes.length } : {}),
    };
  }
  if (Array.isArray(row.results)) {
    return {
      ...row,
      results: row.results
        .filter((item) => {
          if (!item || typeof item !== "object") return false;
          const hit = item as { node?: Record<string, unknown> };
          const node = hit.node || item;
          return !shouldHideOnCanvas(node as { id?: unknown; type?: unknown; content?: unknown; properties?: Record<string, unknown> });
        })
        .map((item) => {
          if (!item || typeof item !== "object") return item;
          const hit = item as { node?: Record<string, unknown>; score?: number };
          if (!hit.node) return item;
          return { ...hit, node: rewriteApiNode(hit.node as { id?: unknown; type?: unknown; content?: unknown; properties?: Record<string, unknown> }) };
        }),
    };
  }
  if (row.id || row.content || row.properties) {
    return rewriteApiNode(row as { id?: unknown; type?: unknown; content?: unknown; properties?: Record<string, unknown> });
  }
  return payload;
}

async function interceptGraphNodes(orig: typeof fetch, nextInput: RequestInfo | URL, nextInit: RequestInit): Promise<Response> {
  const res = await orig(nextInput as RequestInfo, nextInit);
  if (!res.ok) return res;
  const data = await res.json().catch(() => null);
  return jsonResponse(res.status, rewriteGraphPayload(data));
}

async function interceptGraphSearch(
  orig: typeof fetch,
  cwd: string,
  nextInput: RequestInfo | URL,
  nextInit: RequestInit,
): Promise<Response> {
  let query = "";
  let limit = 8;
  try {
    if (typeof nextInit.body === "string") {
      const parsed = JSON.parse(nextInit.body) as { query?: string; q?: string; limit?: number };
      query = String(parsed.query || parsed.q || "").trim();
      limit = Number(parsed.limit) || 8;
    }
  } catch {
    /* keep */
  }
  const listed = await orig(`/semantic-os/api/graph/nodes?limit=1000`, {
    headers: { "x-dsh-cwd": cwd },
  });
  const payload = await listed.json().catch(() => null);
  const nodes = payload && typeof payload === "object" && Array.isArray((payload as { nodes?: unknown[] }).nodes)
    ? (payload as { nodes: Array<{ id?: unknown; type?: unknown; content?: unknown; properties?: Record<string, unknown> }> }).nodes
    : [];
  const visible = nodes.filter((node) => !shouldHideOnCanvas(node));
  return jsonResponse(200, { results: searchNodes(visible, query, limit) });
}


async function interceptTemporalBounds(orig: typeof fetch, cwd: string): Promise<Response> {
  const res = await orig(`/semantic-os/api/temporal/bounds`, {
    headers: { "x-dsh-cwd": cwd },
  });
  if (!res.ok) {
    return jsonResponse(200, { min: null, max: null, count: 0, empty: true });
  }
  const data = await res.json().catch(() => null);
  return jsonResponse(200, data && typeof data === "object" ? data : { min: null, max: null, count: 0, empty: true });
}

async function interceptTemporalSnapshot(
  orig: typeof fetch,
  cwd: string,
  nextInput: RequestInfo | URL,
  nextInit: RequestInit,
): Promise<Response> {
  const res = await orig(nextInput as RequestInfo, nextInit);
  if (!res.ok) return res;
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") return jsonResponse(res.status, data);
  const row = data as { active_node_ids?: unknown; active_node_count?: number };
  const ids = Array.isArray(row.active_node_ids) ? row.active_node_ids.map((id) => String(id)) : [];
  const listed = await orig(`/semantic-os/api/graph/nodes?limit=1000`, {
    headers: { "x-dsh-cwd": cwd },
  });
  const payload = await listed.json().catch(() => null);
  const nodes = payload && typeof payload === "object" && Array.isArray((payload as { nodes?: unknown[] }).nodes)
    ? (payload as { nodes: Array<{ id?: unknown; type?: unknown; content?: unknown; properties?: Record<string, unknown> }> }).nodes
    : [];
  const hidden = new Set(
    nodes.filter((node) => shouldHideOnCanvas(node)).map((node) => String(node.id || "")).filter(Boolean),
  );
  const visibleIds = ids.filter((id) => !hidden.has(id));
  return jsonResponse(res.status, {
    ...row,
    active_node_ids: visibleIds,
    active_node_count: visibleIds.length,
  });
}

const fetchStack: Array<typeof window.fetch> = [];

export function installApiBridge(cwd: string, opts: ApiBridgeOptions = {}): () => void {
  const boundCwd = String(cwd || "");
  setWorkspaceCwd(boundCwd);
  const orig = window.fetch.bind(window);
  fetchStack.push(orig);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const path = pathnameOf(input);
    if (!isExplorerApiPath(path)) return orig(input, init);
    const requestCwd = workspaceCwd() || boundCwd;
    let nextInput: RequestInfo | URL = input;
    let nextInit: RequestInit = { ...(init || {}) };
    if (typeof input === "string") {
      nextInput = rewriteUrl(input);
    } else if (input instanceof URL) {
      nextInput = rewriteUrl(input.toString());
    } else if (input instanceof Request) {
      nextInput = new Request(rewriteUrl(input.url), input);
    }
    const headers = new Headers(nextInit.headers || (nextInput instanceof Request ? nextInput.headers : undefined));
    const latin1 = Boolean(requestCwd) && !/[\u0100-\uFFFF]/.test(requestCwd);
    if (requestCwd && latin1) headers.set("x-dsh-cwd", requestCwd);
    else headers.delete("x-dsh-cwd");
    nextInit.headers = headers;
    if (requestCwd && !latin1) {
      const addCwd = (raw: string) => {
        if (/[?&]cwd=/.test(raw)) return raw;
        return raw + (raw.includes("?") ? "&" : "?") + "cwd=" + encodeURIComponent(requestCwd);
      };
      if (typeof nextInput === "string") nextInput = addCwd(nextInput);
      else if (nextInput instanceof URL) {
        if (!nextInput.searchParams.get("cwd")) nextInput.searchParams.set("cwd", requestCwd);
      } else if (nextInput instanceof Request) {
        nextInput = new Request(addCwd(nextInput.url), nextInput);
      }
    }

    const rewrittenPath = pathnameOf(nextInput);
    const method = String(nextInit.method || (nextInput instanceof Request ? nextInput.method : "GET")).toUpperCase();
    if (method === "POST" && rewrittenPath.endsWith("/api/reason") && typeof nextInit.body === "string") {
      const writeOn = isReasonWrite(headers);
      nextInit.body = patchReasonBody(nextInit.body, opts, writeOn);
      const req = orig(nextInput as RequestInfo, nextInit);
      return req.then(async (res) => {
        const clone = res.clone();
        const data = await clone.json().catch(() => ({}));
        try {
          if (!res.ok) {
            window.dispatchEvent(new CustomEvent("dsh-reason-failed", { detail: data }));
            return res;
          }
          window.dispatchEvent(new CustomEvent(writeOn ? "dsh-reason-applied" : "dsh-reason-previewed", {
            detail: data,
          }));
        } catch {
          /* ignore */
        }
        return res;
      });
    }
    const chain = path.match(/\/api\/decisions\/([^/]+)\/chain$/);
    if (chain) {
      try {
        window.dispatchEvent(new CustomEvent("dsh-decision-selected", {
          detail: { id: decodeURIComponent(chain[1]) },
        }));
      } catch {
        /* ignore */
      }
    }
    if (opts.ioLock && method === "POST" && /\/api\/import\/?$/.test(path)) {
      return interceptImport(orig, requestCwd, nextInit);
    }
    if (opts.ioLock && method === "POST" && /\/api\/export\/?$/.test(path)) {
      return interceptExport(orig, requestCwd, nextInit);
    }
    if (opts.mergeConfirm && method === "POST" && /\/api\/enrich\/merge\/?$/.test(path)) {
      return interceptMerge(orig, nextInput, nextInit);
    }
    if (method === "GET" && /\/api\/graph\/nodes\/?$/.test(path)) {
      return interceptGraphNodes(orig, nextInput, nextInit);
    }
    if (method === "GET" && /\/api\/temporal\/bounds\/?$/.test(path)) {
      return interceptTemporalBounds(orig, requestCwd);
    }
    if (method === "GET" && /\/api\/temporal\/snapshot\/?$/.test(path)) {
      return interceptTemporalSnapshot(orig, requestCwd, nextInput, nextInit);
    }
    if (method === "POST" && /\/api\/graph\/search\/?$/.test(path)) {
      return interceptGraphSearch(orig, requestCwd, nextInput, nextInit);
    }
    const req = orig(nextInput as RequestInfo, nextInit).catch((err) => {
      const fail = chineseFailFor(path);
      if (fail) return jsonResponse(502, { detail: fail });
      throw err;
    });
    if (method === "GET" && /\/api\/decisions\/?$/.test(path)) {
      return req.then(async (res) => {
        if (res.status !== 422) return withChineseFail(res, path);
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      });
    }
    if (chineseFailFor(path)) {
      return req.then((res) => withChineseFail(res, path));
    }
    return req;
  };
  return () => {
    const idx = fetchStack.lastIndexOf(orig);
    if (idx >= 0) fetchStack.splice(idx, 1);
    window.fetch = fetchStack.length ? fetchStack[fetchStack.length - 1] : orig;
    clearWorkspaceCwd(boundCwd);
  };
}

export { API_PREFIX };
