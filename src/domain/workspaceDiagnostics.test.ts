import { describe, expect, it } from "vitest";
import { createDemoWorkspace } from "../data/seed";
import { diagnoseWorkspace } from "./workspaceDiagnostics";

describe("diagnóstico do projeto", () => {
  it("aprova o projeto de demonstração", () => {
    expect(diagnoseWorkspace(createDemoWorkspace())).toEqual([]);
  });

  it("encontra conexões e referências quebradas", () => {
    const state = createDemoWorkspace();
    state.connections[0].toNodeId = "inexistente";
    state.nodes[0].sourceNodeId = "inexistente";
    const issues = diagnoseWorkspace(state);
    expect(issues.filter((issue) => issue.severity === "error")).toHaveLength(2);
  });
});
