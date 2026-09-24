import { createId } from "../domain/id";
import { defaultEnabledModules, isModuleKey, type ModuleKey } from "../domain/modules";
import { ENTITY_KINDS } from "../domain/types";
import type {
  Campaign,
  CampaignData,
  Entity,
  EntityKind,
  Relation,
  RelationHistoryEntry,
  RelationType,
  View,
  ViewFilter,
  Visibility,
} from "../domain/types";
import { RELATION_TYPES } from "../domain/types";

export const CAMPAIGN_ARCHIVE_FORMAT = "rpg-world-canvas";
export const CAMPAIGN_ARCHIVE_VERSION = 1;
export const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;

export interface CampaignArchive {
  format: typeof CAMPAIGN_ARCHIVE_FORMAT;
  version: typeof CAMPAIGN_ARCHIVE_VERSION;
  exportedAt: number;
  data: CampaignData;
}

const ENTITY_KIND_SET = new Set<EntityKind>(ENTITY_KINDS);
const RELATION_TYPE_SET = new Set<RelationType>(RELATION_TYPES);
const VISIBILITIES = new Set<Visibility>(["gm_only", "revealed", "partial"]);
const IMPORTANCE = new Set(["low", "medium", "high"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} está inválido.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, maxLength = 20_000): string {
  if (typeof value !== "string" || value.length > maxLength) throw new Error(`${label} está inválido.`);
  return value;
}

function nullableString(value: unknown, label: string, maxLength = 20_000): string | null {
  if (value === undefined || value === null) return null;
  return string(value, label, maxLength);
}

function number(value: unknown, label: string, min = -1_000_000_000, max = 1_000_000_000): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} está inválido.`);
  return value;
}

function boolean(value: unknown, label: string, fallback?: boolean): boolean {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} está inválido.`);
  return value;
}

function array(value: unknown, label: string, maxLength: number): unknown[] {
  if (!Array.isArray(value) || value.length > maxLength) throw new Error(`${label} está inválido ou é grande demais.`);
  return value;
}

function stringArray(value: unknown, label: string, maxItems = 60, maxLength = 80): string[] {
  if (value === undefined) return [];
  return array(value, label, maxItems).map((item) => string(item, `Item de ${label}`, maxLength));
}

function fieldsBag(value: unknown, label: string): Record<string, unknown> {
  if (value === undefined) return {};
  const source = record(value, label);
  if (JSON.stringify(source).length > 2_000_000) throw new Error(`${label} é grande demais.`);
  return source;
}

function parseRelationHistory(value: unknown): RelationHistoryEntry[] {
  if (value === undefined) return [];
  return array(value, "Histórico da relação", 500).map((item) => {
    const source = record(item, "Entrada do histórico");
    return {
      id: string(source.id, "ID do histórico", 200),
      at: number(source.at, "Data do histórico", 0, Number.MAX_SAFE_INTEGER),
      note: string(source.note, "Nota do histórico", 20_000),
      sessionId: nullableString(source.sessionId, "Sessão do histórico", 200),
    };
  });
}

function parseEntity(value: unknown, campaignId: string): Entity {
  const source = record(value, "Elemento");
  const kind = string(source.kind, "Tipo do elemento", 40) as EntityKind;
  if (!ENTITY_KIND_SET.has(kind)) throw new Error(`Tipo de elemento desconhecido: ${kind}.`);
  const visibility = (source.visibility === undefined ? "gm_only" : string(source.visibility, "Visibilidade", 20)) as Visibility;
  if (!VISIBILITIES.has(visibility)) throw new Error(`Visibilidade desconhecida: ${visibility}.`);
  const entityCampaignId = string(source.campaignId, "Campanha do elemento", 200);
  if (entityCampaignId !== campaignId) throw new Error("Um elemento pertence a outra campanha.");
  return {
    id: string(source.id, "ID do elemento", 200),
    campaignId: entityCampaignId,
    kind,
    title: string(source.title, "Título do elemento", 2_000),
    summary: source.summary === undefined ? "" : string(source.summary, "Resumo do elemento", 1_000_000),
    color: nullableString(source.color, "Cor do elemento", 64),
    icon: nullableString(source.icon, "Ícone do elemento", 16),
    imageSrc: nullableString(source.imageSrc, "Imagem do elemento", 25_000_000),
    tags: stringArray(source.tags, "Etiquetas do elemento"),
    status: nullableString(source.status, "Status do elemento", 120),
    fields: fieldsBag(source.fields, "Campos do elemento"),
    x: number(source.x, "Posição X do elemento"),
    y: number(source.y, "Posição Y do elemento"),
    width: number(source.width, "Largura do elemento", 1, 2_000_000),
    height: number(source.height, "Altura do elemento", 1, 2_000_000),
    groupId: nullableString(source.groupId, "Grupo do elemento", 200),
    visibility,
    important: boolean(source.important, "Destaque do elemento", false),
    createdAt: number(source.createdAt, "Criação do elemento", 0, Number.MAX_SAFE_INTEGER),
    updatedAt: number(source.updatedAt, "Atualização do elemento", 0, Number.MAX_SAFE_INTEGER),
  };
}

