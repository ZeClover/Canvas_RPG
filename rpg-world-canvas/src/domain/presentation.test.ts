import { describe, expect, it } from "vitest";
import { presentationContent } from "./presentation";
import type { Entity } from "./types";

function baseEntity(overrides: Partial<Entity>): Entity {
  return {
    id: "e1", campaignId: "c1", kind: "npc", title: "Vivian", summary: "Bibliotecária misteriosa.",
    color: null, icon: null, imageSrc: "data:image/png;base64,xyz", tags: [], status: null, fields: {},
    x: 0, y: 0, width: 240, height: 126, groupId: null, visibility: "gm_only", important: false,
    createdAt: 0, updatedAt: 0, ...overrides,
  };
}

describe("presentationContent", () => {
  it("gm_only: no summary, no image, nothing leaks", () => {
    const content = presentationContent(baseEntity({ visibility: "gm_only" }));
    expect(content).toEqual({ title: "Vivian", imageSrc: null, body: "", state: "gm_only" });
  });

  it("partial: title only, no summary, no image — same as Player Knowledge View", () => {
    const content = presentationContent(baseEntity({ visibility: "partial" }));
    expect(content).toEqual({ title: "Vivian", imageSrc: null, body: "", state: "partial" });
  });

  it("revealed: full summary and image", () => {
    const content = presentationContent(baseEntity({ visibility: "revealed" }));
    expect(content).toEqual({ title: "Vivian", imageSrc: "data:image/png;base64,xyz", body: "Bibliotecária misteriosa.", state: "revealed" });
  });

  it("revealed scene: prefers the read-aloud text over the summary", () => {
    const scene = baseEntity({
      kind: "scene", visibility: "revealed", summary: "resumo interno do mestre",
      fields: { readAloud: "A porta racha ao meio, e um cheiro de terra molhada escapa pelo vão." },
    });
    expect(presentationContent(scene).body).toBe("A porta racha ao meio, e um cheiro de terra molhada escapa pelo vão.");
  });

  it("revealed scene without read-aloud text falls back to the summary", () => {
    const scene = baseEntity({ kind: "scene", visibility: "revealed", summary: "resumo simples", fields: {} });
    expect(presentationContent(scene).body).toBe("resumo simples");
  });

  it("falls back to a placeholder title when the entity has none", () => {
    expect(presentationContent(baseEntity({ visibility: "revealed", title: "" })).title).toBe("Sem título");
  });
});
