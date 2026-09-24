import { createId } from "../domain/id";
import type {
  CanvasConnection,
  CanvasNode,
  CanvasRegion,
  NodeKind,
  ProgressState,
  Project,
  RegionKind,
  WorkspaceData,
} from "../domain/types";

export const PROJECT_ARCHIVE_FORMAT = "rpg-canvas-studio";
export const PROJECT_ARCHIVE_VERSION = 1;
export const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;

export interface ProjectArchive {
  format: typeof PROJECT_ARCHIVE_FORMAT;
  version: typeof PROJECT_ARCHIVE_VERSION;
  exportedAt: number;
  workspace: WorkspaceData;
}

const NODE_KINDS = new Set<NodeKind>([
  "free", "scene", "speech", "npc", "event", "decision", "condition", "combat",
  "clue", "improv", "lore", "place", "item", "creature", "faction", "transition",
]);
const REGION_KINDS = new Set<RegionKind>(["region", "session", "collection"]);
const RELATIONS = new Set<CanvasConnection["relation"]>(["flow", "reference", "condition"]);
const PROGRESS_STATES = new Set<ProgressState>(["pending", "active", "completed"]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} está inválido.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, maxLength = 20_000): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`${label} está inválido.`);
  }
  return value;
}

function nullableString(value: unknown, label: string, maxLength = 20_000): string | null {
  return value === null ? null : string(value, label, maxLength);
}

function number(value: unknown, label: string, min = -1_000_000_000, max = 1_000_000_000): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} está inválido.`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} está inválido.`);
  return value;
}

function array(value: unknown, label: string, maxLength: number): unknown[] {
  if (!Array.isArray(value) || value.length > maxLength) throw new Error(`${label} está inválido ou é grande demais.`);
  return value;
}

function tags(value: unknown): string[] {
  if (value === undefined) return [];
  return array(value, "Etiquetas da caixa", 50).map((item) => string(item, "Etiqueta", 60));
}

function parseProject(value: unknown): Project {
  const source = record(value, "Projeto");
  return {
    id: string(source.id, "ID do projeto", 200),
    title: string(source.title, "Nome do projeto", 500),
    description: string(source.description, "Descrição do projeto", 10_000),
    color: string(source.color, "Cor do projeto", 64),
    updatedAt: number(source.updatedAt, "Data do projeto", 0, Number.MAX_SAFE_INTEGER),
  };
}

function parseRegion(value: unknown): CanvasRegion {
  const source = record(value, "Região");
  const kind = string(source.kind, "Tipo da região", 40) as RegionKind;
  if (!REGION_KINDS.has(kind)) throw new Error(`Tipo de região desconhecido: ${kind}.`);
  return {
    id: string(source.id, "ID da região", 200),
    projectId: string(source.projectId, "Projeto da região", 200),
    parentRegionId: nullableString(source.parentRegionId, "Região superior", 200),
    title: string(source.title, "Nome da região", 1_000),
    kind,
    x: number(source.x, "Posição X da região"),
    y: number(source.y, "Posição Y da região"),
    width: number(source.width, "Largura da região", 1, 1_000_000),
    height: number(source.height, "Altura da região", 1, 1_000_000),
    color: string(source.color, "Cor da região", 64),
    minDetailScale: number(source.minDetailScale, "Escala da região", 0, 100),
  };
}

