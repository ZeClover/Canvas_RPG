import { describe, expect, it } from "vitest";
import { evaluateRulesOnce } from "./rulesEngine";
import type { Entity, Relation } from "./types";

function entity(id: string, kind: Entity["kind"], status: string | null = null, fields: Record<string, unknown> = {}): Entity {
  return {
    id, campaignId: "c1", kind, title: id, summary: "", color: null, icon: null, imageSrc: null,
    tags: [], status, fields, x: 0, y: 0, width: 100, height: 100, groupId: null,
    visibility: "gm_only", important: false, createdAt: 0, updatedAt: 0,
  };
}

function ruleEntity(id: string, overrides: Record<string, unknown> = {}) {
  return entity(id, "rule", null, {
    enabled: true,
    trigger: { kind: "status_equals", entityId: "watched", value: "Concluída" },
    action: { kind: "set_status", targetEntityId: "target", value: "Disponível", relationType: "leads_to" },
    log: [],
    ...overrides,
  });
}

describe("rulesEngine: evaluateRulesOnce", () => {
  it("dispara quando a entidade observada acabou de chegar ao status do gatilho", () => {
    const rule = ruleEntity("rule1");
    const watchedBefore = entity("watched", "quest", "Ativa");
    const watchedAfter = entity("watched", "quest", "Concluída");
    const target = entity("target", "quest", "Indisponível");

    const result = evaluateRulesOnce(
      [rule],
      new Map([["watched", watchedBefore]]),
      [watchedAfter, target, rule],
      [],
    );

    expect(result.entityUpdates.get("target")).toEqual({ status: "Disponível" });
    expect(result.ruleFieldUpdates.get("rule1")).toBeDefined();
    expect((result.ruleFieldUpdates.get("rule1") as { log: unknown[] }).log).toHaveLength(1);
  });

  it("não dispara de novo se o status já estava no valor do gatilho (evita loop a cada commit)", () => {
    const rule = ruleEntity("rule1");
    const watchedSame = entity("watched", "quest", "Concluída");
    const target = entity("target", "quest", "Indisponível");

    const result = evaluateRulesOnce(
      [rule],
      new Map([["watched", watchedSame]]), // já estava "Concluída" antes deste commit também
      [watchedSame, target, rule],
      [],
    );

    expect(result.entityUpdates.size).toBe(0);
  });

  it("regra desativada nunca dispara", () => {
    const rule = ruleEntity("rule1", { enabled: false });
    const watchedBefore = entity("watched", "quest", "Ativa");
    const watchedAfter = entity("watched", "quest", "Concluída");
    const target = entity("target", "quest", "Indisponível");

    const result = evaluateRulesOnce([rule], new Map([["watched", watchedBefore]]), [watchedAfter, target, rule], []);
    expect(result.entityUpdates.size).toBe(0);
  });

  it("ação create_relation não duplica uma relação já existente", () => {
    const rule = ruleEntity("rule1", { action: { kind: "create_relation", targetEntityId: "target", value: "", relationType: "leads_to" } });
    const watchedBefore = entity("watched", "quest", "Ativa");
    const watchedAfter = entity("watched", "quest", "Concluída");
    const target = entity("target", "quest", "Indisponível");
    const existing: Relation = {
      id: "existing", campaignId: "c1", fromEntityId: "watched", toEntityId: "target", type: "leads_to",
      label: "", description: "", date: null, sessionId: null, importance: null, state: null,
      fields: {}, history: [], createdAt: 0, updatedAt: 0,
    };

    const result = evaluateRulesOnce([rule], new Map([["watched", watchedBefore]]), [watchedAfter, target, rule], [existing]);
    expect(result.newRelations).toHaveLength(0);
  });

  it("ação mark_important marca o alvo, sem alterar o status", () => {
    const rule = ruleEntity("rule1", { action: { kind: "mark_important", targetEntityId: "target", value: "", relationType: "leads_to" } });
    const watchedBefore = entity("watched", "quest", "Ativa");
    const watchedAfter = entity("watched", "quest", "Concluída");
    const target = entity("target", "npc");

    const result = evaluateRulesOnce([rule], new Map([["watched", watchedBefore]]), [watchedAfter, target, rule], []);
    expect(result.entityUpdates.get("target")).toEqual({ important: true });
  });
});
