"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { HtmlSearchApp } from "./HtmlSearchApp";
import { Base64Tools } from "./utilities/Base64Tools";
import { ColorTools } from "./utilities/ColorTools";
import { CsvToJsonTools } from "./utilities/CsvToJsonTools";
import { HashTools } from "./utilities/HashTools";
import { JsonTools } from "./utilities/JsonTools";
import { PasswordGenerator } from "./utilities/PasswordGenerator";
import { SlugTools } from "./utilities/SlugTools";
import { TextTools } from "./utilities/TextTools";
import { TimestampTools } from "./utilities/TimestampTools";
import { UrlTools } from "./utilities/UrlTools";
import { UuidTools } from "./utilities/UuidTools";
import { WordCountTools } from "./utilities/WordCountTools";

type Utility = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  element: ReactNode;
};

const STORAGE_KEY = "utilitiesHub.selectedId";

function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function UtilitiesHub() {
  const utilities: Utility[] = useMemo(
    () => [
      {
        id: "html-message-search",
        title: "HTML Message Search",
        description: "Parse a chat export HTML file and search it locally.",
        tags: ["search", "html", "offline"],
        element: <HtmlSearchApp />,
      },
      {
        id: "text-tools",
        title: "Text Tools",
        description: "Clean, transform, and generate text (case, lines, whitespace).",
        tags: ["copy", "writing", "cleanup"],
        element: <TextTools />,
      },
      {
        id: "word-count",
        title: "Word & Character Count",
        description: "Counts, reading time, and quick text stats.",
        tags: ["writing", "stats"],
        element: <WordCountTools />,
      },
      {
        id: "json-tools",
        title: "JSON Formatter",
        description: "Validate, pretty-print, minify, and sort JSON.",
        tags: ["dev", "official"],
        element: <JsonTools />,
      },
      {
        id: "csv-to-json",
        title: "CSV → JSON",
        description: "Convert simple CSV (with headers) into JSON.",
        tags: ["data", "dev", "official"],
        element: <CsvToJsonTools />,
      },
      {
        id: "base64",
        title: "Base64 Encode / Decode",
        description: "Encode or decode text as Base64 (UTF-8 safe).",
        tags: ["dev", "offline"],
        element: <Base64Tools />,
      },
      {
        id: "url-tools",
        title: "URL Encode / Decode",
        description: "Encode/decode URL parts and inspect query parameters.",
        tags: ["dev", "official"],
        element: <UrlTools />,
      },
      {
        id: "hash-tools",
        title: "Hash Generator",
        description: "Generate SHA hashes using Web Crypto (client-only).",
        tags: ["security", "dev", "official"],
        element: <HashTools />,
      },
      {
        id: "uuid",
        title: "UUID Generator",
        description: "Generate one or many UUIDs instantly.",
        tags: ["dev"],
        element: <UuidTools />,
      },
      {
        id: "passwords",
        title: "Password Generator",
        description: "Generate strong passwords with custom rules.",
        tags: ["security", "official"],
        element: <PasswordGenerator />,
      },
      {
        id: "timestamps",
        title: "Timestamp Converter",
        description: "Convert dates ⇄ epoch milliseconds/seconds.",
        tags: ["dev", "official"],
        element: <TimestampTools />,
      },
      {
        id: "colors",
        title: "Color Converter",
        description: "Convert HEX ⇄ RGB/HSL and generate palettes.",
        tags: ["design", "genz"],
        element: <ColorTools />,
      },
      {
        id: "slugs",
        title: "Slug / Case Converter",
        description: "Generate slugs, snake_case, and camelCase.",
        tags: ["writing", "dev"],
        element: <SlugTools />,
      },
    ],
    [],
  );

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const [selectedId, setSelectedId] = useState<string>(utilities[0]?.id ?? "");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored && utilities.some((u) => u.id === stored)) {
      setSelectedId(stored);
    }
  }, [utilities]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, selectedId);
  }, [selectedId]);

  const selected = useMemo(
    () => utilities.find((u) => u.id === selectedId) ?? utilities[0],
    [utilities, selectedId],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return utilities;
    return utilities.filter((u) => {
      return (
        u.title.toLowerCase().includes(q) ||
        u.description.toLowerCase().includes(q) ||
        u.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [filter, utilities]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        minHeight: "100vh",
      }}
    >
      <aside
        style={{
          borderRight: "1px solid var(--border)",
          background: "var(--surface-2)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
          display: mobileNavOpen ? "block" : "block",
        }}
        className={cx("hub-sidebar")}
      >
        <div
          style={{
            padding: "16px 14px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Utilities</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                Client-only mini apps
              </div>
            </div>
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              className={cx("hub-mobile-toggle")}
              style={{
                display: "none",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--foreground)",
                cursor: "pointer",
              }}
            >
              {mobileNavOpen ? "Close" : "Menu"}
            </button>
          </div>

          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search tools…"
            style={{
              width: "100%",
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "var(--foreground)",
            }}
          />

          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
            Data stays in your browser.
          </div>
        </div>

        <nav style={{ padding: 10, display: "grid", gap: 10 }}>
          {filtered.map((u) => {
            const active = u.id === selectedId;
            return (
              <button
                key={u.id}
                onClick={() => {
                  setSelectedId(u.id);
                  setMobileNavOpen(false);
                }}
                style={{
                  textAlign: "left",
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(36,49,64,0.65)",
                  background: active ? "rgba(106, 166, 255, 0.12)" : "transparent",
                  color: "var(--foreground)",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 800 }}>{u.title}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>{u.description}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {u.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(36,49,64,0.65)",
                        color: "var(--muted)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: 12, color: "var(--muted)" }}>No tools match that filter.</div>
          )}
        </nav>
      </aside>

      <main
        style={{
          padding: "20px 18px 60px",
          background: "transparent",
        }}
      >
        {selected ? (
          <>
            <header style={{ margin: "0 auto", maxWidth: 1100, paddingBottom: 14 }}>
              <h1 style={{ fontSize: 22, margin: 0 }}>{selected.title}</h1>
              <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>{selected.description}</p>
            </header>

            <div style={{ margin: "0 auto", maxWidth: 1100 }}>{selected.element}</div>
          </>
        ) : null}
      </main>

      <style jsx global>{`
        @media (max-width: 980px) {
          .hub-sidebar {
            position: fixed !important;
            z-index: 30;
            width: 100vw;
            max-width: 100vw;
            height: 100vh;
            left: 0;
            top: 0;
            transform: translateX(${mobileNavOpen ? "0" : "-105%"});
            transition: transform 160ms ease;
          }
          .hub-mobile-toggle {
            display: inline-block !important;
          }
        }
      `}</style>
    </div>
  );
}
