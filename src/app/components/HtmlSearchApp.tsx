"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseMessagesFromHtmlBrowser } from "@/lib/parseHtml.browser";
import { searchMessages } from "@/lib/searchMessages";
import { saveParsedFileBrowser } from "@/lib/storage.browser";

type UploadMeta = {
  fileId: string;
  originalName: string;
  messageCount: number;
  senders: string[];
  minTimestampMs: number | null;
  maxTimestampMs: number | null;
  createdAtMs: number;
};

type SearchHit = {
  id: string;
  sender: string;
  timestampRaw: string;
  timestampMs: number | null;
  text: string;
  snippet: string;
};

type SearchApiResponse = {
  fileId: string;
  meta: UploadMeta;
  total: number;
  offset: number;
  limit: number;
  results: SearchHit[];
  error?: string;
};

function parseDateMs(value: string, mode: "start" | "end"): number | undefined {
  if (!value) return undefined;

  // Support <input type="date"> values (YYYY-MM-DD)
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

function highlightHtml(text: string, q: string): string {
  const query = q.trim();
  if (!query) return escapeHtml(text);

  const safe = escapeHtml(text);
  const re = new RegExp(escapeRegExp(escapeHtml(query)), "ig");
  return safe.replace(re, (m) => `<mark>${m}</mark>`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const re = new RegExp(escapeRegExp(q), "ig");
  const parts: Array<{ value: string; isMatch: boolean }> = [];
  let lastIndex = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ value: text.slice(lastIndex, index), isMatch: false });
    }
    parts.push({ value: text.slice(index, index + match[0].length), isMatch: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ value: text.slice(lastIndex), isMatch: false });
  }

  if (parts.length === 0) return <>{text}</>;

  return (
    <>
      {parts.map((p, i) =>
        p.isMatch ? (
          <mark
            key={i}
            style={{
              background: "rgba(106, 166, 255, 0.25)",
              color: "#f2f4f8",
              padding: "0 2px",
              borderRadius: 4,
            }}
          >
            {p.value}
          </mark>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}

function formatRange(meta: UploadMeta): string {
  if (!meta.minTimestampMs || !meta.maxTimestampMs) return "(date unknown)";
  const a = new Date(meta.minTimestampMs).toLocaleString();
  const b = new Date(meta.maxTimestampMs).toLocaleString();
  return `${a} → ${b}`;
}

export function HtmlSearchApp() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [fileId, setFileId] = useState<string | null>(null);
  const [meta, setMeta] = useState<UploadMeta | null>(null);

  const [q, setQ] = useState("");
  const [sender, setSender] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"parsed" | "original" | "readable">("parsed");

  const [messages, setMessages] = useState<
    Array<{
      id: string;
      sender: string;
      text: string;
      textNorm: string;
      timestampRaw: string;
      timestampMs: number | null;
    }>
  >([]);
  const [originalHtml, setOriginalHtml] = useState<string>("");

  const originalObjectUrlRef = useRef<string | null>(null);
  const readableObjectUrlRef = useRef<string | null>(null);

  const limit = 50;

  const canSearch = Boolean(fileId);

  const senders = useMemo(() => meta?.senders ?? [], [meta]);

  const upload = useCallback(async () => {
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setSearchError(null);
    setResults([]);
    setTotal(0);
    setOffset(0);
    setSelectedId(null);

    try {
      const html = await file.text();

      const parsed = parseMessagesFromHtmlBrowser(html);
      if (parsed.length === 0) {
        setUploadError(
          "No message blocks found. The HTML may not match the expected export format.",
        );
        return;
      }

      const newFileId = crypto.randomUUID();
      const newMeta = await saveParsedFileBrowser({
        fileId: newFileId,
        originalName: file.name,
        messages: parsed,
        originalHtml: html,
      });

      setFileId(newFileId);
      setMeta(newMeta);
      setMessages(parsed);
      setOriginalHtml(html);
      setView("parsed");
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }, [file]);

  const search = useCallback(
    async (offset = 0) => {
      if (!fileId) return;

      setSearching(true);
      setSearchError(null);
      setOffset(offset);

      try {
        const fromMs = parseDateMs(from, "start");
        const toMs = parseDateMs(to, "end");

        const { total, results } = searchMessages(messages, {
          q,
          sender: sender || undefined,
          fromMs,
          toMs,
          offset,
          limit,
        });

        setResults(results);
        setTotal(total);
        setSelectedId(results[0]?.id ?? null);
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        setSearching(false);
      }
    },
    [fileId, q, sender, from, to, limit, messages],
  );

  const selected = useMemo(
    () => results.find((r) => r.id === selectedId) ?? null,
    [results, selectedId],
  );

  const originalIframeSrc = useMemo(() => {
    if (!originalHtml) return null;
    if (originalObjectUrlRef.current) {
      URL.revokeObjectURL(originalObjectUrlRef.current);
      originalObjectUrlRef.current = null;
    }
    const blob = new Blob([originalHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    originalObjectUrlRef.current = url;
    return url;
  }, [originalHtml, fileId]);

  const readableIframeSrc = useMemo(() => {
    if (!fileId || !meta) return null;

    if (readableObjectUrlRef.current) {
      URL.revokeObjectURL(readableObjectUrlRef.current);
      readableObjectUrlRef.current = null;
    }

    const fromMs = parseDateMs(from, "start");
    const toMs = parseDateMs(to, "end");

    const { total, results } = searchMessages(messages, {
      q,
      sender: sender || undefined,
      fromMs,
      toMs,
      offset: 0,
      limit: 5000,
    });

    const title = `Readable View — ${meta.originalName}`;

    const filterSummary = [
      q.trim() ? `q="${escapeHtml(q.trim())}"` : null,
      sender ? `sender="${escapeHtml(sender)}"` : null,
      from ? `from=${escapeHtml(from)}` : null,
      to ? `to=${escapeHtml(to)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

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

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    readableObjectUrlRef.current = url;
    return url;
  }, [fileId, meta, messages, q, sender, from, to]);

  useEffect(() => {
    return () => {
      if (originalObjectUrlRef.current) URL.revokeObjectURL(originalObjectUrlRef.current);
      if (readableObjectUrlRef.current) URL.revokeObjectURL(readableObjectUrlRef.current);
    };
  }, []);

  return (
    <div style={{ maxWidth: 980, width: "100%", margin: "0 auto" }}>
      <header style={{ padding: "28px 0 12px" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>HTML Message Search</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
          Upload an exported HTML file and search it locally in your browser.
        </p>
      </header>

      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 16,
          background: "var(--surface)",
        }}
      >
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>1) Upload</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            type="file"
            accept="text/html,.html,.htm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={upload}
            disabled={!file || uploading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: uploading ? "var(--surface-2)" : "#101826",
              color: uploading ? "var(--muted)" : "var(--foreground)",
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Parsing…" : "Parse in Browser"}
          </button>
        </div>
        {uploadError && (
          <p style={{ margin: "10px 0 0", color: "#b00020" }}>{uploadError}</p>
        )}
        {meta && (
          <div style={{ marginTop: 12, color: "var(--foreground)" }}>
            <div>
              <strong>File:</strong> {meta.originalName}
            </div>
            <div>
              <strong>Messages:</strong> {meta.messageCount}
            </div>
            <div>
              <strong>Date range:</strong> {formatRange(meta)}
            </div>
          </div>
        )}
      </section>

      {fileId && (
        <section
          style={{
            marginTop: 14,
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
            background: "var(--surface)",
          }}
        >
          <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>3) View</h2>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(
              [
                { key: "parsed", label: "Parsed" },
                { key: "readable", label: "Readable HTML" },
                { key: "original", label: "Original HTML" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background:
                    view === t.key ? "rgba(106, 166, 255, 0.12)" : "var(--surface-2)",
                  color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            {view === "readable" && (
              <iframe
                title="Readable HTML"
                sandbox=""
                style={{
                  width: "100%",
                  height: 540,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "var(--surface-2)",
                }}
                src={readableIframeSrc ?? "about:blank"}
              />
            )}

            {view === "original" && (
              <iframe
                title="Original HTML"
                sandbox=""
                style={{
                  width: "100%",
                  height: 540,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  background: "#fff",
                }}
                src={originalIframeSrc ?? "about:blank"}
              />
            )}

            {view === "parsed" && (
              <div style={{ color: "var(--muted)" }}>
                Use the Search section below to browse parsed messages.
              </div>
            )}
          </div>
        </section>
      )}

      <section
        style={{
          marginTop: 14,
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 16,
          background: "var(--surface)",
          opacity: canSearch ? 1 : 0.6,
        }}
      >
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>2) Search</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto",
            gap: 10,
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search text (plain text / substring)"
            disabled={!canSearch}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--foreground)",
            }}
          />
          <select
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            disabled={!canSearch}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--foreground)",
            }}
          >
            <option value="">All senders</option>
            {senders.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            disabled={!canSearch}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--foreground)",
            }}
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={!canSearch}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--foreground)",
            }}
          />
          <button
            onClick={() => search(0)}
            disabled={!canSearch || searching}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: searching ? "var(--surface-2)" : "#101826",
              color: searching ? "var(--muted)" : "var(--foreground)",
              cursor: searching ? "not-allowed" : "pointer",
            }}
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {searchError && (
          <p style={{ margin: "10px 0 0", color: "#b00020" }}>{searchError}</p>
        )}

        <div style={{ marginTop: 12, color: "var(--foreground)" }}>
          <strong>Matches:</strong> {total}
        </div>

        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 12,
          }}
        >
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--surface-2)",
            }}
          >
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              Results (click to view)
            </div>
            <div style={{ maxHeight: 420, overflow: "auto" }}>
              {results.map((r) => {
                const active = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderBottom: "1px solid rgba(36,49,64,0.65)",
                      background: active ? "rgba(106, 166, 255, 0.12)" : "transparent",
                      color: "var(--foreground)",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <strong>{r.sender}</strong>
                      <span style={{ color: "var(--muted)" }}>{r.timestampRaw || ""}</span>
                    </div>
                    <div style={{ marginTop: 6, whiteSpace: "pre-wrap", color: "var(--foreground)" }}>
                      <HighlightedText text={r.snippet} query={q} />
                    </div>
                  </button>
                );
              })}
              {results.length === 0 && (
                <div style={{ padding: 12, color: "var(--muted)" }}>
                  No results yet.
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "var(--surface-2)",
              padding: 12,
              minHeight: 200,
            }}
          >
            <div style={{ color: "var(--muted)", marginBottom: 8 }}>Selected message</div>
            {selected ? (
              <>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <strong>{selected.sender}</strong>
                  <span style={{ color: "var(--muted)" }}>{selected.timestampRaw || ""}</span>
                </div>
                <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  <HighlightedText text={selected.text} query={q} />
                </div>
              </>
            ) : (
              <div style={{ color: "var(--muted)" }}>
                Click a result on the left to view it here.
              </div>
            )}
          </div>
        </div>

        {total > limit && (
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button
              onClick={() => search(Math.max(0, offset - limit))}
              disabled={searching || offset === 0}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              Prev
            </button>
            <button
              onClick={() => search(offset + limit)}
              disabled={searching || offset + limit >= total}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              Next
            </button>
            <div style={{ alignSelf: "center", color: "var(--muted)" }}>
              Showing {offset + 1}–{Math.min(offset + limit, total)}
            </div>
          </div>
        )}
      </section>

      <footer style={{ padding: "20px 0", color: "var(--muted)" }}>
        <small>
          Note: Parsed files are stored locally in your browser (IndexedDB).
        </small>
      </footer>
    </div>
  );
}
