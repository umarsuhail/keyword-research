"use client";

import { useMemo, useState } from "react";

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function UuidTools() {
  const [count, setCount] = useState(5);
  const [upper, setUpper] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const uuids = useMemo(() => {
    const n = Math.min(200, Math.max(1, count));
    const arr = Array.from({ length: n }, () => crypto.randomUUID());
    return arr.map((id) => {
      const v = upper ? id.toUpperCase() : id;
      return `${prefix}${v}${suffix}`;
    });
  }, [count, upper, prefix, suffix]);

  const output = uuids.join("\n");

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <Field label="Count (1–200)">
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            min={1}
            max={200}
            style={inputStyle}
          />
        </Field>
        <Field label="Prefix">
          <input value={prefix} onChange={(e) => setPrefix(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Suffix">
          <input value={suffix} onChange={(e) => setSuffix(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Case">
          <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--muted)" }}>
            <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
            UPPERCASE
          </label>
        </Field>
      </div>

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Output</div>
        <button
          onClick={async () => {
            try {
              await copyToClipboard(output);
              setStatus("Copied to clipboard.");
            } catch {
              setStatus("Clipboard blocked by browser.");
            }
          }}
          style={btnStyle}
        >
          Copy
        </button>
      </div>

      <textarea
        readOnly
        value={output}
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
