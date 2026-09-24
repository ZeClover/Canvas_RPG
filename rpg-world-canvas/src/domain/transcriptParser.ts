// Deterministic transcript parsing and search — plain string processing,
// no AI. Importing SRT/VTT strips only the caption markup (index numbers,
// timestamps); every word of dialogue is preserved verbatim.

import type { TranscriptFormat } from "./transcriptFields";

const TIMESTAMP_LINE = /^\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/;
const NUMERIC_INDEX_LINE = /^\s*\d+\s*$/;

export function detectFormatFromFilename(name: string): TranscriptFormat {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  if (extension === "srt") return "srt";
  if (extension === "vtt") return "vtt";
  if (extension === "txt") return "txt";
  return "outro";
}

/** Strips SRT/VTT caption markup down to plain spoken text. TXT (or any
 * unrecognized format) passes through unchanged — there's nothing to
 * strip. */
export function stripTranscriptMarkup(raw: string, format: TranscriptFormat): string {
  if (format !== "srt" && format !== "vtt") return raw;
  const lines = raw.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === "WEBVTT") continue;
    if (NUMERIC_INDEX_LINE.test(trimmed)) continue;
    if (TIMESTAMP_LINE.test(trimmed)) continue;
    kept.push(trimmed);
  }
  return kept.join("\n");
}

export interface KeywordMatch {
  index: number;
  snippet: string;
}

/** Plain case-insensitive substring search with surrounding context —
 * exactly "keyword-occurrence search", nothing smarter and nothing that
 * needs an AI to run. */
export function searchTranscriptKeyword(content: string, keyword: string, contextChars = 50): KeywordMatch[] {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return [];
  const haystack = content.toLowerCase();
  const matches: KeywordMatch[] = [];
  let cursor = 0;
  while (cursor <= haystack.length) {
    const foundAt = haystack.indexOf(needle, cursor);
    if (foundAt === -1) break;
    const start = Math.max(0, foundAt - contextChars);
    const end = Math.min(content.length, foundAt + needle.length + contextChars);
    const prefix = start > 0 ? "…" : "";
    const suffix = end < content.length ? "…" : "";
    matches.push({ index: foundAt, snippet: `${prefix}${content.slice(start, end)}${suffix}` });
    cursor = foundAt + needle.length;
  }
  return matches;
}
