import path from "path";
import fs from "fs/promises";

import type { ParsedFileMeta, ParsedMessage } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

type CacheEntry = {
  meta: ParsedFileMeta;
  messages: ParsedMessage[];
  lastAccessMs: number;
};

const cache = new Map<string, CacheEntry>();
const MAX_CACHED_FILES = 3;

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

function fileDir(fileId: string) {
  return path.join(DATA_DIR, fileId);
}

function metaPath(fileId: string) {
  return path.join(fileDir(fileId), "meta.json");
}

function messagesPath(fileId: string) {
  return path.join(fileDir(fileId), "messages.json");
}

function originalHtmlPath(fileId: string) {
  return path.join(fileDir(fileId), "original.html");
}

function evictIfNeeded() {
  if (cache.size <= MAX_CACHED_FILES) return;

  let oldestKey: string | null = null;
  let oldestAccess = Number.POSITIVE_INFINITY;
  for (const [key, entry] of cache.entries()) {
    if (entry.lastAccessMs < oldestAccess) {
      oldestAccess = entry.lastAccessMs;
      oldestKey = key;
    }
  }
  if (oldestKey) cache.delete(oldestKey);
}

export async function saveParsedFile(args: {
  fileId: string;
  originalName: string;
  messages: ParsedMessage[];
}): Promise<ParsedFileMeta> {
  await ensureDir(DATA_DIR);
  await ensureDir(fileDir(args.fileId));

  const timestamps = args.messages
    .map((m) => m.timestampMs)
    .filter((v): v is number => typeof v === "number");

  const meta: ParsedFileMeta = {
    fileId: args.fileId,
    originalName: args.originalName,
    messageCount: args.messages.length,
    senders: Array.from(new Set(args.messages.map((m) => m.sender))).sort(),
    minTimestampMs: timestamps.length ? Math.min(...timestamps) : null,
    maxTimestampMs: timestamps.length ? Math.max(...timestamps) : null,
    createdAtMs: Date.now(),
  };

  await fs.writeFile(metaPath(args.fileId), JSON.stringify(meta, null, 2),
    "utf-8");
  await fs.writeFile(
    messagesPath(args.fileId),
    JSON.stringify(args.messages),
    "utf-8",
  );

  cache.set(args.fileId, {
    meta,
    messages: args.messages,
    lastAccessMs: Date.now(),
  });
  evictIfNeeded();

  return meta;
}

export async function saveOriginalHtml(fileId: string, html: string) {
  await ensureDir(DATA_DIR);
  await ensureDir(fileDir(fileId));
  await fs.writeFile(originalHtmlPath(fileId), html, "utf-8");
}

export async function loadParsedFile(fileId: string): Promise<{
  meta: ParsedFileMeta;
  messages: ParsedMessage[];
}> {
  const cached = cache.get(fileId);
  if (cached) {
    cached.lastAccessMs = Date.now();
    return { meta: cached.meta, messages: cached.messages };
  }

  const [metaRaw, messagesRaw] = await Promise.all([
    fs.readFile(metaPath(fileId), "utf-8"),
    fs.readFile(messagesPath(fileId), "utf-8"),
  ]);

  const meta = JSON.parse(metaRaw) as ParsedFileMeta;
  const messages = JSON.parse(messagesRaw) as ParsedMessage[];

  cache.set(fileId, { meta, messages, lastAccessMs: Date.now() });
  evictIfNeeded();

  return { meta, messages };
}

export async function loadOriginalHtml(fileId: string): Promise<string> {
  return fs.readFile(originalHtmlPath(fileId), "utf-8");
}
