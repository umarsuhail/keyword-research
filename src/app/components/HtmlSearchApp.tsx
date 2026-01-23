"use client";

import { useCallback, useMemo, useState } from "react";

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
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as
        | { fileId: string; meta: UploadMeta; error?: string }
        | { error: string };

      if (!res.ok) {
        setUploadError(
          "error" in json ? (json.error ?? "Upload failed.") : "Upload failed.",
        );
        return;
      }

      if (!("fileId" in json)) {
        setUploadError("Unexpected upload response.");
        return;
      }

      setFileId(json.fileId);
      setMeta(json.meta);
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
        const params = new URLSearchParams({
          fileId,
          q,
          offset: String(offset),
          limit: String(limit),
        });

        if (sender) params.set("sender", sender);
        if (from) params.set("from", from);
        if (to) params.set("to", to);

        const res = await fetch(`/api/search?${params.toString()}`);
        const json = (await res.json()) as SearchApiResponse;

        if (!res.ok) {
          setSearchError(json.error ?? "Search failed.");
          return;
        }

        setResults(json.results);
        setTotal(json.total);
        setMeta(json.meta);
        setSelectedId(json.results[0]?.id ?? null);
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : "Search failed.");
      } finally {
        setSearching(false);
      }
    },
    [fileId, q, sender, from, to, limit],
  );

  const selected = useMemo(
    () => results.find((r) => r.id === selectedId) ?? null,
    [results, selectedId],
  );

  return (
    <div style={{ maxWidth: 980, width: "100%", margin: "0 auto" }}>
      <header style={{ padding: "28px 0 12px" }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>HTML Message Search</h1>
        <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
          Upload an exported HTML file and search the extracted plain text.
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
            {uploading ? "Uploading…" : "Upload & Parse"}
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
                src={(() => {
                  const params = new URLSearchParams({ fileId, q });
                  if (sender) params.set("sender", sender);
                  if (from) params.set("from", from);
                  if (to) params.set("to", to);
                  // include plenty of matches for navigation
                  params.set("limit", "5000");
                  return `/api/readable?${params.toString()}`;
                })()}
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
                src={`/api/html?fileId=${encodeURIComponent(fileId)}`}
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
          Note: Parsed files are saved locally under <code>data/</code>.
        </small>
      </footer>
    </div>
  );
}
