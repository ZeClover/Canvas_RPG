import { describe, expect, it } from "vitest";
import { highlightSegments, rankEntityMatch, searchEntities, sortFavoritesFirst } from "./search";
import type { Entity } from "./types";

function entity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: "e1", campaignId: "c1", kind: "npc", title: "Vivian Ashcombe", summary: "", color: null, icon: null,
    imageSrc: null, tags: [], status: null, fields: {}, x: 0, y: 0, width: 240, height: 126, groupId: null,
    visibility: "gm_only", important: false, createdAt: 0, updatedAt: 0, ...overrides,
  };
}

describe("search: rankEntityMatch", () => {
  it("nome que começa com a busca rankeia acima de nome que só contém", () => {
    const starts = rankEntityMatch(entity({ id: "a", title: "Vivian Ashcombe" }), "vivian");
    const contains = rankEntityMatch(entity({ id: "b", title: "A Bibliotecária Vivian" }), "vivian");
    expect(starts?.rank).toBeLessThan(contains!.rank);
  });

  it("acento e maiúscula não importam", () => {
    expect(rankEntityMatch(entity({ title: "Vivián" }), "vivian")?.field).toBe("title");
  });

  it("nome sempre bate antes de tag ou resumo, mesmo quando os três combinam", () => {
    const withAllThree = entity({ title: "Vivian Ashcombe", tags: ["vivian-plot"], summary: "sobre vivian" });
    expect(rankEntityMatch(withAllThree, "vivian")?.field).toBe("title");
  });

  it("cai para tag quando o nome não bate", () => {
    const match = rankEntityMatch(entity({ title: "Kaleb Orne", tags: ["aluno-suspeito"] }), "suspeito");
    expect(match?.field).toBe("tag");
  });

  it("cai para resumo quando nome e tag não batem", () => {
    const match = rankEntityMatch(entity({ title: "Kaleb Orne", summary: "Suspeito de roubar o grimório" }), "grimório");
    expect(match?.field).toBe("summary");
  });

  it("retorna null quando nada bate", () => {
    expect(rankEntityMatch(entity({ title: "Kaleb Orne" }), "inexistente")).toBeNull();
  });

  it("string vazia bate com tudo (busca em branco = lista tudo)", () => {
    expect(rankEntityMatch(entity(), "")).not.toBeNull();
  });
});

describe("search: searchEntities", () => {
  it("ordena por rank e depois por título, limitando a quantidade de resultados", () => {
    const entities = [
      entity({ id: "1", title: "Zebra do Vale" }),
      entity({ id: "2", title: "Vivian Ashcombe" }),
      entity({ id: "3", title: "Alguém que menciona vivian no resumo", summary: "conhece a vivian" }),
    ];
    const results = searchEntities(entities, "vivian");
    expect(results.map((r) => r.entity.id)).toEqual(["2", "3"]); // título bate antes de resumo
  });
});

describe("search: sortFavoritesFirst", () => {
  it("move favoritos para o início, preservando a ordem relativa dos demais", () => {
    const items = ["a", "b", "c", "d"];
    const favorites = new Set(["c"]);
    expect(sortFavoritesFirst(items, (item) => favorites.has(item))).toEqual(["c", "a", "b", "d"]);
  });

  it("sem nenhum favorito, a ordem não muda", () => {
    const items = ["a", "b", "c"];
    expect(sortFavoritesFirst(items, () => false)).toEqual(["a", "b", "c"]);
  });

  it("com múltiplos favoritos, preserva a ordem relativa entre eles e entre os não-favoritos", () => {
    const items = ["a", "b", "c", "d", "e"];
    const favorites = new Set(["b", "d"]);
    expect(sortFavoritesFirst(items, (item) => favorites.has(item))).toEqual(["b", "d", "a", "c", "e"]);
  });
});

describe("search: highlightSegments", () => {
  it("sem busca, retorna o texto inteiro como não-casado", () => {
    expect(highlightSegments("Vivian Ashcombe", "")).toEqual([{ text: "Vivian Ashcombe", matched: false }]);
  });

  it("marca o trecho casado preservando maiúsculas/acentos originais", () => {
    const segments = highlightSegments("Vivián Ashcombe", "vivian");
    expect(segments).toEqual([{ text: "Vivián", matched: true }, { text: " Ashcombe", matched: false }]);
  });

  it("quando não casa em lugar nenhum, tudo vira um único trecho não-casado", () => {
    expect(highlightSegments("Kaleb Orne", "vivian")).toEqual([{ text: "Kaleb Orne", matched: false }]);
  });
});
