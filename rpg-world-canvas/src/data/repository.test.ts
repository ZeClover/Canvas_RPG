import { beforeEach, describe, expect, it } from "vitest";
import "../test/indexedDbTestEnv";
import { resetIndexedDb } from "../test/indexedDbTestEnv";
import { createDemoCampaign } from "./seed";
import { createCampaign, listBackups, listCampaigns, loadCampaignData, restoreBackup, saveCampaignDiff, saveManualBackup, seedCampaign } from "./repository";

describe("repository (IndexedDB real)", () => {
  beforeEach(() => {
    resetIndexedDb();
  });

  it("cria uma campanha vazia com as views padrão", async () => {
    const demo = createDemoCampaign();
    await createCampaign(demo.campaign);
    const campaigns = await listCampaigns();
    expect(campaigns.map((c) => c.id)).toContain(demo.campaign.id);
    const loaded = await loadCampaignData(demo.campaign.id);
    expect(loaded.views.some((view) => view.isDefault)).toBe(true);
    expect(loaded.entities).toHaveLength(0);
  });

  it("semeia e recarrega uma campanha completa", async () => {
    const demo = createDemoCampaign();
    await seedCampaign(demo);
    const loaded = await loadCampaignData(demo.campaign.id);
    expect(loaded.entities).toHaveLength(demo.entities.length);
    expect(loaded.relations).toHaveLength(demo.relations.length);
  });

  it("aplica um diff granular: cria, atualiza e apaga sem reescrever tudo", async () => {
    const demo = createDemoCampaign();
    await seedCampaign(demo);
    const [entity] = demo.entities;
    const toDelete = demo.entities[demo.entities.length - 1];

    await saveCampaignDiff({
      campaign: demo.campaign,
      upsertEntities: [{ ...entity, title: "Renomeado" }],
      deleteEntityIds: [toDelete.id],
      upsertRelations: [],
      deleteRelationIds: [],
      upsertViews: [],
      deleteViewIds: [],
    });

    const loaded = await loadCampaignData(demo.campaign.id);
    expect(loaded.entities.find((e) => e.id === entity.id)?.title).toBe("Renomeado");
    expect(loaded.entities.some((e) => e.id === toDelete.id)).toBe(false);
    expect(loaded.entities).toHaveLength(demo.entities.length - 1);
  });

  it("cria um backup automático e permite restaurar após uma perda de dados", async () => {
    const demo = createDemoCampaign();
    await seedCampaign(demo);
    await saveManualBackup(demo);

    const backups = await listBackups(demo.campaign.id);
    expect(backups.length).toBeGreaterThan(0);
    const latest = backups.find((backup) => backup.latest)!;

    // Simulate losing the main data (e.g. corruption) without touching the
    // backup store — restoreBackup must not depend on reading through
    // loadCampaignData first, since that itself re-snapshots "latest" to
    // whatever is currently there (correct: backups track current state).
    await saveCampaignDiff({
      campaign: demo.campaign,
      upsertEntities: [],
      deleteEntityIds: demo.entities.map((e) => e.id),
      upsertRelations: [],
      deleteRelationIds: [],
      upsertViews: [],
      deleteViewIds: [],
    });

    const restored = await restoreBackup(latest.id);
    expect(restored.entities.length).toBe(demo.entities.length);
    expect((await loadCampaignData(demo.campaign.id)).entities.length).toBe(demo.entities.length);
  });
});
