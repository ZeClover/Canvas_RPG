import type { Entity, ViewFilter } from "./types";

export function matchesViewFilter(entity: Entity, filter: ViewFilter): boolean {
  if (filter.kinds && filter.kinds.length && entity.kind !== "group" && !filter.kinds.includes(entity.kind)) return false;
  if (filter.tags && filter.tags.length && !filter.tags.some((tag) => entity.tags.includes(tag))) return false;
  if (filter.groupIds && filter.groupIds.length) {
    if (!entity.groupId || !filter.groupIds.includes(entity.groupId)) return false;
  }
  if (filter.status && filter.status.length && (!entity.status || !filter.status.includes(entity.status))) return false;
  if (filter.search && filter.search.trim()) {
    const query = filter.search.trim().toLowerCase();
    const haystack = `${entity.title} ${entity.summary} ${entity.tags.join(" ")}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

/** A View never duplicates data — it just decides which of the same
 * entities show up. Empty filter = show everything (the "Visão Geral"). */
export function applyViewFilter(entities: Entity[], filter: ViewFilter): Entity[] {
  const isEmpty = !filter.kinds?.length && !filter.tags?.length && !filter.groupIds?.length && !filter.status?.length && !filter.search?.trim();
  if (isEmpty) return entities;
  return entities.filter((entity) => matchesViewFilter(entity, filter));
}
