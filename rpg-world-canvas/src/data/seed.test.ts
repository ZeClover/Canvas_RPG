import { describe, expect, it } from "vitest";
import { ALL_MODULE_KEYS } from "../domain/modules";
import { validateCampaignData } from "./campaignArchive";
import { createDemoCampaign, createSecondDemoCampaign } from "./seed";

describe("seed: as duas campanhas de exemplo", () => {
  it.each([
    ["Academia Mágica (fantasia)", createDemoCampaign],
    ["Estação Kessler (sci-fi)", createSecondDemoCampaign],
  ])("%s passa por validateCampaignData sem lançar (nenhuma referência quebrada)", (_label, factory) => {
    const data = factory();
    expect(() => validateCampaignData(data)).not.toThrow();
  });

  it.each([
    ["Academia Mágica (fantasia)", createDemoCampaign],
    ["Estação Kessler (sci-fi)", createSecondDemoCampaign],
  ])("%s: toda relação aponta para entidades que realmente existem", (_label, factory) => {
    const data = factory();
    const ids = new Set(data.entities.map((entity) => entity.id));
    for (const relation of data.relations) {
      expect(ids.has(relation.fromEntityId)).toBe(true);
      expect(ids.has(relation.toEntityId)).toBe(true);
    }
  });

  it("as duas campanhas têm IDs completamente independentes (nenhum campaignId/entityId colide)", () => {
    const a = createDemoCampaign();
    const b = createSecondDemoCampaign();
    expect(a.campaign.id).not.toBe(b.campaign.id);
    const idsA = new Set(a.entities.map((e) => e.id));
    const idsB = new Set(b.entities.map((e) => e.id));
    for (const id of idsB) expect(idsA.has(id)).toBe(false);
  });

  it("Estação Kessler começa com um subconjunto curado de módulos (ecologia e assentamento desligados)", () => {
    const data = createSecondDemoCampaign();
    expect(data.campaign.enabledModules).not.toContain("ecology_engine");
    expect(data.campaign.enabledModules).not.toContain("settlement_engine");
    // Everything else from the full registry should still be on.
    const others = ALL_MODULE_KEYS.filter((key) => key !== "ecology_engine" && key !== "settlement_engine");
    for (const key of others) expect(data.campaign.enabledModules).toContain(key);
  });

  it("a regra semeada de Estação Kessler referencia entidades reais (oxigênio → ECO)", () => {
    const data = createSecondDemoCampaign();
    const rule = data.entities.find((entity) => entity.kind === "rule")!;
    const oxygen = data.entities.find((entity) => entity.title === "Oxigênio (Horizonte)")!;
    const eco = data.entities.find((entity) => entity.title === "ECO")!;
    const fields = rule.fields as { trigger: { entityId: string }; action: { targetEntityId: string } };
    expect(fields.trigger.entityId).toBe(oxygen.id);
    expect(fields.action.targetEntityId).toBe(eco.id);
  });
});
