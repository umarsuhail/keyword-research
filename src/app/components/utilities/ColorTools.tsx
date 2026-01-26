"use client";

import { useMemo, useState } from "react";

type Rgb = { r: number; g: number; b: number };

type Hsl = { h: number; s: number; l: number };

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function parseHexColor(input: string): Rgb | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    return { r, g, b };
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function toHex({ r, g, b }: Rgb): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  ).toUpperCase();
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rr) h = ((gg - bb) / delta) % 6;
    else if (max === gg) h = (bb - rr) / delta + 2;
    else h = (rr - gg) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function srgbToLinear(v: number): number {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: Rgb): number {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const L1 = Math.max(la, lb);
  const L2 = Math.min(la, lb);
  return (L1 + 0.05) / (L2 + 0.05);
}

function randomRgb(): Rgb {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return { r: bytes[0], g: bytes[1], b: bytes[2] };
}

async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export function ColorTools() {
  const [hex, setHex] = useState("#6AA6FF");
  const [status, setStatus] = useState<string | null>(null);

  const rgb = useMemo(() => parseHexColor(hex), [hex]);
  const hsl = useMemo(() => (rgb ? rgbToHsl(rgb) : null), [rgb]);

  const onRandom = () => {
    const c = randomRgb();
    setHex(toHex(c));
    setStatus(null);
  };

  const palette = useMemo(() => {
    const base = rgb ?? { r: 106, g: 166, b: 255 };
    const h = rgbToHsl(base).h;
    const out: string[] = [];
    for (let i = 0; i < 5; i++) {
      // simple hue shift palette (not perfect, but nice)
      const hue = (h + i * 30) % 360;
      out.push(`hsl(${hue} 85% 60%)`);
    }
    return out;
  }, [rgb]);

  const fg = { r: 242, g: 244, b: 248 };
  const bg = { r: 11, g: 15, b: 20 };
  const contrast = useMemo(() => (rgb ? contrastRatio(rgb, bg) : null), [rgb]);
  const contrastOnWhite = useMemo(() => (rgb ? contrastRatio(rgb, { r: 255, g: 255, b: 255 }) : null), [rgb]);

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800 }}>HEX</div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <input value={hex} onChange={(e) => setHex(e.target.value)} style={inputStyle} />
            <button onClick={onRandom} style={btnStyle}>
              Random
            </button>
          </div>

          <div
            style={{
              marginTop: 12,
              height: 120,
              borderRadius: 14,
              border: "1px solid rgba(36,49,64,0.65)",
              background: rgb ? toHex(rgb) : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: rgb ? (contrastRatio(rgb, fg) >= 4.5 ? "#f2f4f8" : "#0b0f14") : "var(--muted)",
              fontWeight: 900,
            }}
          >
            {rgb ? toHex(rgb) : "Invalid color"}
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <Out label="RGB" value={rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : ""} onCopied={setStatus} />
            <Out
              label="HSL"
              value={hsl ? `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)` : ""}
              onCopied={setStatus}
            />
          </div>

          {rgb && (
            <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
              Contrast on app background: <span style={{ color: "var(--foreground)" }}>{contrast?.toFixed(2)}:1</span> · on white: <span style={{ color: "var(--foreground)" }}>{contrastOnWhite?.toFixed(2)}:1</span>
            </div>
          )}

          {status && <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>{status}</div>}
        </div>

        <div>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Palette</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
            {palette.map((c) => (
              <button
                key={c}
                onClick={async () => {
                  try {
                    await copyToClipboard(c);
                    setStatus(`Copied: ${c}`);
                  } catch {
                    setStatus("Clipboard blocked by browser.");
                  }
                }}
                style={{
                  height: 120,
                  borderRadius: 14,
                  border: "1px solid rgba(36,49,64,0.65)",
                  background: c,
                  cursor: "pointer",
                }}
                title={`Click to copy ${c}`}
              />
            ))}
          </div>

          <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 12 }}>
            Tip: click any swatch to copy its CSS color.
          </div>
        </div>
      </div>
    </section>
  );
}

function Out({
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
        display: "flex",
        gap: 10,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>{label}</div>
        <div style={{ fontFamily: "var(--font-geist-mono)", marginTop: 6 }}>{value || "—"}</div>
      </div>
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
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--foreground)",
  fontFamily: "var(--font-geist-mono)",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#101826",
  color: "var(--foreground)",
  cursor: "pointer",
};
