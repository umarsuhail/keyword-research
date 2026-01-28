"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseMessagesFromHtmlBrowser } from "@/lib/parseHtml.browser";
import { searchMessages } from "@/lib/searchMessages";
import {
  listStoredFilesBrowser,
  loadParsedFileBrowser,
  saveParsedFileBrowser,
} from "@/lib/storage.browser";
import type { StoredAsset } from "@/lib/storage.browser";

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
  messageIndex: number | null;
  id: string;
  sender: string;
  timestampRaw: string;
  timestampMs: number | null;
  text: string;
  snippet: string;
};

type AccordionKey = "upload" | "search" | "viewer";

function AccordionSection(args: {
  id: AccordionKey;
  title: string;
  subtitle?: string;
  disabled?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--surface)",
        opacity: args.disabled ? 0.55 : 1,
      }}
    >
      <button
        type="button"
        disabled={Boolean(args.disabled)}
        onClick={() => {
          if (!args.disabled) args.onToggle();
        }}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "16px 14px",
          border: "none",
          background: "transparent",
          cursor: args.disabled ? "not-allowed" : "pointer",
          display: "flex",
          gap: 12,
          alignItems: "baseline",
          justifyContent: "space-between",
          minHeight: 52,
        }}
        aria-expanded={args.open}
        aria-controls={`section-${args.id}`}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--foreground)" }}>{args.title}</div>
          {args.subtitle ? (
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>{args.subtitle}</div>
          ) : null}
        </div>
        <div style={{ color: "var(--muted)", fontSize: 12, flexShrink: 0 }}>{args.open ? "Hide" : "Show"}</div>
      </button>

      {args.open && (
        <div
          id={`section-${args.id}`}
          style={{
            borderTop: "1px solid var(--border)",
            padding: 14,
            background: "var(--surface)",
          }}
        >
          {args.children}
        </div>
      )}
    </section>
  );
}

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

function isLikelyHtmlFile(file: File): boolean {
  const name = (file.name ?? "").toLowerCase();
  if (name.endsWith(".html") || name.endsWith(".htm")) return true;
  const type = (file.type ?? "").toLowerCase();
  return type.includes("text/html");
}

function isExternalUrl(href: string): boolean {
  const v = href.trim().toLowerCase();
  return v.startsWith("http://") || v.startsWith("https://");
}

function isIgnorableHref(href: string): boolean {
  const v = href.trim().toLowerCase();
  if (!v) return true;
  return (
    v.startsWith("#") ||
    v.startsWith("data:") ||
    v.startsWith("mailto:") ||
    v.startsWith("tel:") ||
    v.startsWith("javascript:")
  );
}

function extractUrls(text: string): string[] {
  const re = /https?:\/\/[^\s<>"]+/gi;
  const found = text.match(re) ?? [];
  const uniq = new Set(found.map((u) => u.replace(/[).,;]+$/g, "")));
  return Array.from(uniq);
}

function findLocalRefsInHtml(html: string): string[] {
  const refs: string[] = [];
  const re = /(src|href)=("|')([^"']+)(\2)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = (m[3] ?? "").trim();
    if (!raw || isIgnorableHref(raw) || isExternalUrl(raw)) continue;
    refs.push(raw);
  }
  return Array.from(new Set(refs));
}

function fileKey(file: File): string {
  const withRel = file as File & { webkitRelativePath?: string };
  const rel = typeof withRel.webkitRelativePath === "string" ? withRel.webkitRelativePath : "";
  return (rel || file.name || "").toString();
}

