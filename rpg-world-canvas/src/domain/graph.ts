// Pure, deterministic graph reading over the same entities/relations the
// rest of the app uses — no AI, no separate store. The Mystery/Conspiracy
// Board and the Butterfly Effect panel are both just different traversals
// of this one graph.

import type { Entity, Relation } from "./types";

export interface AdjacencyEdge {
  neighborId: string;
  relation: Relation;
}

/** Undirected adjacency: a relation connects both entities equally for the
 * purposes of "what's near this on the board", regardless of arrow
 * direction (direction still matters for causality, handled separately). */
export function buildAdjacency(relations: Relation[]): Map<string, AdjacencyEdge[]> {
  const adjacency = new Map<string, AdjacencyEdge[]>();
  const add = (id: string, neighborId: string, relation: Relation) => {
    const list = adjacency.get(id);
    if (list) list.push({ neighborId, relation });
    else adjacency.set(id, [{ neighborId, relation }]);
  };
  for (const relation of relations) {
    add(relation.fromEntityId, relation.toEntityId, relation);
    add(relation.toEntityId, relation.fromEntityId, relation);
  }
  return adjacency;
}

export interface BfsNode {
  entityId: string;
  distance: number;
  via: Relation | null;
}

/** Breadth-first reach from a focus entity, capped at maxDepth hops. Used
 * by the Mystery Board to answer "what's connected to this, and how far". */
export function bfsFrom(startId: string, adjacency: Map<string, AdjacencyEdge[]>, maxDepth: number): BfsNode[] {
  const visited = new Map<string, BfsNode>();
  visited.set(startId, { entityId: startId, distance: 0, via: null });
  let frontier = [startId];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of adjacency.get(id) ?? []) {
        if (visited.has(edge.neighborId)) continue;
        visited.set(edge.neighborId, { entityId: edge.neighborId, distance: depth, via: edge.relation });
        next.push(edge.neighborId);
      }
    }
    frontier = next;
  }
  visited.delete(startId);
  return [...visited.values()];
}

/** How many relations touch each entity — a simple, honest stand-in for
 * "how central is this to the conspiracy" without any inference. */
export function degreeCounts(relations: Relation[]): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const relation of relations) {
    bump(relation.fromEntityId);
    bump(relation.toEntityId);
  }
  return counts;
}

/** Entities of the given kinds with zero relations — loose threads the GM
 * hasn't connected to anything yet. */
export function orphanEntities(entities: Entity[], relations: Relation[]): Entity[] {
  const touched = new Set<string>();
  for (const relation of relations) {
    touched.add(relation.fromEntityId);
    touched.add(relation.toEntityId);
  }
  return entities.filter((entity) => !touched.has(entity.id));
}

export interface CausalNode {
  entity: Entity;
  relation: Relation;
  children: CausalNode[];
}

/** Recursive cause→effect chain, following only the given relation types
 * in the given direction, cycle-safe (a relation loop just stops instead
 * of recursing forever). This is the whole "Butterfly Effect" engine: pure
 * graph traversal over relations the GM already created, nothing guessed. */
export function causalChain(
  startId: string,
  entitiesById: Map<string, Entity>,
  relations: Relation[],
  relationTypes: Set<string>,
  direction: "forward" | "backward",
  maxDepth = 6,
): CausalNode[] {
  function expand(id: string, depth: number, visited: Set<string>): CausalNode[] {
    if (depth >= maxDepth) return [];
    const edges = relations.filter((relation) => {
      if (!relationTypes.has(relation.type)) return false;
      return direction === "forward" ? relation.fromEntityId === id : relation.toEntityId === id;
    });
    const nodes: CausalNode[] = [];
    for (const relation of edges) {
      const nextId = direction === "forward" ? relation.toEntityId : relation.fromEntityId;
      const entity = entitiesById.get(nextId);
      if (!entity || visited.has(nextId)) continue;
      const nextVisited = new Set(visited);
      nextVisited.add(nextId);
      nodes.push({ entity, relation, children: expand(nextId, depth + 1, nextVisited) });
    }
    return nodes;
  }
  return expand(startId, 0, new Set([startId]));
}
