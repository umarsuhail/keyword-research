"use client";

import { useMemo, useState } from "react";

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort((a, b) => a.localeCompare(b))) {
      out[key] = sortKeysDeep(obj[key]);
    }
    return out;
  }
  return value;
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function JsonTools() {
  const [input, setInput] = useState("{\n  \"hello\": \"world\"\n}");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const isLikelyJson = useMemo(() => input.trim().startsWith("{") || input.trim().startsWith("["), [input]);

  const run = (fn: (v: unknown) => unknown, format: "pretty" | "min"): void => {
    setError(null);
    setStatus(null);
    try {
      const parsed = JSON.parse(input);
      const transformed = fn(parsed);
      const text =
        format === "min" ? JSON.stringify(transformed) : JSON.stringify(transformed, null, 2);
      setOutput(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      setOutput("");
    }
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
          <div style={{ fontWeight: 800 }}>Input JSON</div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              height: 320,
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
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
            spellCheck={false}
            placeholder="Run a formatter…"
            style={{
              width: "100%",
              height: 320,
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
        <button onClick={() => run((v) => v, "pretty")} style={btnStyle}>
          Pretty (2 spaces)
        </button>
        <button onClick={() => run((v) => v, "min")} style={btnStyle}>
          Minify
        </button>
        <button onClick={() => run(sortKeysDeep, "pretty")} style={btnStyle}>
          Sort keys (deep)
        </button>
        <button
          onClick={() => {
            setError(null);
            setStatus(null);
            try {
              JSON.parse(input);
              setStatus("Valid JSON.");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Invalid JSON");
            }
          }}
          style={btnStyle}
        >
          Validate
        </button>
        <button
          onClick={() => {
            setInput("");
            setOutput("");
            setError(null);
            setStatus(null);
          }}
          style={{ ...btnStyle, background: "var(--surface-2)" }}
        >
          Clear
        </button>
      </div>

      {!isLikelyJson && (
        <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
          Tip: input should start with <code style={{ color: "var(--foreground)" }}>{"{"}</code> or{" "}
          <code style={{ color: "var(--foreground)" }}>[</code>.
        </div>
      )}

      {error && <div style={{ marginTop: 10, color: "#b00020" }}>{error}</div>}
      {status && <div style={{ marginTop: 10, color: "var(--muted)" }}>{status}</div>}
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
