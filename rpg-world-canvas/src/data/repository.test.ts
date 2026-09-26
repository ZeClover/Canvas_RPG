import { beforeEach, describe, expect, it } from "vitest";
import "../test/indexedDbTestEnv";
import { resetIndexedDb } from "../test/indexedDbTestEnv";
import { createDemoCampaign } from "./seed";
import {
  createCampaign,
  createUniverseLink,
  deleteCampaign,
  deleteUniverseLink,
  listBackups,
  listCampaigns,
  listUniverseLinks,
  loadCampaignData,
  restoreBackup,
  saveCampaignDiff,
  saveManualBackup,
  seedCampaign,
} from "./repository";

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

  it("restaurar um backup também remove o que foi criado depois dele (não é só um upsert)", async () => {
    const demo = createDemoCampaign();
    await seedCampaign(demo);
    await saveManualBackup(demo);
    const latest = (await listBackups(demo.campaign.id)).find((backup) => backup.latest)!;

    // Create a new entity and a new relation AFTER the backup was taken.
    // Deliberately never call loadCampaignData() here before restoring —
    // that has the side effect of re-snapshotting "latest" to whatever is
    // currently there, which is a real behavior (see the test above) but
    // not what happens in the app mid-session: the in-memory store stays
    // synced via autosave diffs alone, without ever re-reading through
    // loadCampaignData until the campaign is closed and reopened.
    const newEntity = { ...demo.entities[0], id: "entity_created_after_backup", title: "Criado depois do backup" };
    const newRelation = { ...demo.relations[0], id: "relation_created_after_backup" };
    await saveCampaignDiff({
      campaign: demo.campaign,
      upsertEntities: [newEntity],
      deleteEntityIds: [],
      upsertRelations: [newRelation],
      deleteRelationIds: [],
      upsertViews: [],
      deleteViewIds: [],
    });

    await restoreBackup(latest.id);

    // Reload straight from IndexedDB (not the in-memory return value of
    // restoreBackup) — this is the part that silently kept the extra row.
    const reloaded = await loadCampaignData(demo.campaign.id);
    expect(reloaded.entities.length).toBe(demo.entities.length);
    expect(reloaded.entities.some((entity) => entity.id === newEntity.id)).toBe(false);
    expect(reloaded.relations.some((relation) => relation.id === newRelation.id)).toBe(false);
  });

  it("cria, lista e remove uma ligação do Multiverse Engine entre duas campanhas", async () => {
    const demoA = createDemoCampaign();
    const demoB = createDemoCampaign();
    await Promise.all([createCampaign(demoA.campaign), createCampaign(demoB.campaign)]);

    const link = {
      id: "universelink_test_1",
      fromCampaignId: demoA.campaign.id,
      toCampaignId: demoB.campaign.id,
      description: "Mesma cosmologia, séculos de diferença",
      createdAt: Date.now(),
    };
    await createUniverseLink(link);

    const links = await listUniverseLinks();
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual(link);

    await deleteUniverseLink(link.id);
    expect(await listUniverseLinks()).toHaveLength(0);
  });

  it("apagar uma campanha remove também as ligações do Multiverse Engine que a referenciam", async () => {
    const demoA = createDemoCampaign();
    const demoB = createDemoCampaign();
    await Promise.all([createCampaign(demoA.campaign), createCampaign(demoB.campaign)]);
    await createUniverseLink({
      id: "universelink_test_2",
      fromCampaignId: demoA.campaign.id,
      toCampaignId: demoB.campaign.id,
      description: "",
      createdAt: Date.now(),
    });

    await deleteCampaign(demoA.campaign.id);

    expect(await listUniverseLinks()).toHaveLength(0);
    expect((await listCampaigns()).map((c) => c.id)).not.toContain(demoA.campaign.id);
  });
});
