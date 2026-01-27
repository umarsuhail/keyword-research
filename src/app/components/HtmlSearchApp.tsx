"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseMessagesFromHtmlBrowser } from "@/lib/parseHtml.browser";
import { searchMessages } from "@/lib/searchMessages";
import {
  listStoredFilesBrowser,
  loadParsedFileBrowser,
  saveParsedFileBrowser,
} from "@/lib/storage.browser";

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
  key: string;
  fileId: string;
  fileName: string;
  id: string;
  sender: string;
  timestampRaw: string;
  timestampMs: number | null;
  text: string;
  snippet: string;
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
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);

  const [storedFiles, setStoredFiles] = useState<UploadMeta[]>([]);
  const [searchScope, setSearchScope] = useState<"active" | "all">("active");

  const [fileId, setFileId] = useState<string | null>(null);
  const [meta, setMeta] = useState<UploadMeta | null>(null);

  const [q, setQ] = useState("");
  const [exclude, setExclude] = useState<string>("");
  const [matchMode, setMatchMode] = useState<"substring" | "word">("substring");
  const [sender, setSender] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [offset, setOffset] = useState<number>(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
  const [originals, setOriginals] = useState<Array<{ name: string; html: string }>>([]);
  const [originalIndex, setOriginalIndex] = useState<number>(0);

  const [originalIframeSrc, setOriginalIframeSrc] = useState<string | null>(null);
  const [readableIframeSrc, setReadableIframeSrc] = useState<string | null>(null);
  const [readableAnchorId, setReadableAnchorId] = useState<string | null>(null);
  const originalObjectUrlRef = useRef<string | null>(null);
  const readableObjectUrlRef = useRef<string | null>(null);
  const readableAnchorIdRef = useRef<string | null>(null);

  const limit = 50;

  const canSearch = searchScope === "all" ? storedFiles.length > 0 : Boolean(fileId);

  const senders = useMemo(() => {
    if (searchScope === "all") {
      const all = storedFiles.flatMap((m) => m.senders ?? []);
      return Array.from(new Set(all)).sort();
    }
    return meta?.senders ?? [];
  }, [meta, searchScope, storedFiles]);

  const refreshStoredFiles = useCallback(async () => {
    const all = (await listStoredFilesBrowser()) as UploadMeta[];
    setStoredFiles(all);
    return all;
  }, []);

  const loadActiveFile = useCallback(async (nextFileId: string) => {
    const loaded = await loadParsedFileBrowser(nextFileId);
    setFileId(nextFileId);
    setMeta(loaded.meta as UploadMeta);
    setMessages(loaded.messages);
    setOriginals(loaded.originals);
    setOriginalIndex(0);
  }, []);

  useEffect(() => {
    // Populate stored datasets on first load.
    refreshStoredFiles().then((all) => {
      if (!fileId && all.length) {
        loadActiveFile(all[0].fileId).catch(() => {
          // ignore; user can upload again
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedOriginal = useMemo(() => {
    if (!originals.length) return null;
    const idx = Math.min(Math.max(0, originalIndex), originals.length - 1);
    return originals[idx] ?? null;
  }, [originals, originalIndex]);

  useEffect(() => {
    setOriginalIframeSrc(null);
    if (!selectedOriginal?.html) return;

    const blob = new Blob([selectedOriginal.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    originalObjectUrlRef.current = url;
    setOriginalIframeSrc(url);

    return () => {
      URL.revokeObjectURL(url);
      if (originalObjectUrlRef.current === url) originalObjectUrlRef.current = null;
    };
  }, [selectedOriginal?.html, fileId]);

  useEffect(() => {
    setReadableIframeSrc(null);
    if (!fileId || !meta) return;

    const fromMs = parseDateMs(from, "start");
    const toMs = parseDateMs(to, "end");

    const { total, results } = searchMessages(messages, {
      q,
      exclude,
      matchMode,
      sender: sender || undefined,
      fromMs,
      toMs,
      offset: 0,
      limit: 5000,
    });

    const title = `File View — ${meta.originalName}`;

    const filterSummary = [
      q.trim() ? `q=\"${escapeHtml(q.trim())}\"` : null,
      sender ? `sender=\"${escapeHtml(sender)}\"` : null,
      from ? `from=${escapeHtml(from)}` : null,
      to ? `to=${escapeHtml(to)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const matchIds = new Set(results.map((r) => r.id));

    const toc = results
      .map((r) => {
        const ts = escapeHtml(r.timestampRaw || "");
        const senderEsc = escapeHtml(r.sender);
        const snip = highlightHtml(r.snippet, q);
        return `<a class=\"toc-item\" href=\"#m-${r.id}\"><span class=\"who\">${senderEsc}</span><span class=\"ts\">${ts}</span><div class=\"snip\">${snip}</div></a>`;
      })
      .join("\n");

    const filtered = messages
      .filter((m) => {
        if (sender && m.sender !== sender) return false;
        if (typeof fromMs === "number" && typeof m.timestampMs === "number" && m.timestampMs < fromMs)
          return false;
        if (typeof toMs === "number" && typeof m.timestampMs === "number" && m.timestampMs > toMs)
          return false;
        return true;
      })
      .slice();

    // Oldest first (unknown timestamps at end)
    filtered.sort((a, b) => {
      const av = typeof a.timestampMs === "number" ? a.timestampMs : Number.POSITIVE_INFINITY;
      const bv = typeof b.timestampMs === "number" ? b.timestampMs : Number.POSITIVE_INFINITY;
      return av - bv;
    });

    const body = filtered
      .map((m) => {
        const ts = escapeHtml(m.timestampRaw || "");
        const senderEsc = escapeHtml(m.sender);
        const isHit = matchIds.has(m.id);
        const text = isHit ? highlightHtml(m.text, q) : escapeHtml(m.text);
        return `
<section class=\"msg${isHit ? " hit" : ""}\" id=\"m-${m.id}\">
  <div class=\"meta\"><span class=\"who\">${senderEsc}</span><span class=\"ts\">${ts}</span></div>
  <div class=\"text\">${text}</div>
</section>`;
      })
      .join("\n");

    const html = `<!doctype html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
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
    .msg.hit{border-color:rgba(106,166,255,.55);box-shadow:0 0 0 1px rgba(106,166,255,.25) inset}
    .msg .meta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px}
    .msg .text{white-space:pre-wrap}
    mark{background:rgba(106,166,255,.25);color:var(--fg);padding:0 2px;border-radius:4px}
    @media (max-width: 980px){.wrap{grid-template-columns:1fr}.side{position:relative;height:auto}.main{padding:14px}}
  </style>
</head>
<body>
  <div class=\"wrap\">
    <aside class=\"side\">
      <div class=\"head\">
        <h1>${escapeHtml(meta.originalName)}</h1>
        <div class=\"sub\">Matches: ${total}${filterSummary ? ` · ${filterSummary}` : ""}</div>
        <div class=\"sub\">Tip: click a match to jump</div>
      </div>
      <nav class=\"toc\">
        ${toc || `<div style=\"padding:10px;color:var(--muted)\">No matches.</div>`}
      </nav>
    </aside>
    <main class=\"main\">
      ${body || `<div style=\"color:var(--muted)\">No messages in this filter range.</div>`}
    </main>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    readableObjectUrlRef.current = url;
    const anchor = readableAnchorIdRef.current;
    const hash = anchor ? `#m-${anchor}` : "";
    setReadableIframeSrc(`${url}${hash}`);

    return () => {
      URL.revokeObjectURL(url);
      if (readableObjectUrlRef.current === url) readableObjectUrlRef.current = null;
    };
  }, [fileId, meta, messages, q, exclude, matchMode, sender, from, to]);

  useEffect(() => {
    readableAnchorIdRef.current = readableAnchorId;
    const base = readableObjectUrlRef.current;
    if (!base) return;

    const hash = readableAnchorId ? `#m-${readableAnchorId}` : "";
    setReadableIframeSrc(`${base}${hash}`);
  }, [readableAnchorId]);

  const upload = useCallback(async () => {
    if (!files.length) return;

    setUploading(true);
    setUploadError(null);
    setUploadNote(null);
    setSearchError(null);

    try {
      const created: UploadMeta[] = [];

      for (const file of files) {
        const html = await file.text();
        const parsed = parseMessagesFromHtmlBrowser(html);

        const newFileId =
          typeof crypto?.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const savedMeta = await saveParsedFileBrowser({
          fileId: newFileId,
          originalName: file.name ?? "(unknown)",
          messages: parsed,
          originals: [{ name: file.name ?? "(unknown)", html }],
        });

        created.push(savedMeta as UploadMeta);
      }

      const all = await refreshStoredFiles();

      // Make the newest uploaded file active for viewing.
      const nextActive = created[0]?.fileId ?? all[0]?.fileId;
      if (nextActive) {
        await loadActiveFile(nextActive);
      }

      setResults([]);
      setTotal(0);
      setOffset(0);
      setSelectedKey(null);
      setUploadNote(
        created.length === 1
          ? `Saved 1 dataset: ${created[0]?.originalName ?? "(unknown)"}`
          : `Saved ${created.length} datasets. Use “Search across all stored datasets” to search them together.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUploadError(msg || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [files, loadActiveFile, refreshStoredFiles]);

  const search = useCallback(
    async (nextOffset: number) => {
      if (searchScope === "active" && !fileId) return;
      if (searchScope === "all" && storedFiles.length === 0) return;

      setSearching(true);
      setSearchError(null);
      try {
        const fromMs = parseDateMs(from, "start");
        const toMs = parseDateMs(to, "end");

        if (searchScope === "active") {
          const { total, results } = searchMessages(messages, {
            q,
            exclude,
            matchMode,
            sender: sender || undefined,
            fromMs,
            toMs,
            offset: nextOffset,
            limit,
          });

          const wrapped: SearchHit[] = results.map((r) => ({
            ...r,
            fileId: fileId!,
            fileName: meta?.originalName ?? "(unknown)",
            key: `${fileId!}:${r.id}`,
          }));

          setResults(wrapped);
          setTotal(total);
          setOffset(nextOffset);

          if (wrapped.length === 0) {
            setSelectedKey(null);
          } else if (!wrapped.some((r) => r.key === selectedKey)) {
            setSelectedKey(wrapped[0].key);
          }
          return;
        }

        // Search across all stored datasets (without persisting a combined dataset).
        const fileIds = storedFiles.map((m) => m.fileId);
        const loaded = await Promise.all(
          fileIds.map(async (id) => {
            const v = await loadParsedFileBrowser(id);
            return { fileId: id, meta: v.meta as UploadMeta, messages: v.messages };
          }),
        );

        const merged: SearchHit[] = [];
        for (const entry of loaded) {
          const { results } = searchMessages(entry.messages, {
            q,
            exclude,
            matchMode,
            sender: sender || undefined,
            fromMs,
            toMs,
            offset: 0,
            limit: Math.max(1, entry.messages.length),
          });
          for (const r of results) {
            merged.push({
              ...r,
              fileId: entry.fileId,
              fileName: entry.meta.originalName,
              key: `${entry.fileId}:${r.id}`,
            });
          }
        }

        merged.sort((a, b) => {
          const av = typeof a.timestampMs === "number" ? a.timestampMs : -1;
          const bv = typeof b.timestampMs === "number" ? b.timestampMs : -1;
          return bv - av;
        });

        const totalAll = merged.length;
        const slice = merged.slice(nextOffset, nextOffset + limit);

        setResults(slice);
        setTotal(totalAll);
        setOffset(nextOffset);

        if (slice.length === 0) {
          setSelectedKey(null);
        } else if (!slice.some((r) => r.key === selectedKey)) {
          setSelectedKey(slice[0].key);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setSearchError(msg || "Search failed");
      } finally {
        setSearching(false);
      }
    },
    [
      exclude,
      fileId,
      from,
      limit,
      matchMode,
      messages,
      meta?.originalName,
      q,
      searchScope,
      selectedKey,
      sender,
      storedFiles,
      to,
    ],
  );

  const selected = useMemo(
    () => results.find((r) => r.key === selectedKey) ?? null,
    [results, selectedKey],
  );

  const onSelectResult = useCallback(
    async (hit: SearchHit) => {
      setSelectedKey(hit.key);

      // Prime readable view to jump directly to the selected message.
      setReadableAnchorId(hit.id);
      setView("readable");

      if (hit.fileId && hit.fileId !== fileId) {
        try {
          await loadActiveFile(hit.fileId);
        } catch {
          // ignore
        }
      }
    },
    [fileId, loadActiveFile],
  );

  return (
    <div className="container">
      <header style={{ padding: "28px 0 12px" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>HTML Message Search</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
          Upload exported HTML file(s) and search locally in your browser.
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
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <button
            onClick={upload}
            disabled={!files.length || uploading}
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
        {files.length > 1 && (
          <div style={{ margin: "10px 0 0", color: "var(--muted)" }}>
            <div>
              Selected {files.length} files. They will be saved as separate datasets.
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              {files.map((f) => f.name).join(" · ")}
            </div>
          </div>
        )}
        {uploadNote && (
          <p style={{ margin: "10px 0 0", color: "var(--muted)" }}>{uploadNote}</p>
        )}
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
                    { key: "readable", label: "File View" },
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
                title="File View"
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
              <>
                {originals.length > 1 && (
                  <div style={{ marginBottom: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <label style={{ color: "var(--muted)" }}>
                      Original file:
                      <select
                        value={String(originalIndex)}
                        onChange={(e) => setOriginalIndex(Number(e.target.value) || 0)}
                        style={{
                          marginLeft: 8,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid var(--border)",
                          background: "var(--surface-2)",
                          color: "var(--foreground)",
                        }}
                      >
                        {originals.map((o, idx) => (
                          <option key={o.name + idx} value={String(idx)}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
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
              </>
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

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <label style={{ color: "var(--muted)" }}>
            Active dataset:
            <select
              value={fileId ?? ""}
              onChange={(e) => {
                const next = e.target.value;
                if (next) {
                  loadActiveFile(next).catch(() => {
                    // ignore
                  });
                }
              }}
              disabled={storedFiles.length === 0}
              style={{
                marginLeft: 8,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
              }}
            >
              {storedFiles.length === 0 ? (
                <option value="">(none)</option>
              ) : (
                storedFiles.map((m) => (
                  <option key={m.fileId} value={m.fileId}>
                    {m.originalName}
                  </option>
                ))
              )}
            </select>
          </label>

          <label style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={searchScope === "all"}
              onChange={(e) => setSearchScope(e.target.checked ? "all" : "active")}
              disabled={storedFiles.length === 0}
            />
            Search across all stored datasets ({storedFiles.length})
          </label>
        </div>

        <div
          className="searchGrid"
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
          <input
            value={exclude}
            onChange={(e) => setExclude(e.target.value)}
            placeholder='Exclude text (e.g. "malappuram")'
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
          <select
            value={matchMode}
            onChange={(e) => setMatchMode((e.target.value as "substring" | "word") ?? "substring")}
            disabled={!canSearch}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--foreground)",
            }}
          >
            <option value="substring">Substring match</option>
            <option value="word">Whole word only</option>
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
          className="resultsGrid"
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
                const active = r.key === selectedKey;
                return (
                  <button
                    key={r.key}
                    onClick={() => onSelectResult(r)}
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
                      {searchScope === "all" && (
                        <span style={{ color: "var(--muted)" }}>{r.fileName}</span>
                      )}
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
            <div style={{ color: "var(--muted)", marginBottom: 8 }}>Selected result</div>

            {!selected ? (
              <div style={{ color: "var(--muted)" }}>
                Click a result on the left to open it here.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 10,
                    alignItems: "center",
                  }}
                >
                  <strong>{selected.sender}</strong>
                  {searchScope === "all" && (
                    <span style={{ color: "var(--muted)" }}>{selected.fileName}</span>
                  )}
                  <span style={{ color: "var(--muted)" }}>{selected.timestampRaw || ""}</span>
                  <button
                    onClick={() => {
                      setReadableAnchorId(selected.id);
                      setView("readable");
                    }}
                    style={{
                      marginLeft: "auto",
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--foreground)",
                      cursor: "pointer",
                    }}
                  >
                    Open file at message
                  </button>
                </div>

                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                  <HighlightedText text={selected.text} query={q} />
                </div>

                <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
                  Tip: this opens the full file view and scrolls to the matched message.
                </div>
              </>
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
          Note: Parsed files are stored locally in your browser (IndexedDB). Searching across all loads each dataset
          from IndexedDB on demand.
        </small>
      </footer>

      <style jsx>{`
        .container {
          max-width: 980px;
          width: 100%;
          margin: 0 auto;
          padding: 0 12px;
        }
        @media (min-width: 1000px) {
          .container {
            padding: 0;
          }
        }
        .searchGrid {
          display: grid;
          grid-template-columns: 1.6fr 1fr 1fr 1fr 1fr 1fr auto;
          gap: 10px;
        }
        @media (max-width: 900px) {
          .searchGrid {
            grid-template-columns: 1fr;
          }
        }
        .resultsGrid {
          margin-top: 10px;
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 12px;
        }
        @media (max-width: 900px) {
          .resultsGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
