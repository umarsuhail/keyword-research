"use client";

import { useMemo, useState } from "react";

function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function WordCountTools() {
  const [text, setText] = useState("");

  const stats = useMemo(() => {
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, "").length;
    const lines = text ? text.split(/\r?\n/).length : 0;
    const words = tokenizeWords(text);
    const wordCount = words.length;

    const unique = new Set(words).size;
    const readingMinutes = wordCount / 200;

    const freq = new Map<string, number>();
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    const top = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      chars,
      charsNoSpaces,
      lines,
      wordCount,
      unique,
      readingTime: readingMinutes < 1 ? "< 1 min" : `${Math.round(readingMinutes)} min`,
      top,
    };
  }, [text]);

  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--surface)",
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text here…"
        style={{
          width: "100%",
          height: 260,
          padding: 12,
          borderRadius: 12,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--foreground)",
          fontFamily: "var(--font-geist-mono)",
        }}
      />

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <Stat label="Words" value={String(stats.wordCount)} />
        <Stat label="Unique" value={String(stats.unique)} />
        <Stat label="Reading time" value={stats.readingTime} />
        <Stat label="Chars" value={String(stats.chars)} />
        <Stat label="Chars (no spaces)" value={String(stats.charsNoSpaces)} />
        <Stat label="Lines" value={String(stats.lines)} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Top words</div>
        {stats.top.length ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 8,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(36,49,64,0.65)",
              background: "var(--surface-2)",
            }}
          >
            {stats.top.map(([w, n]) => (
              <div key={w} style={{ display: "contents" }}>
                <div style={{ fontFamily: "var(--font-geist-mono)" }}>{w}</div>
                <div style={{ color: "var(--muted)" }}>{n}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--muted)" }}>Paste text to see stats.</div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 4 }}>{value}</div>
    </div>
  );
}
