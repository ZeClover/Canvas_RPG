import { describe, expect, it } from "vitest";
import { SpatialIndex } from "./SpatialIndex";

describe("SpatialIndex", () => {
  it("retorna somente itens que cruzam a viewport", () => {
    const index = new SpatialIndex([
      { id: "a", x: 10, y: 10, width: 100, height: 100 },
      { id: "b", x: 5000, y: 5000, width: 100, height: 100 },
    ]);
    expect(index.search({ x: 0, y: 0, width: 500, height: 500 }).map((item) => item.id)).toEqual(["a"]);
  });

  it("indexa 50 mil elementos sem duplicar resultados", () => {
    const items = Array.from({ length: 50_000 }, (_, index) => ({
      id: String(index),
      x: (index % 500) * 260,
      y: Math.floor(index / 500) * 180,
      width: 220,
      height: 120,
    }));
    const spatial = new SpatialIndex(items);
    const results = spatial.search({ x: 0, y: 0, width: 1200, height: 900 });
    expect(results.length).toBeGreaterThan(0);
    expect(new Set(results.map((item) => item.id)).size).toBe(results.length);
    expect(results.length).toBeLessThan(100);
  });
});
