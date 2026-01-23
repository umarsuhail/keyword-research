import type { ParsedMessage, SearchHit, SearchParams } from "./types";

function makeSnippet(args: {
  text: string;
  textNorm: string;
  qNorm: string;
  contextChars?: number;
}): string {
  const context = args.contextChars ?? 48;
  const pos = args.textNorm.indexOf(args.qNorm);
  if (pos < 0) {
    const fallback = args.text.slice(0, Math.min(args.text.length, context * 2));
    return args.text.length > fallback.length ? `${fallback}…` : fallback;
  }

  const start = Math.max(0, pos - context);
  const end = Math.min(args.text.length, pos + args.qNorm.length + context);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < args.text.length ? "…" : "";
  return `${prefix}${args.text.slice(start, end)}${suffix}`;
}

export function searchMessages(
  messages: ParsedMessage[],
  params: SearchParams,
): { total: number; results: SearchHit[] } {
  const qNorm = params.q.trim().toLowerCase();

  const filtered: ParsedMessage[] = [];
  for (const message of messages) {
    if (params.sender && message.sender !== params.sender) continue;

    if (typeof params.fromMs === "number") {
      if (typeof message.timestampMs !== "number" || message.timestampMs < params.fromMs) {
        continue;
      }
    }

    if (typeof params.toMs === "number") {
      if (typeof message.timestampMs !== "number" || message.timestampMs > params.toMs) {
        continue;
      }
    }

    if (qNorm) {
      if (!message.textNorm.includes(qNorm)) continue;
    }

    filtered.push(message);
  }

  // Newest first (where date is known). Unknown dates fall to the end.
  filtered.sort((a, b) => {
    const av = typeof a.timestampMs === "number" ? a.timestampMs : -1;
    const bv = typeof b.timestampMs === "number" ? b.timestampMs : -1;
    return bv - av;
  });

  const total = filtered.length;
  const slice = filtered.slice(params.offset, params.offset + params.limit);

  const results: SearchHit[] = slice.map((m) => ({
    id: m.id,
    sender: m.sender,
    timestampRaw: m.timestampRaw,
    timestampMs: m.timestampMs,
    text: m.text,
    snippet: qNorm
      ? makeSnippet({ text: m.text, textNorm: m.textNorm, qNorm })
      : makeSnippet({ text: m.text, textNorm: m.textNorm, qNorm: "" }),
  }));

  return { total, results };
}