function parseViewFilter(value: unknown): ViewFilter {
  if (value === undefined) return {};
  const source = record(value, "Filtro da view");
  const filter: ViewFilter = {};
  if (source.kinds !== undefined) {
    filter.kinds = array(source.kinds, "Tipos do filtro", ENTITY_KINDS.length).map((kind) => {
      const parsed = string(kind, "Tipo do filtro", 40) as EntityKind;
      if (!ENTITY_KIND_SET.has(parsed)) throw new Error(`Tipo de filtro desconhecido: ${parsed}.`);
      return parsed;
    });
  }
  if (source.tags !== undefined) filter.tags = stringArray(source.tags, "Etiquetas do filtro");
  if (source.groupIds !== undefined) filter.groupIds = stringArray(source.groupIds, "Grupos do filtro", 200, 200);
  if (source.status !== undefined) filter.status = stringArray(source.status, "Status do filtro", 60, 120);
  if (source.search !== undefined) filter.search = string(source.search, "Busca do filtro", 400);
  return filter;
}

function parseRelation(value: unknown, campaignId: string): Relation {
  const source = record(value, "Relação");
  const type = string(source.type, "Tipo da relação", 40) as RelationType;
  if (!RELATION_TYPE_SET.has(type)) throw new Error(`Tipo de relação desconhecido: ${type}.`);
  const importanceValue = source.importance === undefined || source.importance === null ? null : string(source.importance, "Importância da relação", 20);
  if (importanceValue !== null && !IMPORTANCE.has(importanceValue)) throw new Error(`Importância desconhecida: ${importanceValue}.`);
  const relationCampaignId = string(source.campaignId, "Campanha da relação", 200);
  if (relationCampaignId !== campaignId) throw new Error("Uma relação pertence a outra campanha.");
  return {
    id: string(source.id, "ID da relação", 200),
    campaignId: relationCampaignId,
    fromEntityId: string(source.fromEntityId, "Origem da relação", 200),
    toEntityId: string(source.toEntityId, "Destino da relação", 200),
    type,
    label: source.label === undefined ? "" : string(source.label, "Rótulo da relação", 2_000),
    description: source.description === undefined ? "" : string(source.description, "Descrição da relação", 1_000_000),
    date: nullableString(source.date, "Data da relação", 120),
    sessionId: nullableString(source.sessionId, "Sessão da relação", 200),
    importance: importanceValue as Relation["importance"],
    state: nullableString(source.state, "Estado da relação", 200),
    fields: fieldsBag(source.fields, "Campos da relação"),
    history: parseRelationHistory(source.history),
    createdAt: number(source.createdAt, "Criação da relação", 0, Number.MAX_SAFE_INTEGER),
    updatedAt: number(source.updatedAt, "Atualização da relação", 0, Number.MAX_SAFE_INTEGER),
  };
}

function parseView(value: unknown, campaignId: string): View {
  const source = record(value, "View");
  const viewCampaignId = string(source.campaignId, "Campanha da view", 200);
  if (viewCampaignId !== campaignId) throw new Error("Uma view pertence a outra campanha.");
  return {
    id: string(source.id, "ID da view", 200),
    campaignId: viewCampaignId,
    title: string(source.title, "Título da view", 200),
    icon: nullableString(source.icon, "Ícone da view", 16),
    filter: parseViewFilter(source.filter),
    isDefault: boolean(source.isDefault, "View padrão", false),
    createdAt: number(source.createdAt, "Criação da view", 0, Number.MAX_SAFE_INTEGER),
    updatedAt: number(source.updatedAt, "Atualização da view", 0, Number.MAX_SAFE_INTEGER),
  };
}

function parseEnabledModules(value: unknown): ModuleKey[] {
  // Missing (older export, or a campaign saved before this feature
  // existed) defaults to everything on — nothing changes until the GM
  // deliberately turns a module off. Unknown keys are dropped rather than
  // rejecting the whole import, same defensive spirit as a fields reader.
  if (value === undefined) return defaultEnabledModules();
  if (!Array.isArray(value)) return defaultEnabledModules();
  const known = value.filter((item): item is ModuleKey => typeof item === "string" && isModuleKey(item));
  return known.length ? [...new Set(known)] : [];
}

function parseCampaign(value: unknown): Campaign {
  const source = record(value, "Campanha");
  return {
    id: string(source.id, "ID da campanha", 200),
    title: string(source.title, "Nome da campanha", 500),
    description: source.description === undefined ? "" : string(source.description, "Descrição da campanha", 10_000),
    color: string(source.color, "Cor da campanha", 64),
    icon: nullableString(source.icon, "Ícone da campanha", 16),
    enabledModules: parseEnabledModules(source.enabledModules),
    createdAt: number(source.createdAt, "Criação da campanha", 0, Number.MAX_SAFE_INTEGER),
    updatedAt: number(source.updatedAt, "Atualização da campanha", 0, Number.MAX_SAFE_INTEGER),
  };
}

