import { describe, expect, it } from "vitest";
import { createDemoWorkspace } from "./seed";
import {
  parseProjectArchive,
  prepareImportedWorkspace,
  safeProjectFileName,
  serializeProjectArchive,
} from "./projectArchive";

describe("arquivos de projeto", () => {
  it("exporta e importa uma campanha sem perder conteúdo", () => {
    const workspace = createDemoWorkspace();
    const restored = parseProjectArchive(serializeProjectArchive(workspace)).workspace;
    expect(restored).toEqual(workspace);
  });

  it("rejeita conexões apontando para caixas inexistentes", () => {
    const workspace = createDemoWorkspace();
    workspace.connections[0] = { ...workspace.connections[0], toNodeId: "nao_existe" };
    expect(() => serializeProjectArchive(workspace)).toThrow(/conexão aponta/i);
  });

  it("rejeita hierarquia circular de regiões", () => {
    const workspace = createDemoWorkspace();
    workspace.regions[0] = { ...workspace.regions[0], parentRegionId: workspace.regions[1].id };
    workspace.regions[1] = { ...workspace.regions[1], parentRegionId: workspace.regions[0].id };
    expect(() => serializeProjectArchive(workspace)).toThrow(/circular/i);
  });

  it("importa uma cópia sem sobrescrever IDs existentes", () => {
    const workspace = createDemoWorkspace();
    const imported = prepareImportedWorkspace(workspace, new Set([workspace.project.id]));
    expect(imported.project.id).not.toBe(workspace.project.id);
    expect(imported.project.title).toContain("importado");
    expect(imported.nodes[0].projectId).toBe(imported.project.id);
    expect(imported.connections[0].fromNodeId).toBe(imported.nodes.find((node) => node.title === "Chegada à escola")?.id);
    expect(imported.nodes.find((node) => node.sourceNodeId)?.sourceNodeId).toBe(
      imported.nodes.find((node) => node.title === "Potter Magwood" && !node.sourceNodeId)?.id,
    );
  });

  it("mantém o ID quando não existe conflito", () => {
    const workspace = createDemoWorkspace();
    expect(prepareImportedWorkspace(workspace, new Set()).project.id).toBe(workspace.project.id);
  });

  it("gera um nome seguro para o arquivo", () => {
    expect(safeProjectFileName("Academia Mágica: Ano I")).toBe("Academia-Magica-Ano-I.rpgcanvas");
  });
});
