import type { ParsedMessage } from "./types";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

function parseTimestampMs(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const direct = Date.parse(trimmed);
  if (!Number.isNaN(direct)) return direct;

  // Common Meta export format: "Mar 16, 2023 11:23 pm"
  const m = trimmed.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*([ap]m)$/i,
  );
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (typeof month === "number") {
      const day = Number(m[2]);
      const year = Number(m[3]);
      let hour = Number(m[4]);
      const minute = Number(m[5]);
      const ampm = m[6].toLowerCase();

      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;

      const dt = new Date(year, month, day, hour, minute, 0, 0);
      const ms = dt.getTime();
      return Number.isNaN(ms) ? null : ms;
    }
  }

  return null;
}

function pickMessageBlocks(doc: Document): Element[] {
  const a = Array.from(doc.querySelectorAll("main div.pam"));
  if (a.length) return a;
  const b = Array.from(doc.querySelectorAll("div.pam"));
  if (b.length) return b;
  return Array.from(doc.querySelectorAll("div._a6-g"));
}

export function parseMessagesFromHtmlBrowser(html: string): ParsedMessage[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const blocks = pickMessageBlocks(doc);
  const messages: ParsedMessage[] = [];

  for (const block of blocks) {
    const sender =
      normalizeWhitespace(block.querySelector("h2")?.textContent ?? "") ||
      "Unknown";

    const content = block.querySelector("div._a6-p");
    if (!content) continue;

    const contentClone = content.cloneNode(true) as Element;
    for (const ul of Array.from(contentClone.querySelectorAll("ul"))) {
      ul.remove();
    }

    const text = normalizeWhitespace(contentClone.textContent ?? "");
    if (!text) continue;

    const timestampRaw = normalizeWhitespace(
      block.querySelector("div._a6-o")?.textContent ?? "",
    );

    const timestampMs = parseTimestampMs(timestampRaw);

    messages.push({
      id: crypto.randomUUID(),
      sender,
      text,
      textNorm: text.toLowerCase(),
      timestampRaw,
      timestampMs,
    });
  }

  return messages;
}
