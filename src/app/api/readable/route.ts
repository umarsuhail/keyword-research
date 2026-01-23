import { loadParsedFile } from "@/lib/storage";
import { searchMessages } from "@/lib/searchMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNumber(value: string | null, fallback: number): number {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseDateMs(value: string | null, mode: "start" | "end"): number | undefined {
  if (!value) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = mode === "start" ? "T00:00:00.000" : "T23:59:59.999";
    const ms = Date.parse(`${value}${suffix}`);
    return Number.isNaN(ms) ? undefined : ms;
  }

  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightHtml(text: string, q: string): string {
  const query = q.trim();
  if (!query) return escapeHtml(text);

  const safe = escapeHtml(text);
  const re = new RegExp(escapeRegExp(escapeHtml(query)), "ig");
  return safe.replace(re, (m) => `<mark>${m}</mark>`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fileId = url.searchParams.get("fileId");

  if (!fileId) {
    return new Response("Missing query param 'fileId'.", { status: 400 });
  }

  const q = url.searchParams.get("q") ?? "";
  const sender = url.searchParams.get("sender") ?? undefined;
  const fromMs = parseDateMs(url.searchParams.get("from"), "start");
  const toMs = parseDateMs(url.searchParams.get("to"), "end");

  const limit = Math.min(10_000, Math.max(1, parseNumber(url.searchParams.get("limit"), 2_000)));

  try {
    const { meta, messages } = await loadParsedFile(fileId);

    const { total, results } = searchMessages(messages, {
      q,
      sender,
      fromMs,
      toMs,
      offset: 0,
      limit,
    });

    const title = `Readable View — ${meta.originalName}`;

    const toc = results
      .map((r) => {
        const ts = escapeHtml(r.timestampRaw || "");
        const senderEsc = escapeHtml(r.sender);
        const snip = highlightHtml(r.snippet, q);
        return `<a class="toc-item" href="#m-${r.id}"><span class="who">${senderEsc}</span><span class="ts">${ts}</span><div class="snip">${snip}</div></a>`;
      })
      .join("\n");

    const body = results
      .map((r) => {
        const ts = escapeHtml(r.timestampRaw || "");
        const senderEsc = escapeHtml(r.sender);
        const text = highlightHtml(r.text, q);
        return `
<section class="msg" id="m-${r.id}">
  <div class="meta"><span class="who">${senderEsc}</span><span class="ts">${ts}</span></div>
  <div class="text">${text}</div>
</section>`;
      })
      .join("\n");

    const filterSummary = [
      q.trim() ? `q="${escapeHtml(q.trim())}"` : null,
      sender ? `sender="${escapeHtml(sender)}"` : null,
      url.searchParams.get("from") ? `from=${escapeHtml(url.searchParams.get("from")!)}` : null,
      url.searchParams.get("to") ? `to=${escapeHtml(url.searchParams.get("to")!)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root{color-scheme:dark;--bg:#0b0f14;--fg:#f2f4f8;--muted:#a9b2c0;--border:#243140;--surface:#121922;--surface2:#0f141b;--accent:#6aa6ff}
    body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    a{color:inherit;text-decoration:none}
    .wrap{display:grid;grid-template-columns:360px 1fr;min-height:100vh}
    .side{border-right:1px solid var(--border);background:var(--surface2);position:sticky;top:0;align-self:start;height:100vh;overflow:auto}
    .main{padding:18px 18px 60px}
    .head{padding:14px 14px;border-bottom:1px solid var(--border)}
    .head h1{font-size:14px;margin:0 0 6px;color:var(--fg)}
    .head .sub{color:var(--muted);font-size:12px}
    .toc{padding:10px 10px 18px;display:grid;gap:10px}
    .toc-item{border:1px solid rgba(36,49,64,.65);border-radius:12px;padding:10px 10px;background:transparent}
    .toc-item:hover{background:rgba(106,166,255,.10)}
    .who{font-weight:700}
    .ts{margin-left:10px;color:var(--muted);font-size:12px}
    .snip{margin-top:6px;color:var(--fg);white-space:pre-wrap}
    .msg{border:1px solid rgba(36,49,64,.65);border-radius:14px;background:var(--surface);padding:12px;margin:0 0 12px}
    .msg .meta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px}
    .msg .text{white-space:pre-wrap}
    mark{background:rgba(106,166,255,.25);color:var(--fg);padding:0 2px;border-radius:4px}
    @media (max-width: 980px){.wrap{grid-template-columns:1fr}.side{position:relative;height:auto}.main{padding:14px}}
  </style>
</head>
<body>
  <div class="wrap">
    <aside class="side">
      <div class="head">
        <h1>${escapeHtml(meta.originalName)}</h1>
        <div class="sub">Matches: ${total}${filterSummary ? ` · ${filterSummary}` : ""}</div>
        <div class="sub">Tip: click a result to jump</div>
      </div>
      <nav class="toc">
        ${toc || `<div style="padding:10px;color:var(--muted)">No matches.</div>`}
      </nav>
    </aside>
    <main class="main">
      ${body || `<div style="color:var(--muted)">No matches.</div>`}
    </main>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Unknown fileId (not uploaded yet, or data was deleted).", {
      status: 404,
    });
  }
}
