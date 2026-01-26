"use client";

import { useState } from "react";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function Base64Tools() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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
            placeholder="Text or Base64…"
            spellCheck={false}
            style={{
              width: "100%",
              height: 260,
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
              height: 260,
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
        <button
          onClick={() => {
            setError(null);
            setStatus(null);
            try {
              const bytes = new TextEncoder().encode(input);
              setOutput(bytesToBase64(bytes));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Encode failed");
            }
          }}
          style={btnStyle}
        >
          Encode → Base64
        </button>
        <button
          onClick={() => {
            setError(null);
            setStatus(null);
            try {
              const bytes = base64ToBytes(input.trim());
              setOutput(new TextDecoder().decode(bytes));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Decode failed");
            }
          }}
          style={btnStyle}
        >
          Decode ← Base64
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

      {error && <div style={{ marginTop: 10, color: "#b00020" }}>{error}</div>}
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
