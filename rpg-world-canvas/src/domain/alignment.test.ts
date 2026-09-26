import { describe, expect, it } from "vitest";
import { computeAlignment, computeDistribution } from "./alignment";

const a = { id: "a", x: 0, y: 0, width: 100, height: 50 };
const b = { id: "b", x: 300, y: 200, width: 200, height: 80 };
const c = { id: "c", x: 150, y: 100, width: 50, height: 20 };

describe("alignment: computeAlignment", () => {
  it("com menos de duas entidades não faz nada", () => {
    expect(computeAlignment([a], "left")).toEqual([]);
  });

  it("left alinha todos ao x mínimo", () => {
    const moves = computeAlignment([a, b, c], "left");
    expect(moves.find((m) => m.id === "a")).toEqual({ id: "a", x: 0, y: 0 });
    expect(moves.find((m) => m.id === "b")).toEqual({ id: "b", x: 0, y: 200 });
    expect(moves.find((m) => m.id === "c")).toEqual({ id: "c", x: 0, y: 100 });
  });

  it("right alinha a borda direita de todos à borda direita mais distante", () => {
    // borda direita máxima: b termina em 300+200=500
    const moves = computeAlignment([a, b], "right");
    expect(moves.find((m) => m.id === "a")).toEqual({ id: "a", x: 400, y: 0 });
    expect(moves.find((m) => m.id === "b")).toEqual({ id: "b", x: 300, y: 200 });
  });

  it("top/bottom fazem o equivalente no eixo vertical", () => {
    const top = computeAlignment([a, b], "top");
    expect(top.find((m) => m.id === "b")?.y).toBe(0);
    const bottom = computeAlignment([a, b], "bottom");
    // borda inferior máxima: b termina em 200+80=280
    expect(bottom.find((m) => m.id === "a")?.y).toBe(230);
  });

  it("centerX/centerY centralizam pelo centro médio do grupo, preservando o outro eixo", () => {
    const moves = computeAlignment([a, b], "centerX");
    expect(moves.find((m) => m.id === "a")?.y).toBe(0); // eixo Y intocado
    // centro de a = 50, centro de b = 400 -> média = 225
    expect(moves.find((m) => m.id === "a")?.x).toBe(175); // 225 - 100/2
    expect(moves.find((m) => m.id === "b")?.x).toBe(125); // 225 - 200/2
  });
});

describe("alignment: computeDistribution", () => {
  it("com menos de três entidades não faz nada (não há meio a distribuir)", () => {
    expect(computeDistribution([a, b], "horizontal")).toEqual([]);
  });

  it("distribui espaçamento horizontal uniforme mantendo as duas pontas fixas", () => {
    // a: x0-100, c: x150-200, b: x300-500 (ordenados por x)
    const moves = computeDistribution([a, b, c], "horizontal");
    const byId = new Map(moves.map((m) => [m.id, m]));
    expect(byId.get("a")).toEqual({ id: "a", x: 0, y: 0 }); // ponta esquerda não muda
    expect(byId.get("b")).toEqual({ id: "b", x: 300, y: 200 }); // ponta direita não muda
    // gap = (span - totalWidth) / 2 = ((500-0) - (100+50+200)) / 2 = 75
    // c começa em a.right(100) + gap(75) = 175
    expect(byId.get("c")).toEqual({ id: "c", x: 175, y: 100 });
  });

  it("distribui espaçamento vertical uniforme mantendo as duas pontas fixas", () => {
    // a: y0-50, c: y100-120, b: y200-280 (ordenados por y)
    const moves = computeDistribution([a, b, c], "vertical");
    const byId = new Map(moves.map((m) => [m.id, m]));
    expect(byId.get("a")).toEqual({ id: "a", x: 0, y: 0 });
    expect(byId.get("b")).toEqual({ id: "b", x: 300, y: 200 });
    // gap = ((280-0) - (50+80+20)) / 2 = 65
    // c começa em a.bottom(50) + gap(65) = 115
    expect(byId.get("c")).toEqual({ id: "c", x: 150, y: 115 });
  });
});
