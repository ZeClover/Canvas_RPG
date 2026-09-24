import type { CanvasConnection, CanvasNode, CanvasRegion, WorkspaceData } from "../domain/types";

export interface TemplateNode extends Pick<CanvasNode, "title" | "body" | "instanceNotes" | "kind" | "x" | "y" | "width" | "height" | "color" | "imageSrc" | "tags" | "important"> {
  key: string;
  regionKey: string | null;
}

export interface TemplateRegion extends Pick<CanvasRegion, "title" | "kind" | "x" | "y" | "width" | "height" | "color" | "minDetailScale"> {
  key: string;
  parentKey: string | null;
}

export interface TemplateConnection extends Pick<CanvasConnection, "label" | "relation" | "color"> {
  fromKey: string;
  toKey: string;
}

export interface CanvasTemplate {
  id: string;
  name: string;
  type: "node" | "region" | "session";
  builtIn: boolean;
  nodes: TemplateNode[];
  regions: TemplateRegion[];
  connections: TemplateConnection[];
}

const STORAGE_KEY = "rpg-canvas-templates-v1";

const baseNode: Omit<TemplateNode, "key" | "title" | "kind" | "color"> = {
  body: "", instanceNotes: "", x: 0, y: 0, width: 240, height: 126,
  imageSrc: null, tags: [], important: false, regionKey: null,
};

export const BUILT_IN_TEMPLATES: CanvasTemplate[] = [
  {
    id: "builtin-npc", name: "NPC", type: "node", builtIn: true, regions: [], connections: [],
    nodes: [{ ...baseNode, key: "npc", title: "Novo NPC", kind: "npc", color: "#243044", body: "Objetivo:\nPersonalidade:\nSegredo:" }],
  },
  {
    id: "builtin-scene", name: "Cena", type: "node", builtIn: true, regions: [], connections: [],
    nodes: [{ ...baseNode, key: "scene", title: "Nova cena", kind: "scene", color: "#20283a", body: "Abertura:\nDesafio:\nConsequência:" }],
  },
  {
    id: "builtin-session", name: "Sessão básica", type: "session", builtIn: true,
    regions: [{ key: "session", parentKey: null, title: "NOVA SESSÃO", kind: "session", x: 0, y: 0, width: 920, height: 620, color: "#a78bfa", minDetailScale: 0.08 }],
    nodes: [
      { ...baseNode, key: "opening", regionKey: "session", title: "Abertura", kind: "scene", color: "#20283a", x: 80, y: 150 },
      { ...baseNode, key: "conflict", regionKey: "session", title: "Conflito", kind: "combat", color: "#2f2430", x: 340, y: 150 },
      { ...baseNode, key: "ending", regionKey: "session", title: "Desfecho", kind: "decision", color: "#29263b", x: 600, y: 150 },
    ],
    connections: [
      { fromKey: "opening", toKey: "conflict", label: "", relation: "flow", color: "#8290ad" },
      { fromKey: "conflict", toKey: "ending", label: "", relation: "flow", color: "#8290ad" },
    ],
  },
];

export function loadCustomTemplates(): CanvasTemplate[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplates(templates: CanvasTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.filter((template) => !template.builtIn)));
}

export function templateFromSelection(state: WorkspaceData & { selectedNodeIds: string[]; selectedRegionId: string | null }, name: string): CanvasTemplate | null {
  if (state.selectedNodeIds.length === 1) {
    const node = state.nodes.find((candidate) => candidate.id === state.selectedNodeIds[0]);
    if (!node) return null;
    return {
      id: `template-${crypto.randomUUID()}`, name, type: "node", builtIn: false, regions: [], connections: [],
      nodes: [{ key: node.id, regionKey: null, title: node.title, body: node.body, instanceNotes: "", kind: node.kind, x: 0, y: 0, width: node.width, height: node.height, color: node.color, imageSrc: node.imageSrc, tags: node.tags, important: node.important }],
    };
  }
  const root = state.regions.find((region) => region.id === state.selectedRegionId);
  if (!root) return null;
  const regionIds = new Set([root.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const region of state.regions) if (region.parentRegionId && regionIds.has(region.parentRegionId) && !regionIds.has(region.id)) { regionIds.add(region.id); changed = true; }
  }
  const nodes = state.nodes.filter((node) => node.regionId && regionIds.has(node.regionId));
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    id: `template-${crypto.randomUUID()}`, name, type: root.kind === "session" ? "session" : "region", builtIn: false,
    regions: state.regions.filter((region) => regionIds.has(region.id)).map((region) => ({ key: region.id, parentKey: region.id === root.id ? null : region.parentRegionId, title: region.title, kind: region.kind, x: region.x - root.x, y: region.y - root.y, width: region.width, height: region.height, color: region.color, minDetailScale: region.minDetailScale })),
    nodes: nodes.map((node) => ({ key: node.id, regionKey: node.regionId, title: node.title, body: node.body, instanceNotes: node.instanceNotes, kind: node.kind, x: node.x - root.x, y: node.y - root.y, width: node.width, height: node.height, color: node.color, imageSrc: node.imageSrc, tags: node.tags, important: node.important })),
    connections: state.connections.filter((edge) => nodeIds.has(edge.fromNodeId) && nodeIds.has(edge.toNodeId)).map((edge) => ({ fromKey: edge.fromNodeId, toKey: edge.toNodeId, label: edge.label, relation: edge.relation, color: edge.color })),
  };
}
