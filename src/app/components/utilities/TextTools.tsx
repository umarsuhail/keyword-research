"use client";

import { useMemo, useState } from "react";

function countLines(value: string): number {
  if (!value) return 0;
  return value.split(/\r?\n/).length;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed
    .toLowerCase()
    .replace(/(^|[.!?]\s+)([a-z])/g, (_m, p1: string, p2: string) => `${p1}${p2.toUpperCase()}`);
}

function cleanWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function removeEmptyLines(value: string): string {
  return value
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
    .join("\n");
}

function dedupeLines(value: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const key = line.trim();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out.join("\n");
}

function sortLines(value: string): string {
  return value
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .sort((a, b) => a.localeCompare(b))
    .join("\n");
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function TextTools() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const stats = useMemo(
    () => ({
      chars: input.length,
      lines: countLines(input),
    }),
    [input],
  );

  const apply = (fn: (v: string) => string) => {
    setStatus(null);
    setOutput(fn(input));
  };

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 800 }}>Input</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              {stats.chars} chars · {stats.lines} lines
            </div>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste text here…"
            style={{
              width: "100%",
              height: 280,
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--foreground)",
              fontFamily: "var(--font-geist-mono)",
            }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 800 }}>Output</div>
            <button
              onClick={async () => {
                try {
                  await copyToClipboard(output);
                  setStatus("Copied output to clipboard.");
                } catch {
                  setStatus("Clipboard blocked by browser.");
                }
              }}
              disabled={!output}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: output ? "#101826" : "var(--surface-2)",
                color: output ? "var(--foreground)" : "var(--muted)",
                cursor: output ? "pointer" : "not-allowed",
              }}
            >
              Copy
            </button>
          </div>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder="Output appears here…"
            style={{
              width: "100%",
              height: 280,
              marginTop: 8,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--foreground)",
              fontFamily: "var(--font-geist-mono)",
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => apply((v) => v.toUpperCase())} style={btnStyle}>
          UPPERCASE
        </button>
        <button onClick={() => apply((v) => v.toLowerCase())} style={btnStyle}>
          lowercase
        </button>
        <button onClick={() => apply(titleCase)} style={btnStyle}>
          Title Case
        </button>
        <button onClick={() => apply(sentenceCase)} style={btnStyle}>
          Sentence case
        </button>
        <button onClick={() => apply(cleanWhitespace)} style={btnStyle}>
          Clean whitespace
        </button>
        <button onClick={() => apply(removeEmptyLines)} style={btnStyle}>
          Remove empty lines
        </button>
        <button onClick={() => apply(dedupeLines)} style={btnStyle}>
          Dedupe lines
        </button>
        <button onClick={() => apply(sortLines)} style={btnStyle}>
          Sort lines
        </button>
        <button onClick={() => apply((v) => v.split("").reverse().join(""))} style={btnStyle}>
          Reverse chars
        </button>
        <button
          onClick={() => {
            setInput("");
            setOutput("");
            setStatus(null);
          }}
          style={{ ...btnStyle, background: "var(--surface-2)" }}
        >
          Clear
        </button>
      </div>

      {status && <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>{status}</div>}
    </section>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#101826",
  color: "var(--foreground)",
  cursor: "pointer",
};
