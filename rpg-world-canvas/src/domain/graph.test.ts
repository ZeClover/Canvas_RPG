import { describe, expect, it } from "vitest";
import { bfsFrom, buildAdjacency, causalChain, degreeCounts, orphanEntities } from "./graph";
import type { Entity, Relation } from "./types";

function entity(id: string, kind: Entity["kind"] = "clue"): Entity {
  return {
    id, campaignId: "c1", kind, title: id, summary: "", color: null, icon: null, imageSrc: null,
    tags: [], status: null, fields: {}, x: 0, y: 0, width: 100, height: 100, groupId: null,
    visibility: "gm_only", important: false, createdAt: 0, updatedAt: 0,
  };
}

function relation(id: string, from: string, to: string, type: Relation["type"] = "points_to"): Relation {
  return {
    id, campaignId: "c1", fromEntityId: from, toEntityId: to, type, label: "", description: "",
    date: null, sessionId: null, importance: null, state: null, fields: {}, history: [], createdAt: 0, updatedAt: 0,
  };
}

describe("graph: BFS e grau (Mystery Board)", () => {
  // a - b - c - d, e isolado
  const relations = [relation("r1", "a", "b"), relation("r2", "b", "c"), relation("r3", "c", "d")];

  it("bfsFrom encontra vizinhos por distância, respeitando o limite de profundidade", () => {
    const adjacency = buildAdjacency(relations);
    const within1 = bfsFrom("a", adjacency, 1);
    expect(within1.map((node) => node.entityId)).toEqual(["b"]);

    const within3 = bfsFrom("a", adjacency, 3).sort((x, y) => x.distance - y.distance);
    expect(within3.map((node) => node.entityId)).toEqual(["b", "c", "d"]);
    expect(within3.find((node) => node.entityId === "d")?.distance).toBe(3);
  });

  it("bfsFrom nunca inclui o próprio ponto de partida", () => {
    const adjacency = buildAdjacency(relations);
    const result = bfsFrom("a", adjacency, 5);
    expect(result.some((node) => node.entityId === "a")).toBe(false);
  });

  it("degreeCounts soma as duas pontas de cada relação", () => {
    const counts = degreeCounts(relations);
    expect(counts.get("a")).toBe(1);
    expect(counts.get("b")).toBe(2);
    expect(counts.get("c")).toBe(2);
    expect(counts.get("d")).toBe(1);
    expect(counts.get("e")).toBeUndefined();
  });

  it("orphanEntities só retorna quem não tem nenhuma relação", () => {
    const entities = [entity("a"), entity("b"), entity("e")];
    const orphans = orphanEntities(entities, relations);
    expect(orphans.map((e) => e.id)).toEqual(["e"]);
  });
});

describe("graph: causalChain (Butterfly Effect)", () => {
  const entitiesById = new Map([
    ["rumor", entity("rumor", "rumor")],
    ["event", entity("event", "event")],
    ["quest", entity("quest", "quest")],
    ["sidequest", entity("sidequest", "side_quest")],
  ]);
  const relations = [
    relation("r1", "rumor", "event", "originated_from"), // não é tipo causal — não deve entrar na cadeia
    relation("r2", "event", "quest", "leads_to"),
    relation("r3", "quest", "sidequest", "leads_to"),
  ];
  const causalTypes = new Set(["caused", "leads_to"]);

  it("segue a cadeia para frente só pelos tipos de relação causal informados", () => {
    const forward = causalChain("event", entitiesById, relations, causalTypes, "forward");
    expect(forward).toHaveLength(1);
    expect(forward[0].entity.id).toBe("quest");
    expect(forward[0].children).toHaveLength(1);
    expect(forward[0].children[0].entity.id).toBe("sidequest");
  });

  it("segue a cadeia para trás a partir de um nó no meio", () => {
    const backward = causalChain("quest", entitiesById, relations, causalTypes, "backward");
    expect(backward).toHaveLength(1);
    expect(backward[0].entity.id).toBe("event");
    // "rumor -> event" usa originated_from, que não está no conjunto causal — cadeia para por aqui
    expect(backward[0].children).toHaveLength(0);
  });

  it("é seguro contra ciclos (não recursiona para sempre)", () => {
    const cyclicRelations = [relation("r1", "a", "b", "caused"), relation("r2", "b", "a", "caused")];
    const cyclicEntities = new Map([["a", entity("a")], ["b", entity("b")]]);
    const result = causalChain("a", cyclicEntities, cyclicRelations, new Set(["caused"]), "forward");
    expect(result).toHaveLength(1);
    expect(result[0].entity.id).toBe("b");
    expect(result[0].children).toHaveLength(0); // "b -> a" seria revisitar "a", cortado
  });
});
