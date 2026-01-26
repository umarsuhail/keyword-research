export type ParsedMessage = {
  id: string;
  sender: string;
  text: string;
  textNorm: string;
  timestampRaw: string;
  timestampMs: number | null;
};

export type ParsedFileMeta = {
  fileId: string;
  originalName: string;
  messageCount: number;
  senders: string[];
  minTimestampMs: number | null;
  maxTimestampMs: number | null;
  createdAtMs: number;
};

export type SearchParams = {
  q: string;
  exclude?: string;
  matchMode?: "substring" | "word";
  sender?: string;
  fromMs?: number;
  toMs?: number;
  offset: number;
  limit: number;
};

export type SearchHit = {
  id: string;
  sender: string;
  timestampRaw: string;
  timestampMs: number | null;
  text: string;
  snippet: string;
};

export type SearchResponse = {
  fileId: string;
  total: number;
  offset: number;
  limit: number;
  results: SearchHit[];
};
