import type { Campaign, CampaignData, Entity, Relation, UniverseLink, View } from "../domain/types";
import { createId } from "../domain/id";
import {
  MAX_ARCHIVE_BYTES,
  parseCampaignArchive,
  prepareImportedCampaign,
  safeCampaignFileName,
  serializeCampaignArchive,
  validateCampaignData,
} from "./campaignArchive";
import { STORES, dbDelete, dbDeleteMany, dbGet, dbGetAll, dbGetAllByIndex, dbPut, dbPutMany } from "./db";
import { createDefaultViews } from "./seed";

export interface CampaignSaveDiff {
  campaign: Campaign;
  upsertEntities: Entity[];
  deleteEntityIds: string[];
  upsertRelations: Relation[];
  deleteRelationIds: string[];
  upsertViews: View[];
  deleteViewIds: string[];
}

export interface BackupInfo {
  id: string;
  campaignId: string;
  title: string;
  createdAt: number;
  entityCount: number;
  latest: boolean;
}

const SNAPSHOT_INTERVAL = 10 * 60 * 1000;
const MAX_SNAPSHOTS_PER_CAMPAIGN = 10;

export async function listCampaigns(): Promise<Campaign[]> {
  return dbGetAll<Campaign>(STORES.campaigns);
}

export async function createCampaign(campaign: Campaign): Promise<void> {
  await dbPut(STORES.campaigns, campaign);
  await dbPutMany(STORES.views, createDefaultViews(campaign.id));
}

/** Writes a fully-formed CampaignData (campaign + entities + relations +
 * its own views) in one go — used to seed the first-run demo campaign. */
export async function seedCampaign(data: CampaignData): Promise<void> {
  const clean = validateCampaignData(data);
  await dbPut(STORES.campaigns, clean.campaign);
  await Promise.all([
    dbPutMany(STORES.entities, clean.entities),
    dbPutMany(STORES.relations, clean.relations),
    dbPutMany(STORES.views, clean.views),
  ]);
}

export async function loadCampaignData(campaignId: string): Promise<CampaignData> {
  const [campaign, entities, relations, views] = await Promise.all([
    dbGet<Campaign>(STORES.campaigns, campaignId),
    dbGetAllByIndex<Entity>(STORES.entities, "campaignId", campaignId),
    dbGetAllByIndex<Relation>(STORES.relations, "campaignId", campaignId),
    dbGetAllByIndex<View>(STORES.views, "campaignId", campaignId),
  ]);
  if (!campaign) throw new Error("Campanha não encontrada.");
  const data = validateCampaignData({ campaign, entities, relations, views });
  void saveBackupSnapshot(data);
  return data;
}

/** Applies exactly what changed since the last save — the store computes
 * this diff from its own dirty/tombstone tracking, so autosave never has to
 * rewrite an entire campaign's worth of rows for a single moved card.
 *
 * IndexedDB has no foreign keys, so deleting an entity here also deletes
 * every relation still pointing at it (defense in depth: CampaignStore
 * already does this in memory, but the persistence layer must never be
 * able to end up with a dangling relation regardless of caller). */
export async function saveCampaignDiff(diff: CampaignSaveDiff): Promise<void> {
  await dbPut(STORES.campaigns, diff.campaign);
  let deleteRelationIds = diff.deleteRelationIds;
  if (diff.deleteEntityIds.length) {
    const deletedEntityIds = new Set(diff.deleteEntityIds);
    const upsertedRelationIds = new Set(diff.upsertRelations.map((relation) => relation.id));
    const campaignRelations = await dbGetAllByIndex<Relation>(STORES.relations, "campaignId", diff.campaign.id);
    const orphaned = campaignRelations
      .filter((relation) => !upsertedRelationIds.has(relation.id))
      .filter((relation) => deletedEntityIds.has(relation.fromEntityId) || deletedEntityIds.has(relation.toEntityId))
      .map((relation) => relation.id);
    if (orphaned.length) deleteRelationIds = [...new Set([...deleteRelationIds, ...orphaned])];
  }
  await Promise.all([
    dbPutMany(STORES.entities, diff.upsertEntities),
    dbDeleteMany(STORES.entities, diff.deleteEntityIds),
    dbPutMany(STORES.relations, diff.upsertRelations),
    dbDeleteMany(STORES.relations, deleteRelationIds),
    dbPutMany(STORES.views, diff.upsertViews),
    dbDeleteMany(STORES.views, diff.deleteViewIds),
  ]);
}

/** Multiverse Engine (Fase 7): links between campaigns are their own
 * home-level store — never a field on Campaign or an Entity — so linking
 * two universes never touches either campaign's own data or its module
 * toggles. */
export async function listUniverseLinks(): Promise<UniverseLink[]> {
  return dbGetAll<UniverseLink>(STORES.universeLinks);
}

export async function createUniverseLink(link: UniverseLink): Promise<void> {
  await dbPut(STORES.universeLinks, link);
}