function buildAssetAliasMap(assets: StoredAsset[]): Map<string, StoredAsset> {
  const map = new Map<string, StoredAsset>();
  for (const a of assets) {
    const key = (a.key ?? "").toLowerCase();
    const name = (a.name ?? "").toLowerCase();
    const base = (a.name ?? "").split(/[\\/]/).pop()?.toLowerCase() ?? "";
    if (key) map.set(key, a);
    if (name) map.set(name, a);
    if (base) map.set(base, a);
  }
  return map;
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
  const [replaceOnName, setReplaceOnName] = useState(true);

  const [openSections, setOpenSections] = useState<Set<AccordionKey>>(
    () => new Set<AccordionKey>(["upload", "search"]),
  );

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
  const [tocMode, setTocMode] = useState<"filtered" | "full">("filtered");

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
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [originalIndex, setOriginalIndex] = useState<number>(0);

  const [originalIframeSrc, setOriginalIframeSrc] = useState<string | null>(null);
  const [readableIframeSrc, setReadableIframeSrc] = useState<string | null>(null);
  const [readableAnchorId, setReadableAnchorId] = useState<string | null>(null);
  const originalObjectUrlRef = useRef<string | null>(null);
  const originalAssetObjectUrlsRef = useRef<string[]>([]);
  const readableObjectUrlRef = useRef<string | null>(null);
  const readableAnchorIdRef = useRef<string | null>(null);
  const parsedListRef = useRef<HTMLDivElement | null>(null);

  const limit = 50;

  const canSearch = searchScope === "all" ? storedFiles.length > 0 : Boolean(fileId);

  const toggleSection = useCallback((key: AccordionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const ensureSectionOpen = useCallback((key: AccordionKey) => {
    setOpenSections((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const orderedMessages = useMemo(() => {
    const ordered = messages.slice();
    // Oldest first (unknown timestamps at end)
    ordered.sort((a, b) => {
      const av = typeof a.timestampMs === "number" ? a.timestampMs : Number.POSITIVE_INFINITY;
      const bv = typeof b.timestampMs === "number" ? b.timestampMs : Number.POSITIVE_INFINITY;
      return av - bv;
    });
    return ordered;
  }, [messages]);

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < orderedMessages.length; i++) {
      map.set(orderedMessages[i]!.id, i + 1);
    }
    return map;
  }, [orderedMessages]);

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
    setAssets(loaded.assets ?? []);
    setOriginalIndex(0);
    ensureSectionOpen("viewer");
  }, [ensureSectionOpen]);

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

    // Re-write HTML so local attachments (images/videos/etc) can render from IndexedDB blobs.
    // Also ensure external links open in a new tab.
    const parser = new DOMParser();
    const doc = parser.parseFromString(selectedOriginal.html, "text/html");
    const aliasMap = buildAssetAliasMap(assets);

    // Clean up previous asset object URLs.
    for (const u of originalAssetObjectUrlsRef.current) {
      URL.revokeObjectURL(u);
    }
    originalAssetObjectUrlsRef.current = [];

    const makeBlobUrlFor = (ref: string): string | null => {
      const raw = ref.trim();
      if (!raw || isIgnorableHref(raw) || isExternalUrl(raw)) return null;
      const lower = raw.toLowerCase();
      const base = raw.split(/[\\/]/).pop()?.toLowerCase() ?? "";
      const match = aliasMap.get(lower) ?? aliasMap.get(base);
      if (!match) return null;
      const url = URL.createObjectURL(match.blob);
      originalAssetObjectUrlsRef.current.push(url);
      return url;
    };

    // Update anchors.
    for (const a of Array.from(doc.querySelectorAll("a[href]"))) {
      const href = a.getAttribute("href") ?? "";
      if (!href) continue;
      if (isExternalUrl(href)) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        continue;
      }
      const blobUrl = makeBlobUrlFor(href);
      if (blobUrl) {
        a.setAttribute("href", blobUrl);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      }
    }

    // Update common media elements.
    for (const el of Array.from(doc.querySelectorAll("img[src], video[src], audio[src], source[src]"))) {
      const src = el.getAttribute("src") ?? "";
      if (!src) continue;
      const blobUrl = makeBlobUrlFor(src);
      if (blobUrl) {
        el.setAttribute("src", blobUrl);
      }
    }

    // Some exports use <video><source src=...></video> with controls missing.
    for (const v of Array.from(doc.querySelectorAll("video"))) {
      if (!v.getAttribute("controls")) v.setAttribute("controls", "");
    }

    const serialized = `<!doctype html>\n${doc.documentElement.outerHTML}`;

    const blob = new Blob([serialized], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    originalObjectUrlRef.current = url;
    setOriginalIframeSrc(url);

    return () => {
      URL.revokeObjectURL(url);
      for (const u of originalAssetObjectUrlsRef.current) {
        URL.revokeObjectURL(u);
      }
      originalAssetObjectUrlsRef.current = [];
      if (originalObjectUrlRef.current === url) originalObjectUrlRef.current = null;
    };
  }, [assets, selectedOriginal?.html, fileId]);

  useEffect(() => {
    setReadableIframeSrc(null);
    if (!fileId || !meta) return;

    const fromMs = parseDateMs(from, "start");
    const toMs = parseDateMs(to, "end");

    const fullHits = searchMessages(messages, {
      q,
      exclude,
      matchMode,
      offset: 0,
      // Best-effort: include all hits in TOC; rendering full file is handled separately.
      limit: Math.max(1, messages.length),
    });

    const filteredHits = searchMessages(messages, {
      q,
      exclude,
      matchMode,
      sender: sender || undefined,
      fromMs,
      toMs,
      offset: 0,
      // Best-effort: include all hits in TOC; rendering full file is handled separately.
      limit: Math.max(1, messages.length),
    });

    const activeHits = tocMode === "full" ? fullHits : filteredHits;

    const title = `File View — ${meta.originalName}`;

    const filterSummary = [
      q.trim() ? `q=\"${escapeHtml(q.trim())}\"` : null,
      exclude.trim() ? `exclude=\"${escapeHtml(exclude.trim())}\"` : null,
      matchMode ? `mode=${escapeHtml(matchMode)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const resultsSummary = [
      sender ? `sender=\"${escapeHtml(sender)}\"` : null,
      from ? `from=${escapeHtml(from)}` : null,
      to ? `to=${escapeHtml(to)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const matchIds = new Set(activeHits.results.map((r) => r.id));

    const toc = activeHits.results
      .map((r) => {
        const ts = escapeHtml(r.timestampRaw || "");
        const senderEsc = escapeHtml(r.sender);
        const snip = highlightHtml(r.snippet, q);
        const idx = indexById.get(r.id);
        const idxHtml = typeof idx === "number" ? `<span class=\"idx\">#${idx}</span>` : "";
        return `<a class=\"toc-item\" href=\"#m-${r.id}\">${idxHtml}<span class=\"who\">${senderEsc}</span><span class=\"ts\">${ts}</span><div class=\"snip\">${snip}</div></a>`;
      })
      .join("\n");

    const body = orderedMessages
      .map((m) => {
        const ts = escapeHtml(m.timestampRaw || "");
        const senderEsc = escapeHtml(m.sender);
        const isHit = matchIds.has(m.id);
        const text = isHit ? highlightHtml(m.text, q) : escapeHtml(m.text);
        const urls = extractUrls(m.text);
        const links = urls.length
          ? `<div class=\"links\">${urls
              .map(
                (u) =>
                  `<a class=\"link\" href=\"${escapeHtml(u)}\" target=\"_blank\" rel=\"noopener noreferrer\">${escapeHtml(u)}</a>`,
              )
              .join(" ")}</div>`
          : "";
        const idx = indexById.get(m.id);
        const idxHtml = typeof idx === "number" ? `<span class=\"idx\">#${idx}</span>` : "";
        return `
<section class=\"msg${isHit ? " hit" : ""}\" id=\"m-${m.id}\">
  <div class=\"meta\">${idxHtml}<span class=\"who\">${senderEsc}</span><span class=\"ts\">${ts}</span></div>
  <div class=\"text\">${text}</div>
  ${links}
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
    .idx{display:inline-block;margin-right:8px;padding:1px 8px;border:1px solid rgba(36,49,64,.8);border-radius:999px;color:var(--muted);font-size:12px}
    .who{font-weight:700}
    .ts{margin-left:10px;color:var(--muted);font-size:12px}
    .snip{margin-top:6px;color:var(--fg);white-space:pre-wrap}
    .msg{border:1px solid rgba(36,49,64,.65);border-radius:14px;background:var(--surface);padding:12px;margin:0 0 12px}
    .msg.hit{border-color:rgba(106,166,255,.55);box-shadow:0 0 0 1px rgba(106,166,255,.25) inset}
    .msg .meta{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px}
    .msg .text{white-space:pre-wrap}
    .links{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px}
    .link{display:inline-block;padding:4px 8px;border:1px solid rgba(36,49,64,.65);border-radius:999px;color:var(--fg);background:rgba(106,166,255,.08)}
    mark{background:rgba(106,166,255,.25);color:var(--fg);padding:0 2px;border-radius:4px}
    @media (max-width: 980px){.wrap{grid-template-columns:1fr}.side{position:relative;height:auto}.main{padding:14px}}
  </style>
</head>
<body>
  <div class=\"wrap\">
    <aside class=\"side\">
      <div class=\"head\">
        <h1>${escapeHtml(meta.originalName)}</h1>
        <div class=\"sub\">TOC: ${tocMode === "full" ? "full-file" : "filtered"} (${activeHits.total}) · Full-file matches: ${fullHits.total}${filterSummary ? ` · ${filterSummary}` : ""}</div>
        ${resultsSummary ? `<div class=\"sub\">Results filters (left panel): ${resultsSummary}</div>` : ""}
        <div class=\"sub\">Tip: click a match to jump</div>
      </div>
      <nav class=\"toc\">
        ${toc || `<div style=\"padding:10px;color:var(--muted)\">No matches for this TOC mode.</div>`}
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
  }, [
    exclude,
    fileId,
    from,
    indexById,
    matchMode,
    messages,
    meta,
    orderedMessages,
    q,
    sender,
    to,
    tocMode,
  ]);

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

      const existing = await refreshStoredFiles();
      const byName = new Map<string, UploadMeta>();
      for (const m of existing) {
        byName.set((m.originalName ?? "").trim().toLowerCase(), m);
      }

      const htmlFiles = files.filter(isLikelyHtmlFile);
      const assetFiles = files.filter((f) => !isLikelyHtmlFile(f));
      const assetByKey = new Map<string, File>();
      for (const f of assetFiles) {
        const key = fileKey(f).toLowerCase();
        const name = (f.name || "").toLowerCase();
        if (key) assetByKey.set(key, f);
        if (name) assetByKey.set(name, f);
        const base = (f.name || "").split(/[\\/]/).pop()?.toLowerCase() ?? "";
        if (base) assetByKey.set(base, f);
      }

      if (htmlFiles.length === 0) {
        throw new Error("Please select at least one Instagram export HTML file. (You can also include photos/videos so attachments render.)");
      }

      for (const file of htmlFiles) {
        const html = await file.text();
        const parsed = parseMessagesFromHtmlBrowser(html);

        const name = file.name ?? "(unknown)";
        const existingMatch = byName.get(name.trim().toLowerCase());
        const newFileId =
          replaceOnName && existingMatch
            ? existingMatch.fileId
            : typeof crypto?.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        const refs = findLocalRefsInHtml(html);
        const used = new Map<string, File>();
        for (const r of refs) {
          const lower = r.toLowerCase();
          const base = r.split(/[\\/]/).pop()?.toLowerCase() ?? "";
          const f = assetByKey.get(lower) ?? assetByKey.get(base);
          if (f) {
            const k = fileKey(f).toLowerCase();
            used.set(k, f);
          }
        }

        const assetsToStore: StoredAsset[] = Array.from(used.values()).map((f) => ({
          key: fileKey(f) || f.name,
          name: f.name,
          type: f.type || "application/octet-stream",
          blob: f,
        }));

        const savedMeta = await saveParsedFileBrowser({
          fileId: newFileId,
          originalName: name,
          messages: parsed,
          originals: [{ name, html }],
          assets: assetsToStore,
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
          ? `Saved 1 dataset: ${created[0]?.originalName ?? "(unknown)"}${replaceOnName ? " (replaced if name matched)" : ""}`
          : `Saved ${created.length} datasets.${replaceOnName ? " (replaced any existing name matches)" : ""} Use “Search across all stored datasets” to search them together.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUploadError(msg || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [files, loadActiveFile, refreshStoredFiles, replaceOnName]);

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
            messageIndex: indexById.get(r.id) ?? null,
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
          const ordered = entry.messages.slice();
          ordered.sort((a, b) => {
            const av = typeof a.timestampMs === "number" ? a.timestampMs : Number.POSITIVE_INFINITY;
            const bv = typeof b.timestampMs === "number" ? b.timestampMs : Number.POSITIVE_INFINITY;
            return av - bv;
          });
          const idxById = new Map<string, number>();
          for (let i = 0; i < ordered.length; i++) {
            idxById.set(ordered[i]!.id, i + 1);
          }

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
              messageIndex: idxById.get(r.id) ?? null,
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
      indexById,
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

      // Jump directly to the selected message.
      setReadableAnchorId(hit.id);
      setView("readable");
      ensureSectionOpen("viewer");
      ensureSectionOpen("search");

      if (hit.fileId && hit.fileId !== fileId) {
        try {
          await loadActiveFile(hit.fileId);
        } catch {
          // ignore
        }
      }
    },
    [ensureSectionOpen, fileId, loadActiveFile],
  );

  const jumpToParsed = useCallback((messageId: string) => {
    ensureSectionOpen("viewer");
    setView("parsed");
    requestAnimationFrame(() => {
      const el = document.getElementById(`pm-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (parsedListRef.current) {
        parsedListRef.current.scrollTop = 0;
      }
    });
  }, [ensureSectionOpen]);

  const clearSearch = useCallback(() => {
    setQ("");
    setExclude("");
    setSender("");
    setFrom("");
    setTo("");
    setMatchMode("substring");
    setResults([]);
    setTotal(0);
    setOffset(0);
    setSelectedKey(null);
  }, []);

  return (
    <div className="container">
      <header style={{ padding: "28px 0 12px" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>HTML Message Search</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
          Upload exported HTML file(s) and search locally in your browser.
        </p>
      </header>

      <div style={{ display: "grid", gap: 12 }}>
              <AccordionSection
                id="upload"
                title="1) Upload"
                subtitle={`Select one or more .html exports. Stored locally in your browser. ${storedFiles.length ? `${storedFiles.length} dataset(s) saved.` : ""}`}
                open={openSections.has("upload")}
                onToggle={() => toggleSection("upload")}
              >
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="file"
                    accept="text/html,.html,.htm,image/*,video/*,audio/*"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />

                  <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }}>
                    <input
                      type="checkbox"
                      checked={replaceOnName}
                      onChange={(e) => setReplaceOnName(e.target.checked)}
                    />
                    Replace existing dataset if filename matches
                  </label>

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
                    {uploading ? "Uploading…" : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
                  </button>
                </div>

                {files.length > 0 && (
                  <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
                    Selected: {files.length} file(s). Tip: include media files from the export so attachments render.
                  </div>
                )}

                {uploadNote && <p style={{ margin: "10px 0 0", color: "var(--muted)" }}>{uploadNote}</p>}
                {uploadError && <p style={{ margin: "10px 0 0", color: "#b00020" }}>{uploadError}</p>}

                {meta && (
                  <div style={{ marginTop: 12, color: "var(--foreground)" }}>
                    <div>
                      <strong>Active dataset:</strong> {meta.originalName}
                    </div>
                    <div>
                      <strong>Messages:</strong> {meta.messageCount}
                    </div>
                    <div>
                      <strong>Range:</strong> {formatRange(meta)}
                    </div>
                  </div>
                )}
              </AccordionSection>

              <AccordionSection
                id="search"
                title="2) Search"
                subtitle="Keyword + sender + date range. Click a hit to jump to that exact message in the file viewer."
                disabled={!canSearch}
                open={openSections.has("search")}
                onToggle={() => toggleSection("search")}
              >
        <div className="searchHeaderRow">
          <label className="activeDatasetLabel" style={{ color: "var(--muted)" }}>
            Active dataset:
            <select
              className="datasetSelect"
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

          <label className="scopeToggle" style={{ color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={searchScope === "all"}
              onChange={(e) => setSearchScope(e.target.checked ? "all" : "active")}
              disabled={storedFiles.length === 0}
            />
            Search across all stored datasets ({storedFiles.length})
          </label>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            search(0);
          }}
        >
          <div className="searchGrid">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Keyword(s)"
              disabled={!canSearch}
              style={{
                padding: "12px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
                fontSize: 16,
              }}
            />
            <input
              value={exclude}
              onChange={(e) => setExclude(e.target.value)}
              placeholder='Exclude text (optional)'
              disabled={!canSearch}
              style={{
                padding: "12px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
                fontSize: 16,
              }}
            />
            <select
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              disabled={!canSearch}
              style={{
                padding: "12px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
                fontSize: 16,
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
                padding: "12px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
                fontSize: 16,
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
                padding: "12px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
                fontSize: 16,
              }}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={!canSearch}
              style={{
                padding: "12px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
                fontSize: 16,
              }}
            />
            <button
              type="submit"
              disabled={!canSearch || searching}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: searching ? "var(--surface-2)" : "#101826",
                color: searching ? "var(--muted)" : "var(--foreground)",
                cursor: searching ? "not-allowed" : "pointer",
                minHeight: 44,
              }}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={clearSearch}
              disabled={!canSearch}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--foreground)",
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              Clear filters
            </button>
          </div>
        </form>

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
            <div className="resultsListScroll">
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
                      padding: "12px 12px",
                      border: "none",
                      borderBottom: "1px solid rgba(36,49,64,0.65)",
                      background: active ? "rgba(106, 166, 255, 0.12)" : "transparent",
                      color: "var(--foreground)",
                      cursor: "pointer",
                      minHeight: 56,
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {typeof r.messageIndex === "number" ? (
                        <span style={{ color: "var(--muted)" }}>#{r.messageIndex}</span>
                      ) : null}
                      <strong>{r.sender}</strong>
                      {searchScope === "all" && (
                        <span style={{ color: "var(--muted)" }}>{r.fileName}</span>
                      )}
                      <span style={{ color: "var(--muted)" }}>{r.timestampRaw || ""}</span>
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        whiteSpace: "pre-wrap",
                        color: "var(--foreground)",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                      }}
                    >
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
                  className="selectedHeader"
                >
                  {typeof selected.messageIndex === "number" ? (
                    <span style={{ color: "var(--muted)" }}>#{selected.messageIndex}</span>
                  ) : null}
                  <strong>{selected.sender}</strong>
                  {searchScope === "all" && (
                    <span style={{ color: "var(--muted)" }}>{selected.fileName}</span>
                  )}
                  <span style={{ color: "var(--muted)" }}>{selected.timestampRaw || ""}</span>
                  <button
                    className="openAtButton"
                    onClick={() => {
                      onSelectResult(selected);
                    }}
                    style={{
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
                  <button
                    onClick={() => jumpToParsed(selected.id)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                      color: "var(--foreground)",
                      cursor: "pointer",
                    }}
                  >
                    Jump in Parsed list
                  </button>
                </div>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
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
          <div className="paginationRow" style={{ marginTop: 12, display: "flex", gap: 10 }}>
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
        </AccordionSection>

        <AccordionSection
          id="viewer"
          title="3) File Viewer"
          subtitle={
            fileId && meta
              ? `${meta.originalName} · ${meta.messageCount} messages`
              : "Open a dataset to view messages"
          }
          disabled={!fileId}
          open={openSections.has("viewer")}
          onToggle={() => toggleSection("viewer")}
        >
          {!fileId ? (
            <div style={{ color: "var(--muted)" }}>Upload or select a dataset to view it.</div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(
                  [
                    { key: "readable", label: "File View" },
                    { key: "parsed", label: "Parsed (scrollable)" },
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

              {view === "readable" && (
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ color: "var(--muted)" }}>TOC mode:</span>
                  {(
                    [
                      { key: "filtered", label: "Filtered" },
                      { key: "full", label: "Full-file" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setTocMode(m.key)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background:
                          tocMode === m.key ? "rgba(106, 166, 255, 0.12)" : "var(--surface-2)",
                        color: "var(--foreground)",
                        cursor: "pointer",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 12 }}>
                {view === "readable" && (
                  <iframe
                    title="File View"
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                    style={{
                      width: "100%",
                      height: "min(70vh, 540px)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      background: "var(--surface-2)",
                    }}
                    src={readableIframeSrc ?? "about:blank"}
                  />
                )}

                {view === "parsed" && (
                  <div
                    ref={parsedListRef}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      background: "var(--surface-2)",
                      maxHeight: "min(70vh, 540px)",
                      overflow: "auto",
                      padding: 10,
                    }}
                  >
                    {orderedMessages.map((m, idx) => (
                      <div
                        key={m.id}
                        id={`pm-${m.id}`}
                        style={{
                          padding: "10px 10px",
                          borderRadius: 12,
                          border: "1px solid rgba(36,49,64,0.65)",
                          marginBottom: 10,
                          background: "transparent",
                        }}
                      >
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: "var(--muted)" }}>
                          <span>#{idx + 1}</span>
                          <strong style={{ color: "var(--foreground)" }}>{m.sender}</strong>
                          <span>{m.timestampRaw || ""}</span>
                        </div>
                        <div style={{ marginTop: 6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                          <HighlightedText text={m.text} query={q} />
                        </div>
                      </div>
                    ))}
                    {orderedMessages.length === 0 && (
                      <div style={{ padding: 12, color: "var(--muted)" }}>No parsed messages loaded.</div>
                    )}
                  </div>
                )}

                {view === "original" && (
                  <>
                    {originals.length > 1 && (
                      <div style={{ marginBottom: 10 }}>
                        <label
                          style={{
                            color: "var(--muted)",
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          Original file:
                          <select
                            value={String(originalIndex)}
                            onChange={(e) => setOriginalIndex(Number(e.target.value) || 0)}
                            style={{
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
                      sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                      style={{
                        width: "100%",
                        height: "min(70vh, 540px)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        background: "#fff",
                      }}
                      src={originalIframeSrc ?? "about:blank"}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </AccordionSection>
      </div>

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
        @media (max-width: 980px) {
          .searchGrid {
            grid-template-columns: 1fr;
          }
        }

        .searchHeaderRow {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }

        .activeDatasetLabel {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .datasetSelect {
          max-width: 100%;
        }

        .selectedHeader {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .openAtButton {
          margin-left: auto;
        }

        .paginationRow {
          flex-wrap: wrap;
          align-items: center;
        }

        @media (max-width: 600px) {
          .searchHeaderRow {
            flex-direction: column;
            align-items: stretch;
          }

          .activeDatasetLabel {
            flex-direction: column;
            align-items: stretch;
          }

          .activeDatasetLabel select {
            margin-left: 0 !important;
            width: 100%;
          }

          .scopeToggle {
            align-items: flex-start;
          }

          .selectedHeader {
            flex-direction: column;
            align-items: flex-start;
          }

          .openAtButton {
            margin-left: 0;
            width: 100%;
          }
        }
        .resultsGrid {
          margin-top: 10px;
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 12px;
        }
        @media (max-width: 980px) {
          .resultsGrid {
            grid-template-columns: 1fr;
          }
        }

        .resultsListScroll {
          max-height: 420px;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        }

        @media (max-width: 600px) {
          .resultsListScroll {
            max-height: 55vh;
          }
        }
      `}</style>
    </div>
  );
}
