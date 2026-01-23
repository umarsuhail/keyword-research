import * as cheerio from "cheerio";
import { DateTime } from "luxon";

import type { ParsedMessage } from "./types";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseTimestampMs(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Common Meta export format: "Mar 16, 2023 11:23 pm"
  const dt = DateTime.fromFormat(trimmed, "LLL d, yyyy h:mm a", {
    locale: "en",
  });
  if (dt.isValid) return dt.toMillis();

  const fallback = Date.parse(trimmed);
  if (!Number.isNaN(fallback)) return fallback;

  return null;
}

export function parseMessagesFromHtml(html: string): ParsedMessage[] {
  const $ = cheerio.load(html);

  let blocks = $("main div.pam").toArray();
  if (blocks.length === 0) blocks = $("div.pam").toArray();
  if (blocks.length === 0) blocks = $("div._a6-g").toArray();

  const messages: ParsedMessage[] = [];

  for (const block of blocks) {
    const sender = normalizeWhitespace($(block).find("h2").first().text()) ||
      "Unknown";

    const content = $(block).find("div._a6-p").first();
    if (!content.length) continue;

    const contentClone = content.clone();
    // Remove reaction/metadata lists that repeat the same info.
    contentClone.find("ul").remove();

    const text = normalizeWhitespace(contentClone.text());
    if (!text) continue;

    const timestampRaw = normalizeWhitespace(
      $(block).find("div._a6-o").first().text(),
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