function parseNode(value: unknown): CanvasNode {
  const source = record(value, "Caixa");
  const kind = string(source.kind, "Tipo da caixa", 40) as NodeKind;
  if (!NODE_KINDS.has(kind)) throw new Error(`Tipo de caixa desconhecido: ${kind}.`);
  return {
    id: string(source.id, "ID da caixa", 200),
    projectId: string(source.projectId, "Projeto da caixa", 200),
    regionId: nullableString(source.regionId, "Região da caixa", 200),
    sourceNodeId: nullableString(source.sourceNodeId, "Referência da caixa", 200),
    // Absent in files saved before v1.2.0 (groups didn't exist yet) —
    // treat a missing field the same as no group, unlike a field that is
    // present but malformed.
    groupId: source.groupId === undefined ? null : nullableString(source.groupId, "Grupo da caixa", 200),
    title: string(source.title, "Título da caixa", 2_000),
    body: string(source.body, "Conteúdo da caixa", 1_000_000),
    instanceNotes: string(source.instanceNotes, "Notas da caixa", 1_000_000),
    kind,
    x: number(source.x, "Posição X da caixa"),
    y: number(source.y, "Posição Y da caixa"),
    width: number(source.width, "Largura da caixa", 1, 1_000_000),
    height: number(source.height, "Altura da caixa", 1, 1_000_000),
    color: string(source.color, "Cor da caixa", 64),
    imageSrc: nullableString(source.imageSrc, "Imagem da caixa", 25_000_000),
    tags: tags(source.tags),
    important: boolean(source.important, "Destaque da caixa"),
    createdAt: number(source.createdAt, "Criação da caixa", 0, Number.MAX_SAFE_INTEGER),
    updatedAt: number(source.updatedAt, "Atualização da caixa", 0, Number.MAX_SAFE_INTEGER),
  };
}

function parseConnection(value: unknown): CanvasConnection {
  const source = record(value, "Conexão");
  const relation = string(source.relation, "Tipo da conexão", 40) as CanvasConnection["relation"];
  if (!RELATIONS.has(relation)) throw new Error(`Tipo de conexão desconhecido: ${relation}.`);
  return {
    id: string(source.id, "ID da conexão", 200),
    projectId: string(source.projectId, "Projeto da conexão", 200),
    fromNodeId: string(source.fromNodeId, "Origem da conexão", 200),
    toNodeId: string(source.toNodeId, "Destino da conexão", 200),
    label: string(source.label, "Texto da conexão", 2_000),
    relation,
    color: string(source.color, "Cor da conexão", 64),
  };
}

export function validateWorkspaceData(value: unknown): WorkspaceData {
  const source = record(value, "Conteúdo do projeto");
  const project = parseProject(source.project);
  const regions = array(source.regions, "Lista de regiões", 25_000).map(parseRegion);
  const nodes = array(source.nodes, "Lista de caixas", 100_000).map(parseNode);
  const connections = array(source.connections, "Lista de conexões", 250_000).map(parseConnection);
  const rawProgress = record(source.sessionProgress, "Progresso da sessão");
  const sessionProgress: Record<string, ProgressState> = {};

  const regionIds = new Set<string>();
  for (const region of regions) {
    if (region.projectId !== project.id) throw new Error("Uma região pertence a outro projeto.");
    if (regionIds.has(region.id)) throw new Error("Existem regiões com o mesmo ID.");
    regionIds.add(region.id);
  }
  for (const region of regions) {
    if (region.parentRegionId && !regionIds.has(region.parentRegionId)) throw new Error("Uma região superior não existe.");
    if (region.parentRegionId === region.id) throw new Error("Uma região não pode conter a si mesma.");
  }
  const parentByRegion = new Map(regions.map((region) => [region.id, region.parentRegionId]));
  for (const region of regions) {
    const visited = new Set([region.id]);
    let parentId = region.parentRegionId;
    while (parentId) {
      if (visited.has(parentId)) throw new Error("Existem regiões com hierarquia circular.");
      visited.add(parentId);
      parentId = parentByRegion.get(parentId) ?? null;
    }
  }

  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (node.projectId !== project.id) throw new Error("Uma caixa pertence a outro projeto.");
    if (nodeIds.has(node.id)) throw new Error("Existem caixas com o mesmo ID.");
    if (node.regionId && !regionIds.has(node.regionId)) throw new Error("Uma caixa aponta para uma região inexistente.");
    nodeIds.add(node.id);
  }
  for (const node of nodes) {
    if (node.sourceNodeId && !nodeIds.has(node.sourceNodeId)) throw new Error("Uma referência aponta para uma caixa inexistente.");
    if (node.sourceNodeId === node.id) throw new Error("Uma caixa não pode referenciar a si mesma.");
  }

  const connectionIds = new Set<string>();
  for (const connection of connections) {
    if (connection.projectId !== project.id) throw new Error("Uma conexão pertence a outro projeto.");
    if (connectionIds.has(connection.id)) throw new Error("Existem conexões com o mesmo ID.");
    if (!nodeIds.has(connection.fromNodeId) || !nodeIds.has(connection.toNodeId)) {
      throw new Error("Uma conexão aponta para uma caixa inexistente.");
    }
    connectionIds.add(connection.id);
  }

  for (const [nodeId, state] of Object.entries(rawProgress)) {
    if (!nodeIds.has(nodeId) || typeof state !== "string" || !PROGRESS_STATES.has(state as ProgressState)) {
      throw new Error("O progresso da sessão está inválido.");
    }
    sessionProgress[nodeId] = state as ProgressState;
  }
  return { project, nodes, regions, connections, sessionProgress };
}

