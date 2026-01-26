"use client";

import { useMemo, useState } from "react";

function safeNumber(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function TimestampTools() {
  const [dateText, setDateText] = useState("");
  const [epochMsText, setEpochMsText] = useState("");
  const [epochSecText, setEpochSecText] = useState("");

  const parsed = useMemo(() => {
    const ms = safeNumber(epochMsText);
    const sec = safeNumber(epochSecText);

    const fromMs = typeof ms === "number" ? ms : typeof sec === "number" ? sec * 1000 : null;
    const fromDateText = dateText.trim() ? Date.parse(dateText.trim()) : null;

    return {
      ms: fromMs,
      dateFromMs: typeof fromMs === "number" ? new Date(fromMs) : null,
      msFromDateText: typeof fromDateText === "number" && !Number.isNaN(fromDateText) ? fromDateText : null,
    };
  }, [dateText, epochMsText, epochSecText]);

  const now = () => {
    const ms = Date.now();
    setEpochMsText(String(ms));
    setEpochSecText(String(Math.floor(ms / 1000)));
    setDateText(new Date(ms).toISOString());
  };

  const fromDate = () => {
    const ms = Date.parse(dateText.trim());
    if (Number.isNaN(ms)) return;
    setEpochMsText(String(ms));
    setEpochSecText(String(Math.floor(ms / 1000)));
  };

  const fromMs = () => {
    const ms = safeNumber(epochMsText);
    if (typeof ms !== "number") return;
    setEpochSecText(String(Math.floor(ms / 1000)));
    setDateText(new Date(ms).toISOString());
  };

  const fromSec = () => {
    const sec = safeNumber(epochSecText);
    if (typeof sec !== "number") return;
    const ms = sec * 1000;
    setEpochMsText(String(ms));
    setDateText(new Date(ms).toISOString());
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="Date / time (parseable)">
          <input
            value={dateText}
            onChange={(e) => setDateText(e.target.value)}
            placeholder="2026-01-25T12:34:56Z"
            style={inputStyle}
          />
          <button onClick={fromDate} style={{ ...btnStyle, marginTop: 10 }}>
            Convert → epoch
          </button>
        </Field>

        <Field label="Epoch milliseconds">
          <input
            value={epochMsText}
            onChange={(e) => setEpochMsText(e.target.value)}
            placeholder="1737800000000"
            style={inputStyle}
          />
          <button onClick={fromMs} style={{ ...btnStyle, marginTop: 10 }}>
            Convert → date
          </button>
        </Field>

        <Field label="Epoch seconds">
          <input
            value={epochSecText}
            onChange={(e) => setEpochSecText(e.target.value)}
            placeholder="1737800000"
            style={inputStyle}
          />
          <button onClick={fromSec} style={{ ...btnStyle, marginTop: 10 }}>
            Convert → date
          </button>
        </Field>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={now} style={btnStyle}>
          Now
        </button>
        <button
          onClick={() => {
            setDateText("");
            setEpochMsText("");
            setEpochSecText("");
          }}
          style={{ ...btnStyle, background: "var(--surface-2)" }}
        >
          Clear
        </button>
      </div>

      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12 }}>
        {parsed.dateFromMs ? (
          <>
            Interpreted date: <span style={{ color: "var(--foreground)" }}>{parsed.dateFromMs.toString()}</span>
          </>
        ) : parsed.msFromDateText ? (
          <>
            Parsed ms: <span style={{ color: "var(--foreground)" }}>{parsed.msFromDateText}</span>
          </>
        ) : (
          <>Tip: ISO 8601 is the most reliable format.</>
        )}
      </div>
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