export async function deleteUniverseLink(linkId: string): Promise<void> {
  await dbDelete(STORES.universeLinks, linkId);
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  const [entities, relations, views, universeLinks] = await Promise.all([
    dbGetAllByIndex<Entity>(STORES.entities, "campaignId", campaignId),
    dbGetAllByIndex<Relation>(STORES.relations, "campaignId", campaignId),
    dbGetAllByIndex<View>(STORES.views, "campaignId", campaignId),
    dbGetAll<UniverseLink>(STORES.universeLinks),
  ]);
  const orphanedLinkIds = universeLinks
    .filter((link) => link.fromCampaignId === campaignId || link.toCampaignId === campaignId)
    .map((link) => link.id);
  await Promise.all([
    dbDeleteMany(STORES.entities, entities.map((entity) => entity.id)),
    dbDeleteMany(STORES.relations, relations.map((relation) => relation.id)),
    dbDeleteMany(STORES.views, views.map((view) => view.id)),
    dbDeleteMany(STORES.universeLinks, orphanedLinkIds),
    dbDelete(STORES.campaigns, campaignId),
  ]);
}

async function saveBackupSnapshot(data: CampaignData): Promise<void> {
  try {
    const archive = serializeCampaignArchive(data);
    const now = Date.now();
    const latestId = `latest-${data.campaign.id}`;
    await dbPut(STORES.backups, { id: latestId, campaignId: data.campaign.id, title: data.campaign.title, createdAt: now, entityCount: data.entities.length, latest: true, archive });

    const existing = await dbGetAllByIndex<BackupInfo & { archive: string }>(STORES.backups, "campaignId", data.campaign.id);
    const snapshots = existing.filter((backup) => !backup.latest).sort((a, b) => b.createdAt - a.createdAt);
    if (!snapshots.length || now - snapshots[0].createdAt >= SNAPSHOT_INTERVAL) {
      const id = `snapshot-${data.campaign.id}-${now}`;
      await dbPut(STORES.backups, { id, campaignId: data.campaign.id, title: data.campaign.title, createdAt: now, entityCount: data.entities.length, latest: false, archive });
    }

    const refreshed = await dbGetAllByIndex<BackupInfo & { archive: string }>(STORES.backups, "campaignId", data.campaign.id);
    const toRemove = refreshed
      .filter((backup) => !backup.latest)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(MAX_SNAPSHOTS_PER_CAMPAIGN)
      .map((backup) => backup.id);
    await dbDeleteMany(STORES.backups, toRemove);
  } catch (error) {
    console.error("Falha ao criar backup automático", error);
  }
}

export async function saveManualBackup(data: CampaignData): Promise<void> {
  await saveBackupSnapshot(data);
}

export async function listBackups(campaignId?: string): Promise<BackupInfo[]> {
  const all = campaignId
    ? await dbGetAllByIndex<BackupInfo & { archive: string }>(STORES.backups, "campaignId", campaignId)
    : await dbGetAll<BackupInfo & { archive: string }>(STORES.backups);
  return all
    .map(({ archive: _archive, ...info }) => info)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** A real restore, not just an upsert: anything created/changed after the
 * backup was taken (a new entity, a relation, a view) is still sitting in
 * IndexedDB under this campaign's id and must be deleted, or it silently
 * comes back the next time the campaign is opened — the in-memory store
 * built from `data` would look correctly restored for the rest of this
 * session, while the persisted rows underneath it quietly weren't. */
export async function restoreBackup(backupId: string): Promise<CampaignData> {
  const backup = await dbGet<{ archive: string }>(STORES.backups, backupId);
  if (!backup) throw new Error("O backup não está mais disponível.");
  const { data } = parseCampaignArchive(backup.archive);

  const [currentEntities, currentRelations, currentViews] = await Promise.all([
    dbGetAllByIndex<Entity>(STORES.entities, "campaignId", data.campaign.id),
    dbGetAllByIndex<Relation>(STORES.relations, "campaignId", data.campaign.id),
    dbGetAllByIndex<View>(STORES.views, "campaignId", data.campaign.id),
  ]);
  const keepEntityIds = new Set(data.entities.map((entity) => entity.id));
  const keepRelationIds = new Set(data.relations.map((relation) => relation.id));
  const keepViewIds = new Set(data.views.map((view) => view.id));

  await saveCampaignDiff({
    campaign: data.campaign,
    upsertEntities: data.entities,
    deleteEntityIds: currentEntities.filter((entity) => !keepEntityIds.has(entity.id)).map((entity) => entity.id),
    upsertRelations: data.relations,
    deleteRelationIds: currentRelations.filter((relation) => !keepRelationIds.has(relation.id)).map((relation) => relation.id),
    upsertViews: data.views,
    deleteViewIds: currentViews.filter((view) => !keepViewIds.has(view.id)).map((view) => view.id),
  });
  return data;
}

export async function exportCampaignFile(data: CampaignData): Promise<void> {
  const archive = serializeCampaignArchive(data);
  const fileName = safeCampaignFileName(data.campaign.title);
  const url = URL.createObjectURL(new Blob([archive], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readCampaignFile(file: File): Promise<string> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("Este arquivo ultrapassa o limite de tamanho.");
  return file.text();
}

export async function importCampaignFromArchive(text: string): Promise<CampaignData> {
  const archive = parseCampaignArchive(text);
  const existing = await listCampaigns();
  const prepared = prepareImportedCampaign(archive.data, new Set(existing.map((campaign) => campaign.id)));
  await saveCampaignDiff({
    campaign: prepared.campaign,
    upsertEntities: prepared.entities,
    deleteEntityIds: [],
    upsertRelations: prepared.relations,
    deleteRelationIds: [],
    upsertViews: prepared.views,
    deleteViewIds: [],
  });
  return prepared;
}

export { createId };
