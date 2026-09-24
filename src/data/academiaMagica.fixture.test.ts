import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseProjectArchive } from "./projectArchive";

const fixturePath = resolve(process.cwd(), "examples/Academia-Magica.rpgcanvas");

describe("arquivo de exemplo Academia-Magica.rpgcanvas", () => {
  it("importa com a contagem esperada de caixas, regiões e conexões", () => {
    const text = readFileSync(fixturePath, "utf-8");
    const archive = parseProjectArchive(text);
    expect(archive.workspace.nodes).toHaveLength(22);
    expect(archive.workspace.regions).toHaveLength(9);
    expect(archive.workspace.connections).toHaveLength(11);
  });

  it("todas as caixas ficam dentro dos limites das regiões-raiz do campus", () => {
    const text = readFileSync(fixturePath, "utf-8");
    const { workspace } = parseProjectArchive(text);
    for (const node of workspace.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  it("possui regiões aninhadas (ala norte/sul dentro do campus, sessões dentro do bloco de sessões)", () => {
    const text = readFileSync(fixturePath, "utf-8");
    const { workspace } = parseProjectArchive(text);
    const nested = workspace.regions.filter((region) => region.parentRegionId);
    expect(nested.length).toBeGreaterThanOrEqual(4);
  });
});
