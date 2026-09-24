import type { CanvasNode, WorldPoint } from "./types";

export const MAX_RENDERED_NODES = 1400;

export function applyNodeRenderBudget(nodes: CanvasNode[], center: WorldPoint, limit = MAX_RENDERED_NODES): CanvasNode[] {
  if (nodes.length <= limit) return nodes;
  return [...nodes]
    .sort((a, b) => {
      if (a.important !== b.important) return a.important ? -1 : 1;
      const distanceA = (a.x - center.x) ** 2 + (a.y - center.y) ** 2;
      const distanceB = (b.x - center.x) ** 2 + (b.y - center.y) ** 2;
      return distanceA - distanceB;
    })
    .slice(0, limit);
}
