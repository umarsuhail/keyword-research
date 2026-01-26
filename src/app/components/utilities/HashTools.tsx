"use client";

import { useMemo, useState } from "react";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

async function digest(alg: AlgorithmIdentifier, text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest(alg, bytes);
  return new Uint8Array(hash);
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function HashTools() {
  const [alg, setAlg] = useState<"SHA-1" | "SHA-256" | "SHA-384" | "SHA-512">("SHA-256");
  const [input, setInput] = useState("");
  const [hex, setHex] = useState("");
  const [b64, setB64] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canHash = useMemo(() => typeof crypto?.subtle?.digest === "function", []);

  const run = async () => {
    setStatus(null);
    setError(null);
    try {
      const bytes = await digest(alg, input);
      setHex(bytesToHex(bytes));
      setB64(bytesToBase64(bytes));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hash failed");
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
      {!canHash && (
        <div style={{ marginBottom: 12, color: "#b00020" }}>
          Web Crypto is not available in this browser context.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 10 }}>
        <Field label="Algorithm">
          <select value={alg} onChange={(e) => setAlg(e.target.value as any)} style={inputStyle}>
            <option value="SHA-1">SHA-1</option>
            <option value="SHA-256">SHA-256</option>
            <option value="SHA-384">SHA-384</option>
            <option value="SHA-512">SHA-512</option>
          </select>
          <button onClick={run} style={{ ...btnStyle, marginTop: 10 }} disabled={!canHash}>
            Hash
          </button>
        </Field>

        <Field label="Input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Text to hash…"
            spellCheck={false}
            style={{
              width: "100%",
              height: 170,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
              fontFamily: "var(--font-geist-mono)",
            }}
          />
        </Field>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <OutRow label="Hex" value={hex} onCopied={setStatus} />
        <OutRow label="Base64" value={b64} onCopied={setStatus} />
      </div>

      {error && <div style={{ marginTop: 10, color: "#b00020" }}>{error}</div>}
      {status && <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>{status}</div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: "1px solid rgba(36,49,64,0.65)",
        background: "var(--surface-2)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function OutRow({
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
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
        <div style={{ fontFamily: "var(--font-geist-mono)", wordBreak: "break-all" }}>{value || "—"}</div>
        <button
          onClick={async () => {
            if (!value) return;
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--foreground)",
};

const btnStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#101826",
  color: "var(--foreground)",
  cursor: "pointer",
};
