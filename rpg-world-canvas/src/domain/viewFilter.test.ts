import { describe, expect, it } from "vitest";
import { applyViewFilter } from "./viewFilter";
import type { Entity } from "./types";

function entity(overrides: Partial<Entity>): Entity {
  return {
    id: "e1", campaignId: "c1", kind: "npc", title: "Test", summary: "", color: null, icon: null,
    imageSrc: null, tags: [], status: null, fields: {}, x: 0, y: 0, width: 240, height: 126,
    groupId: null, visibility: "gm_only", important: false, createdAt: 0, updatedAt: 0, ...overrides,
  };
}

describe("applyViewFilter", () => {
  it("retorna tudo quando o filtro está vazio", () => {
    const entities = [entity({ id: "a" }), entity({ id: "b", kind: "quest" })];
    expect(applyViewFilter(entities, {})).toBe(entities);
  });

  it("filtra por tipo, mas sempre deixa passar grupos", () => {
    const entities = [
      entity({ id: "a", kind: "npc" }),
      entity({ id: "b", kind: "quest" }),
      entity({ id: "g", kind: "group" }),
    ];
    const result = applyViewFilter(entities, { kinds: ["npc"] });
    expect(result.map((item) => item.id).sort()).toEqual(["a", "g"]);
  });

  it("filtra por etiqueta", () => {
    const entities = [entity({ id: "a", tags: ["vilao"] }), entity({ id: "b", tags: ["aliado"] })];
    expect(applyViewFilter(entities, { tags: ["vilao"] }).map((item) => item.id)).toEqual(["a"]);
  });

  it("filtra por busca no título/resumo/etiquetas", () => {
    const entities = [entity({ id: "a", title: "Vivian Ashcombe" }), entity({ id: "b", title: "Kaleb" })];
    expect(applyViewFilter(entities, { search: "vivian" }).map((item) => item.id)).toEqual(["a"]);
  });

  it("filtra por grupo", () => {
    const entities = [entity({ id: "a", groupId: "g1" }), entity({ id: "b", groupId: "g2" })];
    expect(applyViewFilter(entities, { groupIds: ["g1"] }).map((item) => item.id)).toEqual(["a"]);
  });
});
