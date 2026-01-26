"use client";

import { useMemo, useState } from "react";

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function UrlTools() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    try {
      const url = new URL(trimmed);
      return {
        ok: true as const,
        url,
        params: Array.from(url.searchParams.entries()),
      };
    } catch {
      return { ok: false as const };
    }
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>Input</div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste a URL or a URL component…"
            spellCheck={false}
            style={{
              width: "100%",
              height: 220,
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
            placeholder="Result…"
            spellCheck={false}
            style={{
              width: "100%",
              height: 220,
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
        <button onClick={() => setOutput(encodeURIComponent(input))} style={btnStyle}>
          encodeURIComponent
        </button>
        <button
          onClick={() => {
            try {
              setOutput(decodeURIComponent(input));
            } catch {
              setOutput("(invalid escape sequence)");
            }
          }}
          style={btnStyle}
        >
          decodeURIComponent
        </button>
        <button onClick={() => setOutput(encodeURI(input))} style={btnStyle}>
          encodeURI
        </button>
        <button
          onClick={() => {
            try {
              setOutput(decodeURI(input));
            } catch {
              setOutput("(invalid escape sequence)");
            }
          }}
          style={btnStyle}
        >
          decodeURI
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

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Query params inspector</div>
        {parsed?.ok ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(36,49,64,0.65)",
              background: "var(--surface-2)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
              <div style={{ color: "var(--muted)" }}>Origin</div>
              <div style={{ fontFamily: "var(--font-geist-mono)" }}>{parsed.url.origin}</div>
              <div style={{ color: "var(--muted)" }}>Path</div>
              <div style={{ fontFamily: "var(--font-geist-mono)" }}>{parsed.url.pathname}</div>
            </div>

            <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
              Params ({parsed.params.length})
            </div>

            {parsed.params.length ? (
              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
                {parsed.params.map(([k, v], i) => (
                  <div key={`${k}-${i}`} style={{ display: "contents" }}>
                    <div style={{ fontFamily: "var(--font-geist-mono)" }}>{k}</div>
                    <div style={{ fontFamily: "var(--font-geist-mono)", color: "var(--muted)" }}>{v}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 8, color: "var(--muted)" }}>No query params.</div>
            )}
          </div>
        ) : (
          <div style={{ color: "var(--muted)" }}>
            Paste a full URL (including <code style={{ color: "var(--foreground)" }}>https://</code>) to inspect.
          </div>
        )}
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
