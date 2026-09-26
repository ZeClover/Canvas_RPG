// Deterministic string search/ranking shared by the Command Palette (and
// anywhere else a "find this entity" box is needed) — no fuzzy scoring
// library, no AI: just substring matching over accent-insensitive text,
// ranked so a name match always outranks a tag or summary match.

import { kindConfig } from "./entityKindRegistry";
import type { Entity } from "./types";

export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type MatchField = "title" | "tag" | "summary" | "kind";

export interface EntityMatch {
  entity: Entity;
  rank: number;
  field: MatchField;
}

const RANK_BY_FIELD: Record<MatchField, number> = { title: 0, tag: 2, summary: 3, kind: 4 };

/** Null when the query doesn't match anywhere. Title matches always beat
 * tag matches, which always beat summary matches — a title match that
 * starts with the query ranks above one that merely contains it. */
export function rankEntityMatch(entity: Entity, rawQuery: string): EntityMatch | null {
  const query = normalizeSearchText(rawQuery.trim());
  if (!query) return { entity, rank: 0, field: "title" };
  const title = normalizeSearchText(entity.title);
  if (title.includes(query)) {
    return { entity, rank: title.startsWith(query) ? 0 : 1, field: "title" };
  }
  if (entity.tags.some((tag) => normalizeSearchText(tag).includes(query))) {
    return { entity, rank: RANK_BY_FIELD.tag, field: "tag" };
  }
  if (normalizeSearchText(entity.summary).includes(query)) {
    return { entity, rank: RANK_BY_FIELD.summary, field: "summary" };
  }
  if (normalizeSearchText(kindConfig(entity.kind).label).includes(query)) {
    return { entity, rank: RANK_BY_FIELD.kind, field: "kind" };
  }
  return null;
}

export function searchEntities(entities: Entity[], query: string, limit = 60): EntityMatch[] {
  const matches: EntityMatch[] = [];
  for (const entity of entities) {
    const match = rankEntityMatch(entity, query);
    if (match) matches.push(match);
  }
  return matches.sort((a, b) => a.rank - b.rank || a.entity.title.localeCompare(b.entity.title)).slice(0, limit);
}

/** Stable re-sort that bubbles favorited items to the front without
 * otherwise disturbing relative order — used so Command Palette results
 * put favorites first only while browsing (empty query), never overriding
 * an actual name/tag/summary match's relevance once the GM is searching. */
export function sortFavoritesFirst<T>(items: T[], isFavorite: (item: T) => boolean): T[] {
  return [...items].sort((a, b) => Number(isFavorite(b)) - Number(isFavorite(a)));
}

export interface TextSegment {
  text: string;
  matched: boolean;
}

/** Splits `text` into segments so the caller can render the part(s) that
 * matched `query` differently — accent/case-insensitive, but the ORIGINAL
 * casing/accents of `text` are preserved in the returned segments. */
export function highlightSegments(text: string, query: string): TextSegment[] {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return [{ text, matched: false }];
  const normalizedText = normalizeSearchText(text);
  const segments: TextSegment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = normalizedText.indexOf(normalizedQuery, cursor);
    if (index === -1) {
      segments.push({ text: text.slice(cursor), matched: false });
      break;
    }
    if (index > cursor) segments.push({ text: text.slice(cursor, index), matched: false });
    segments.push({ text: text.slice(index, index + normalizedQuery.length), matched: true });
    cursor = index + normalizedQuery.length;
  }
  return segments.length ? segments : [{ text, matched: false }];
}