export function parseProjectArchive(text: string): ProjectArchive {
  if (new Blob([text]).size > MAX_ARCHIVE_BYTES) throw new Error("Este arquivo ultrapassa o limite de 100 MB.");
  let decoded: unknown;
  try {
    decoded = JSON.parse(text);
  } catch {
    throw new Error("O arquivo não contém um projeto válido.");
  }
  const source = record(decoded, "Arquivo");
  if (source.format !== PROJECT_ARCHIVE_FORMAT) throw new Error("Este arquivo não foi criado pelo RPG Canvas Studio.");
  if (source.version !== PROJECT_ARCHIVE_VERSION) throw new Error("Esta versão do arquivo ainda não é compatível.");
  return {
    format: PROJECT_ARCHIVE_FORMAT,
    version: PROJECT_ARCHIVE_VERSION,
    exportedAt: number(source.exportedAt, "Data da exportação", 0, Number.MAX_SAFE_INTEGER),
    workspace: validateWorkspaceData(source.workspace),
  };
}

export function serializeProjectArchive(workspace: WorkspaceData): string {
  const cleanWorkspace = validateWorkspaceData(workspace);
  const archive: ProjectArchive = {
    format: PROJECT_ARCHIVE_FORMAT,
    version: PROJECT_ARCHIVE_VERSION,
    exportedAt: Date.now(),
    workspace: cleanWorkspace,
  };
  return JSON.stringify(archive, null, 2);
}

export function prepareImportedWorkspace(workspace: WorkspaceData, existingProjectIds: Set<string>): WorkspaceData {
  if (!existingProjectIds.has(workspace.project.id)) return structuredClone(workspace);

  const projectId = createId("project");
  const regionIds = new Map(workspace.regions.map((region) => [region.id, createId("region")]));
  const nodeIds = new Map(workspace.nodes.map((node) => [node.id, createId("node")]));
  const now = Date.now();
  return {
    project: {
      ...workspace.project,
      id: projectId,
      title: `${workspace.project.title} (importado)`,
      updatedAt: now,
    },
    regions: workspace.regions.map((region) => ({
      ...region,
      id: regionIds.get(region.id)!,
      projectId,
      parentRegionId: region.parentRegionId ? regionIds.get(region.parentRegionId) ?? null : null,
    })),
    nodes: workspace.nodes.map((node) => ({
      ...node,
      id: nodeIds.get(node.id)!,
      projectId,
      regionId: node.regionId ? regionIds.get(node.regionId) ?? null : null,
      sourceNodeId: node.sourceNodeId ? nodeIds.get(node.sourceNodeId) ?? null : null,
      updatedAt: now,
    })),
    connections: workspace.connections.map((connection) => ({
      ...connection,
      id: createId("edge"),
      projectId,
      fromNodeId: nodeIds.get(connection.fromNodeId)!,
      toNodeId: nodeIds.get(connection.toNodeId)!,
    })),
    sessionProgress: Object.fromEntries(
      Object.entries(workspace.sessionProgress).map(([nodeId, state]) => [nodeIds.get(nodeId)!, state]),
    ),
  };
}

export function safeProjectFileName(title: string): string {
  const clean = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${clean || "projeto-rpg"}.rpgcanvas`;
}
