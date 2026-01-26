"use client";

import { useMemo, useState } from "react";

function toWords(value: string): string[] {
  return value
    .trim()
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function kebabCase(value: string): string {
  return toWords(value).join("-");
}

function snakeCase(value: string): string {
  return toWords(value).join("_");
}

function camelCase(value: string): string {
  const w = toWords(value);
  if (!w.length) return "";
  return w[0] + w.slice(1).map((x) => x.slice(0, 1).toUpperCase() + x.slice(1)).join("");
}

function pascalCase(value: string): string {
  const w = toWords(value);
  return w.map((x) => x.slice(0, 1).toUpperCase() + x.slice(1)).join("");
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function SlugTools() {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const out = useMemo(() => {
    return {
      slug: kebabCase(input),
      snake: snakeCase(input),
      camel: camelCase(input),
      pascal: pascalCase(input),
    };
  }, [input]);

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--surface)",
      }}
    >
      <div style={{ fontWeight: 800 }}>Input</div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Hello world! this is a title"
        style={{
          width: "100%",
          marginTop: 8,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--foreground)",
        }}
      />

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Row label="Slug (kebab-case)" value={out.slug} onCopied={setStatus} />
        <Row label="snake_case" value={out.snake} onCopied={setStatus} />
        <Row label="camelCase" value={out.camel} onCopied={setStatus} />
        <Row label="PascalCase" value={out.pascal} onCopied={setStatus} />
      </div>

      {status && <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>{status}</div>}
    </section>
  );
}

function Row({
  label,
  value,
  onCopied,
}: {
  label: string;
  value: string;
  onCopied: (v: string) => void;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(36,49,64,0.65)",
        background: "var(--surface-2)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontFamily: "var(--font-geist-mono)", wordBreak: "break-all" }}>{value || "—"}</div>
        <button
          onClick={async () => {
            try {
              await copyToClipboard(value);
              onCopied("Copied.");
            } catch {
              onCopied("Clipboard blocked by browser.");
            }
          }}
          disabled={!value}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: value ? "#101826" : "var(--surface)",
            color: value ? "var(--foreground)" : "var(--muted)",
            cursor: value ? "pointer" : "not-allowed",
          }}
        >
          Copy
        </button>
      </div>
    </div>
  );
}
