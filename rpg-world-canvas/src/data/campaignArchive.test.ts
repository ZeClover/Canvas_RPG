import { describe, expect, it } from "vitest";
import { ALL_MODULE_KEYS } from "../domain/modules";
import { createDemoCampaign } from "./seed";
import { parseCampaignArchive, prepareImportedCampaign, safeCampaignFileName, serializeCampaignArchive } from "./campaignArchive";

describe("arquivo de campanha", () => {
  it("exporta e importa uma campanha sem perder conteúdo", () => {
    const data = createDemoCampaign();
    const restored = parseCampaignArchive(serializeCampaignArchive(data)).data;
    expect(restored).toEqual(data);
  });

  it("rejeita relações apontando para elementos inexistentes", () => {
    const data = createDemoCampaign();
    data.relations[0] = { ...data.relations[0], toEntityId: "nao_existe" };
    expect(() => serializeCampaignArchive(data)).toThrow(/relação aponta/i);
  });

  it("rejeita hierarquia circular de grupos", () => {
    const data = createDemoCampaign();
    const groups = data.entities.filter((entity) => entity.kind === "group");
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const [a, b] = groups;
    const entities = data.entities.map((entity) => {
      if (entity.id === a.id) return { ...entity, groupId: b.id };
      if (entity.id === b.id) return { ...entity, groupId: a.id };
      return entity;
    });
    expect(() => serializeCampaignArchive({ ...data, entities })).toThrow(/circular/i);
  });

  it("rejeita um elemento pertencendo a si mesmo como grupo", () => {
    const data = createDemoCampaign();
    const [first] = data.entities;
    const entities = data.entities.map((entity) => (entity.id === first.id ? { ...entity, groupId: first.id } : entity));
    expect(() => serializeCampaignArchive({ ...data, entities })).toThrow();
  });

  it("importa uma cópia sem sobrescrever IDs existentes", () => {
    const data = createDemoCampaign();
    const imported = prepareImportedCampaign(data, new Set([data.campaign.id]));
    expect(imported.campaign.id).not.toBe(data.campaign.id);
    expect(imported.campaign.title).toContain("importado");
    expect(imported.entities[0].campaignId).toBe(imported.campaign.id);
    expect(imported.relations[0].fromEntityId).not.toBe(data.relations[0].fromEntityId);
  });

  it("mantém o ID quando não existe conflito", () => {
    const data = createDemoCampaign();
    expect(prepareImportedCampaign(data, new Set()).campaign.id).toBe(data.campaign.id);
  });

  it("gera um nome seguro para o arquivo", () => {
    expect(safeCampaignFileName("Academia Mágica: Ano I")).toBe("Academia-Magica-Ano-I.rpgworld");
  });

  it("um arquivo salvo antes do sistema de módulos existir importa com tudo habilitado", () => {
    const raw = JSON.parse(serializeCampaignArchive(createDemoCampaign()));
    delete raw.data.campaign.enabledModules;
    const restored = parseCampaignArchive(JSON.stringify(raw));
    expect(restored.data.campaign.enabledModules.sort()).toEqual([...ALL_MODULE_KEYS].sort());
  });

  it("chaves de módulo desconhecidas num arquivo importado são descartadas, não travam a importação", () => {
    const raw = JSON.parse(serializeCampaignArchive(createDemoCampaign()));
    raw.data.campaign.enabledModules = ["npc_brain", "modulo_que_nao_existe_mais"];
    const restored = parseCampaignArchive(JSON.stringify(raw));
    expect(restored.data.campaign.enabledModules).toEqual(["npc_brain"]);
  });

  it("um arquivo salvo antes dos favoritos existirem importa sem nenhum favorito, não trava", () => {
    const raw = JSON.parse(serializeCampaignArchive(createDemoCampaign()));
    delete raw.data.campaign.favoriteEntityIds;
    delete raw.data.campaign.favoriteViewIds;
    const restored = parseCampaignArchive(JSON.stringify(raw));
    expect(restored.data.campaign.favoriteEntityIds).toEqual([]);
    expect(restored.data.campaign.favoriteViewIds).toEqual([]);
  });

  it("favoriteEntityIds malformado (não é array) cai para lista vazia em vez de travar", () => {
    const raw = JSON.parse(serializeCampaignArchive(createDemoCampaign()));
    raw.data.campaign.favoriteEntityIds = "não-é-uma-lista";
    const restored = parseCampaignArchive(JSON.stringify(raw));
    expect(restored.data.campaign.favoriteEntityIds).toEqual([]);
  });
});
