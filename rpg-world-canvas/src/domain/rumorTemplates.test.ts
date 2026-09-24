import { describe, expect, it } from "vitest";
import { renderTemplate, RUMOR_TEMPLATES, templateIsComplete } from "./rumorTemplates";

describe("rumorTemplates: montagem determinística de texto", () => {
  it("todo template tem pelo menos um espaço reservado (slot)", () => {
    for (const template of RUMOR_TEMPLATES) {
      expect(template.segments.some((segment) => segment.type === "slot")).toBe(true);
    }
  });

  it("renderTemplate mostra placeholder para slots ainda não preenchidos", () => {
    const template = RUMOR_TEMPLATES[0];
    expect(renderTemplate(template, {})).toContain("___");
  });

  it("renderTemplate monta o texto final usando os valores preenchidos, sem inventar nada", () => {
    const template = RUMOR_TEMPLATES.find((candidate) => candidate.id === "seen_doing")!;
    const text = renderTemplate(template, { npc: "Kaleb Orne", local: "A Dungeon" });
    expect(text).toBe("Dizem que Kaleb Orne foi visto perto de A Dungeon fazendo algo que ninguém quer explicar.");
  });

  it("templateIsComplete só é true quando todo slot tem um valor não vazio", () => {
    const template = RUMOR_TEMPLATES.find((candidate) => candidate.id === "seen_doing")!;
    expect(templateIsComplete(template, {})).toBe(false);
    expect(templateIsComplete(template, { npc: "Kaleb Orne" })).toBe(false);
    expect(templateIsComplete(template, { npc: "Kaleb Orne", local: "  " })).toBe(false);
    expect(templateIsComplete(template, { npc: "Kaleb Orne", local: "A Dungeon" })).toBe(true);
  });
});