export function validateCampaignData(value: unknown): CampaignData {
  const source = record(value, "Conteúdo da campanha");
  const campaign = parseCampaign(source.campaign);
  const entities = array(source.entities, "Lista de elementos", 200_000).map((item) => parseEntity(item, campaign.id));
  const relations = array(source.relations, "Lista de relações", 500_000).map((item) => parseRelation(item, campaign.id));
  const views = array(source.views, "Lista de views", 2_000).map((item) => parseView(item, campaign.id));

  const entityIds = new Set<string>();
  for (const entity of entities) {
    if (entityIds.has(entity.id)) throw new Error("Existem elementos com o mesmo ID.");
    entityIds.add(entity.id);
  }
  for (const entity of entities) {
    if (entity.groupId) {
      if (!entityIds.has(entity.groupId)) throw new Error("Um elemento aponta para um grupo inexistente.");
      if (entity.groupId === entity.id) throw new Error("Um elemento não pode estar dentro de si mesmo.");
    }
  }
  const groupParent = new Map(entities.map((entity) => [entity.id, entity.groupId]));
  for (const entity of entities) {
    const visited = new Set([entity.id]);
    let parentId = entity.groupId;
    while (parentId) {
      if (visited.has(parentId)) throw new Error("Existem grupos com hierarquia circular.");
      visited.add(parentId);
      parentId = groupParent.get(parentId) ?? null;
    }
  }

  const relationIds = new Set<string>();
  for (const relation of relations) {
    if (relationIds.has(relation.id)) throw new Error("Existem relações com o mesmo ID.");
    if (!entityIds.has(relation.fromEntityId) || !entityIds.has(relation.toEntityId)) {
      throw new Error("Uma relação aponta para um elemento inexistente.");
    }
    relationIds.add(relation.id);
  }

  const viewIds = new Set<string>();
  for (const view of views) {
    if (viewIds.has(view.id)) throw new Error("Existem views com o mesmo ID.");
    viewIds.add(view.id);
  }

  return { campaign, entities, relations, views };
}

export function parseCampaignArchive(text: string): CampaignArchive {
  if (new Blob([text]).size > MAX_ARCHIVE_BYTES) throw new Error("Este arquivo ultrapassa o limite de tamanho.");
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não contém uma campanha válida.");
  }
  const source = record(decoded, "Arquivo");
  if (source.format !== CAMPAIGN_ARCHIVE_FORMAT) throw new Error("Este arquivo não foi criado pelo RPG World Canvas.");
  if (source.version !== CAMPAIGN_ARCHIVE_VERSION) throw new Error("Esta versão do arquivo ainda não é compatível.");
  return {
    format: CAMPAIGN_ARCHIVE_FORMAT,
    version: CAMPAIGN_ARCHIVE_VERSION,
    exportedAt: number(source.exportedAt, "Data da exportação", 0, Number.MAX_SAFE_INTEGER),
    data: validateCampaignData(source.data),
  };
}

export function serializeCampaignArchive(data: CampaignData): string {
  const clean = validateCampaignData(data);
  const archive: CampaignArchive = {
    format: CAMPAIGN_ARCHIVE_FORMAT,
    version: CAMPAIGN_ARCHIVE_VERSION,
    exportedAt: Date.now(),
    data: clean,
  };
  return JSON.stringify(archive, null, 2);
}

export function prepareImportedCampaign(data: CampaignData, existingCampaignIds: Set<string>): CampaignData {
  if (!existingCampaignIds.has(data.campaign.id)) return structuredClone(data);
  const campaignId = createId("campaign");
  const entityIds = new Map(data.entities.map((entity) => [entity.id, createId("entity")]));
  const now = Date.now();
  return {
    campaign: { ...data.campaign, id: campaignId, title: `${data.campaign.title} (importado)`, updatedAt: now },
    entities: data.entities.map((entity) => ({
      ...entity,
      id: entityIds.get(entity.id)!,
      campaignId,
      groupId: entity.groupId ? entityIds.get(entity.groupId) ?? null : null,
      updatedAt: now,
    })),
    relations: data.relations.map((relation) => ({
      ...relation,
      id: createId("relation"),
      campaignId,
      fromEntityId: entityIds.get(relation.fromEntityId)!,
      toEntityId: entityIds.get(relation.toEntityId)!,
    })),
    views: data.views.map((view) => ({ ...view, id: createId("view"), campaignId })),
  };
}

export function safeCampaignFileName(title: string): string {
  const clean = title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${clean || "campanha"}.rpgworld`;
}
