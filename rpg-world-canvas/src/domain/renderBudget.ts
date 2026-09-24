import type { Entity, WorldPoint } from "./types";

export const MAX_RENDERED_ENTITIES = 1400;

/** When more entities are in view than the budget allows, keep the ones
 * that matter most: marked-important first, then nearest to the viewport
 * center. This is what lets "milhares de elementos" stay a fluid canvas
 * instead of forcing a render of everything at once. */
export function applyEntityRenderBudget(entities: Entity[], center: WorldPoint, limit = MAX_RENDERED_ENTITIES): Entity[] {
  if (entities.length <= limit) return entities;
  return [...entities]
    .sort((a, b) => {
      if (a.important !== b.important) return a.important ? -1 : 1;
      const distanceA = (a.x - center.x) ** 2 + (a.y - center.y) ** 2;
      const distanceB = (b.x - center.x) ** 2 + (b.y - center.y) ** 2;
      return distanceA - distanceB;
    })
    .slice(0, limit);
}
