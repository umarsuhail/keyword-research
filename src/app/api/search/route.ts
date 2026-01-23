import { NextResponse } from "next/server";

import { loadParsedFile } from "@/lib/storage";
import { searchMessages } from "@/lib/searchMessages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNumber(value: string | null, fallback: number): number {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function parseDateMs(value: string | null, mode: "start" | "end"): number | undefined {
  if (!value) return undefined;

  // Support <input type="date"> values (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = mode === "start" ? "T00:00:00.000" : "T23:59:59.999";
    const ms = Date.parse(`${value}${suffix}`);
    return Number.isNaN(ms) ? undefined : ms;
  }

  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return undefined;
  return ms;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fileId = url.searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json(
      { error: "Missing query param 'fileId'." },
      { status: 400 },
    );
  }

  const q = url.searchParams.get("q") ?? "";
  const sender = url.searchParams.get("sender") ?? undefined;
  const fromMs = parseDateMs(url.searchParams.get("from"), "start");
  const toMs = parseDateMs(url.searchParams.get("to"), "end");
  const offset = Math.max(0, parseNumber(url.searchParams.get("offset"), 0));
  const limit = Math.min(200, Math.max(1, parseNumber(url.searchParams.get("limit"), 50)));

  try {
    const { meta, messages } = await loadParsedFile(fileId);
    const { total, results } = searchMessages(messages, {
      q,
      sender,
      fromMs,
      toMs,
      offset,
      limit,
    });

    return NextResponse.json({
      fileId,
      meta,
      total,
      offset,
      limit,
      results,
    });
  } catch {
    return NextResponse.json(
      { error: "Unknown fileId (not uploaded yet, or data was deleted)." },
      { status: 404 },
    );
  }
}
