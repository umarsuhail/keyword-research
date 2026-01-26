"use client";

import { useMemo, useState } from "react";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/";

function randomInt(maxExclusive: number): number {
  const max = Math.floor(maxExclusive);
  if (max <= 1) return 0;

  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;

  while (true) {
    crypto.getRandomValues(buf);
    const v = buf[0];
    if (v < limit) return v % max;
  }
}

function pickFrom(set: string): string {
  return set[randomInt(set.length)];
}

function generatePassword(args: {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}): string {
  let pool = "";
  const required: string[] = [];

  if (args.lower) {
    pool += LOWER;
    required.push(pickFrom(LOWER));
  }
  if (args.upper) {
    pool += UPPER;
    required.push(pickFrom(UPPER));
  }
  if (args.digits) {
    pool += DIGITS;
    required.push(pickFrom(DIGITS));
  }
  if (args.symbols) {
    pool += SYMBOLS;
    required.push(pickFrom(SYMBOLS));
  }

  if (!pool) return "";

  if (args.avoidAmbiguous) {
    const ambiguous = new Set(["0", "O", "o", "1", "l", "I"]);
    pool = pool
      .split("")
      .filter((c) => !ambiguous.has(c))
      .join("");
  }

  const length = Math.max(6, Math.min(128, Math.floor(args.length)));

  const out: string[] = [];
  for (let i = 0; i < length; i++) out.push(pickFrom(pool));

  // Ensure at least one of each selected class.
  for (let i = 0; i < required.length && i < out.length; i++) {
    out[randomInt(out.length)] = required[i];
  }

  // Shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out.join("");
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(false);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const password = useMemo(
    () =>
      generatePassword({
        length,
        lower,
        upper,
        digits,
        symbols,
        avoidAmbiguous,
      }),
    [length, lower, upper, digits, symbols, avoidAmbiguous],
  );

  const strength = useMemo(() => {
    const classes = [lower, upper, digits, symbols].filter(Boolean).length;
    const bitsPerChar = Math.log2(
      (lower ? LOWER.length : 0) +
        (upper ? UPPER.length : 0) +
        (digits ? DIGITS.length : 0) +
        (symbols ? SYMBOLS.length : 0) ||
        1,
    );
    const approxBits = Math.round(bitsPerChar * length);

    const label =
      approxBits < 45 ? "Weak" : approxBits < 70 ? "Okay" : approxBits < 95 ? "Strong" : "Very strong";

    return { classes, approxBits, label };
  }, [digits, length, lower, symbols, upper]);

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
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <Field label="Length">
          <input
            type="number"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            min={6}
            max={128}
            style={inputStyle}
          />
        </Field>

        <Field label="Include">
          <div style={{ display: "grid", gap: 8, color: "var(--muted)" }}>
            <label style={checkRow}>
              <input type="checkbox" checked={lower} onChange={(e) => setLower(e.target.checked)} />
              Lowercase
            </label>
            <label style={checkRow}>
              <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} />
              Uppercase
            </label>
            <label style={checkRow}>
              <input type="checkbox" checked={digits} onChange={(e) => setDigits(e.target.checked)} />
              Numbers
            </label>
            <label style={checkRow}>
              <input type="checkbox" checked={symbols} onChange={(e) => setSymbols(e.target.checked)} />
              Symbols
            </label>
          </div>
        </Field>

        <Field label="Options">
          <label style={{ ...checkRow, color: "var(--muted)" }}>
            <input
              type="checkbox"
              checked={avoidAmbiguous}
              onChange={(e) => setAvoidAmbiguous(e.target.checked)}
            />
            Avoid ambiguous (0/O, 1/l/I)
          </label>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
            Strength: <span style={{ color: "var(--foreground)", fontWeight: 800 }}>{strength.label}</span> · ~{strength.approxBits} bits
          </div>
        </Field>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          border: "1px solid rgba(36,49,64,0.65)",
          background: "var(--surface-2)",
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontFamily: "var(--font-geist-mono)", wordBreak: "break-all" }}>{password || "(select at least one set)"}</div>
        <button
          onClick={async () => {
            if (!password) return;
            try {
              await copyToClipboard(password);
              setStatus("Copied to clipboard.");
            } catch {
              setStatus("Clipboard blocked by browser.");
            }
          }}
          disabled={!password}
          style={{
            ...btnStyle,
            background: password ? "#101826" : "var(--surface)",
            color: password ? "var(--foreground)" : "var(--muted)",
            cursor: password ? "pointer" : "not-allowed",
          }}
        >
          Copy
        </button>
      </div>

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
};

const checkRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};
