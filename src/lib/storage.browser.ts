import type { ParsedFileMeta, ParsedMessage } from "./types";

const DB_NAME = "html-message-search";
const DB_VERSION = 3;

export type StoredAsset = {
  key: string;
  name: string;
  type: string;
  blob: Blob;
};

type StoredFile = {
  fileId: string;
  meta: ParsedFileMeta;
  messages: ParsedMessage[];
  originals?: Array<{ name: string; html: string }>;
  assets?: StoredAsset[];
  // Back-compat (DB v1)
  originalHtml?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "fileId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
  });
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction error"));
  });
}

function computeMeta(args: {
  fileId: string;
  originalName: string;
  messages: ParsedMessage[];
}): ParsedFileMeta {
  const timestamps = args.messages
    .map((m) => m.timestampMs)
    .filter((v): v is number => typeof v === "number");

  return {
    fileId: args.fileId,
    originalName: args.originalName,
    messageCount: args.messages.length,
    senders: Array.from(new Set(args.messages.map((m) => m.sender))).sort(),
    minTimestampMs: timestamps.length ? Math.min(...timestamps) : null,
    maxTimestampMs: timestamps.length ? Math.max(...timestamps) : null,
    createdAtMs: Date.now(),
  };
}

export async function saveParsedFileBrowser(args: {
  fileId: string;
  originalName: string;
  messages: ParsedMessage[];
  originals: Array<{ name: string; html: string }>;
  assets?: StoredAsset[];
}): Promise<ParsedFileMeta> {
  const meta = computeMeta(args);

  const db = await openDb();
  const tx = db.transaction(["files"], "readwrite");
  const store = tx.objectStore("files");

  store.put({
    fileId: args.fileId,
    meta,
    messages: args.messages,
    originals: args.originals,
    assets: args.assets,
  } satisfies StoredFile);

  await txDone(tx);
  db.close();
  return meta;
}

export async function loadParsedFileBrowser(fileId: string): Promise<{
  meta: ParsedFileMeta;
  messages: ParsedMessage[];
  originals: Array<{ name: string; html: string }>;
  assets: StoredAsset[];
}> {
  const db = await openDb();
  const tx = db.transaction(["files"], "readonly");
  const store = tx.objectStore("files");

  const value = await requestToPromise(store.get(fileId) as IDBRequest<StoredFile | undefined>);
  await txDone(tx);
  db.close();

  if (!value) {
    throw new Error("Unknown fileId");
  }

  const originals =
    value.originals && value.originals.length
      ? value.originals
      : value.originalHtml
        ? [{ name: value.meta.originalName, html: value.originalHtml }]
        : [];

  return { meta: value.meta, messages: value.messages, originals, assets: value.assets ?? [] };
}

export async function listStoredFilesBrowser(): Promise<ParsedFileMeta[]> {
  const db = await openDb();
  const tx = db.transaction(["files"], "readonly");
  const store = tx.objectStore("files");

  const all = await requestToPromise(store.getAll() as IDBRequest<StoredFile[]>);
  await txDone(tx);
  db.close();

  return all.map((f) => f.meta).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export async function deleteStoredFileBrowser(fileId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(["files"], "readwrite");
  const store = tx.objectStore("files");

  store.delete(fileId);

  await txDone(tx);
  db.close();
}
