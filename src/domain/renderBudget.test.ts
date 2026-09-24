import { describe, expect, it } from "vitest";
import type { CanvasNode } from "./types";
import { applyNodeRenderBudget } from "./renderBudget";

function node(id: string, x: number, important = false): CanvasNode {
  return { id, projectId: "p", regionId: null, sourceNodeId: null, groupId: null, title: id, body: "", instanceNotes: "", kind: "free", x, y: 0, width: 200, height: 100, color: "#111", imageSrc: null, tags: [], important, createdAt: 0, updatedAt: 0 };
}

describe("orçamento de renderização", () => {
  it("prioriza nós importantes e os mais próximos do centro", () => {
    const result = applyNodeRenderBudget([node("longe", 900), node("perto", 10), node("importante", 2000, true)], { x: 0, y: 0 }, 2);
    expect(result.map((item) => item.id)).toEqual(["importante", "perto"]);
  });

  it("preserva a lista quando ela cabe no limite", () => {
    const items = [node("a", 0), node("b", 1)];
    expect(applyNodeRenderBudget(items, { x: 0, y: 0 }, 2)).toBe(items);
  });
});
