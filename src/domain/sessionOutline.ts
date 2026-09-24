import type { CanvasConnection, CanvasNode, CanvasRegion } from "./types";

export function sessionRegionIds(regions: CanvasRegion[], sessionId: string): Set<string> {
  const ids = new Set([sessionId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const region of regions) {
      if (region.parentRegionId && ids.has(region.parentRegionId) && !ids.has(region.id)) {
        ids.add(region.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function buildSessionOutline(nodes: CanvasNode[], regions: CanvasRegion[], connections: CanvasConnection[], sessionId: string): CanvasNode[] {
  const regionIds = sessionRegionIds(regions, sessionId);
  const sessionNodes = nodes.filter((node) => node.regionId && regionIds.has(node.regionId));
  const byId = new Map(sessionNodes.map((node) => [node.id, node]));
  const indegree = new Map(sessionNodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of connections) {
    if (!byId.has(edge.fromNodeId) || !byId.has(edge.toNodeId)) continue;
    outgoing.set(edge.fromNodeId, [...(outgoing.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    indegree.set(edge.toNodeId, (indegree.get(edge.toNodeId) ?? 0) + 1);
  }
  const positionSort = (a: CanvasNode, b: CanvasNode) => a.y - b.y || a.x - b.x || a.title.localeCompare(b.title);
  const queue = sessionNodes.filter((node) => indegree.get(node.id) === 0).sort(positionSort);
  const ordered: CanvasNode[] = [];
  const visited = new Set<string>();
  while (queue.length) {
    const node = queue.shift()!;
    if (visited.has(node.id)) continue;
    visited.add(node.id);
    ordered.push(node);
    const next = (outgoing.get(node.id) ?? []).map((id) => byId.get(id)).filter((item): item is CanvasNode => Boolean(item)).sort(positionSort);
    for (const candidate of next) if (!visited.has(candidate.id)) queue.push(candidate);
  }
  ordered.push(...sessionNodes.filter((node) => !visited.has(node.id)).sort(positionSort));
  return ordered;
}
