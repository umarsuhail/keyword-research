"use client";

import { useMemo, useState } from "react";

type ParseResult = { ok: true; rows: Record<string, string>[] } | { ok: false; error: string };

function parseCsv(input: string, delimiter: string): ParseResult {
  const text = input.replace(/\r\n/g, "\n");
  const lines = text.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return { ok: true, rows: [] };

  const rows = lines.map((line) => parseCsvLine(line, delimiter));
  const header = rows[0];
  if (!header.length) return { ok: false, error: "Missing header row." };

  const out: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      const key = header[j] || `col_${j + 1}`;
      obj[key] = r[j] ?? "";
    }
    out.push(obj);
  }

  return { ok: true, rows: out };
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      out.push(cur.trim());
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function CsvToJsonTools() {
  const [delimiter, setDelimiter] = useState(",");
  const [input, setInput] = useState("name,age\nAva,23\nNoah,25");
  const [status, setStatus] = useState<string | null>(null);

  const result = useMemo(() => parseCsv(input, delimiter), [input, delimiter]);

  const output = useMemo(() => {
    if (!result.ok) return "";
    return JSON.stringify(result.rows, null, 2);
  }, [result]);

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>Delimiter</div>
        <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)} style={inputStyle}>
          <option value=",">Comma (,)</option>
          <option value=";">Semicolon (;)</option>
          <option value="\t">Tab (\t)</option>
          <option value="|">Pipe (|)</option>
        </select>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          First line must be headers.
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>CSV</div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontWeight: 800 }}>JSON</div>
            <button
              onClick={async () => {
                if (!output) return;
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
            readOnly
            value={result.ok ? output : ""}
            placeholder={result.ok ? "" : "Fix CSV to see JSON…"}
            spellCheck={false}
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

          {!result.ok && <div style={{ marginTop: 10, color: "#b00020" }}>{result.error}</div>}
        </div>
      </div>

      {status && <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>{status}</div>}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--foreground)",
};
