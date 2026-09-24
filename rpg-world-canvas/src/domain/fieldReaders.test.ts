import { describe, expect, it } from "vitest";
import { defaultEconomyFields, readEconomyFields } from "./economyFields";
import { defaultEventFields, readEventFields } from "./eventFields";
import { defaultNpcFields, readNpcFields } from "./npcFields";
import { defaultProjectFields, projectProgress, readProjectFields } from "./projectFields";
import { defaultQuestFields, readQuestFields } from "./questFields";
import { defaultRelationStats, readRelationStats } from "./relationStats";
import { defaultResourceFields, isResourceCritical, readResourceFields } from "./resourceFields";
import { defaultRuleFields, readRuleFields } from "./ruleFields";
import { defaultSessionFields, readSessionFields } from "./sessionFields";
import { defaultSettlementFields, readSettlementFields } from "./settlementFields";

describe("leitores de campos por tipo", () => {
  it("npc: retorna os padrões para um bag vazio (elemento antigo/sem esses campos)", () => {
    expect(readNpcFields({})).toEqual(defaultNpcFields());
  });

  it("npc: lê valores presentes e ignora tipos incompatíveis", () => {
    const fields = readNpcFields({ age: "34", traits: ["leal"], knowledge: "não é array" });
    expect(fields.age).toBe("34");
    expect(fields.traits).toEqual(["leal"]);
    expect(fields.knowledge).toEqual([]); // valor incompatível cai no padrão, não quebra
  });

  it("quest: retorna os padrões para um bag vazio", () => {
    expect(readQuestFields({})).toEqual(defaultQuestFields());
  });

  it("quest: lê objetivos e relógio", () => {
    const fields = readQuestFields({
      mainObjective: "Salvar Hector",
      secondaryObjectives: [{ id: "o1", text: "Encontrar pistas", done: false }],
      clock: { label: "Prazo", current: 2, max: 4 },
    });
    expect(fields.mainObjective).toBe("Salvar Hector");
    expect(fields.secondaryObjectives).toHaveLength(1);
    expect(fields.clock).toEqual({ label: "Prazo", current: 2, max: 4 });
  });

  it("sessão: retorna os padrões para um bag vazio", () => {
    expect(readSessionFields({})).toEqual(defaultSessionFields());
  });

  it("sessão: lê finalizedAt como número ou cai no padrão", () => {
    expect(readSessionFields({ finalizedAt: 123 }).finalizedAt).toBe(123);
    expect(readSessionFields({ finalizedAt: "não é número" }).finalizedAt).toBeNull();
  });

  it("evento: retorna os padrões para um bag vazio", () => {
    expect(readEventFields({})).toEqual(defaultEventFields());
  });

  it("relação: estatísticas ficam nulas quando ausentes, sem forçar valores", () => {
    expect(readRelationStats({})).toEqual(defaultRelationStats());
    expect(readRelationStats({ trust: 5, fear: 2 })).toMatchObject({ trust: 5, fear: 2, respect: null });
  });

  it("regra: retorna os padrões para um bag vazio", () => {
    expect(readRuleFields({})).toEqual(defaultRuleFields());
  });

  it("regra: ignora um tipo de relação desconhecido na ação e cai no padrão", () => {
    const fields = readRuleFields({
      enabled: false,
      trigger: { entityId: "e1", value: "Concluída" },
      action: { kind: "create_relation", targetEntityId: "e2", relationType: "isso-nao-existe" },
    });
    expect(fields.enabled).toBe(false);
    expect(fields.trigger).toEqual({ kind: "status_equals", entityId: "e1", value: "Concluída" });
    expect(fields.action.relationType).toBe(defaultRuleFields().action.relationType);
  });

  it("regra: um log malformado nunca quebra, cai em lista vazia", () => {
    expect(readRuleFields({ log: "não é array" }).log).toEqual([]);
  });

  it("assentamento: retorna os padrões para um bag vazio", () => {
    expect(readSettlementFields({})).toEqual(defaultSettlementFields());
  });

  it("assentamento: prosperidade/estabilidade ficam sempre entre 0 e 100, mesmo com valor fora da faixa", () => {
    expect(readSettlementFields({ prosperity: 150, stability: -20 })).toMatchObject({ prosperity: 100, stability: 0 });
  });

  it("assentamento: um estágio desconhecido cai no padrão", () => {
    expect(readSettlementFields({ stage: "Não existe" }).stage).toBe(defaultSettlementFields().stage);
  });

  it("projeto: retorna os padrões para um bag vazio", () => {
    expect(readProjectFields({})).toEqual(defaultProjectFields());
  });

  it("projeto: progresso é sempre derivado das etapas, nunca armazenado", () => {
    const fields = readProjectFields({ stages: [{ id: "1", text: "a", done: true }, { id: "2", text: "b", done: false }] });
    expect(projectProgress(fields)).toEqual({ done: 1, total: 2, percent: 50 });
    expect(projectProgress(defaultProjectFields())).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("economia: retorna os padrões para um bag vazio", () => {
    expect(readEconomyFields({})).toEqual(defaultEconomyFields());
  });

  it("economia: uma raridade desconhecida cai no padrão, preço não numérico também", () => {
    const fields = readEconomyFields({ rarity: "Épico demais", price: "caro" });
    expect(fields.rarity).toBe(defaultEconomyFields().rarity);
    expect(fields.price).toBe(defaultEconomyFields().price);
  });

  it("recurso: retorna os padrões para um bag vazio", () => {
    expect(readResourceFields({})).toEqual(defaultResourceFields());
  });

  it("recurso: crítico é sempre derivado (estoque <= limite), nunca armazenado", () => {
    expect(isResourceCritical(readResourceFields({ stock: 5, criticalThreshold: 10 }))).toBe(true);
    expect(isResourceCritical(readResourceFields({ stock: 20, criticalThreshold: 10 }))).toBe(false);
    expect(isResourceCritical(readResourceFields({ stock: 10, criticalThreshold: 10 }))).toBe(true);
  });
});
