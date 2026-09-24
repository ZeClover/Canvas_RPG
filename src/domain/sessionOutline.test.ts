import { describe, expect, it } from "vitest";
import { createDemoWorkspace } from "../data/seed";
import { buildSessionOutline } from "./sessionOutline";

describe("roteiro da sessão", () => {
  it("ordena o fluxo sem perder ramificações", () => {
    const state = createDemoWorkspace();
    const outline = buildSessionOutline(state.nodes, state.regions, state.connections, "session_01");
    expect(outline[0].id).toBe("n_intro");
    expect(new Set(outline.map((node) => node.id)).size).toBe(outline.length);
    expect(outline.some((node) => node.id === "n_end")).toBe(true);
  });

  it("não inclui caixas externas à sessão", () => {
    const state = createDemoWorkspace();
    const outline = buildSessionOutline(state.nodes, state.regions, state.connections, "session_01");
    expect(outline.some((node) => node.id === "l_dungeon")).toBe(false);
  });
});
