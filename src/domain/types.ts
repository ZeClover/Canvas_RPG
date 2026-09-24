export type NodeKind =
  | "free"
  | "scene"
  | "speech"
  | "npc"
  | "event"
  | "decision"
  | "condition"
  | "combat"
  | "clue"
  | "improv"
  | "lore"
  | "place"
  | "item"
  | "creature"
  | "faction"
  | "transition";

export type RegionKind = "region" | "session" | "collection";
export type ProgressState = "pending" | "active" | "completed";

export interface Project {
  id: string;
  title: string;
  description: string;
  color: string;
  updatedAt: number;
}

export interface CanvasNode {
  id: string;
  projectId: string;
  regionId: string | null;
  sourceNodeId: string | null;
  title: string;
  body: string;
  instanceNotes: string;
  kind: NodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  imageSrc: string | null;
  tags: string[];
  important: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CanvasRegion {
  id: string;
  projectId: string;
  parentRegionId: string | null;
  title: string;
  kind: RegionKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  minDetailScale: number;
}

export interface CanvasConnection {
  id: string;
  projectId: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
  relation: "flow" | "reference" | "condition";
  color: string;
}

export interface CameraState {
  x: number;
  y: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface MusicTrack {
  id: string;
  title: string;
  path: string;
  url: string;
  category: string;
  duration?: number;
}

export interface WorkspaceData {
  project: Project;
  nodes: CanvasNode[];
  regions: CanvasRegion[];
  connections: CanvasConnection[];
  sessionProgress: Record<string, ProgressState>;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldBounds extends WorldPoint {
  width: number;
  height: number;
}

export const NODE_KIND_LABELS: Record<NodeKind, string> = {
  free: "Livre",
  scene: "Cena",
  speech: "Fala",
  npc: "NPC",
  event: "Evento",
  decision: "Decisão",
  condition: "Condição",
  combat: "Combate",
  clue: "Pista",
  improv: "Improviso",
  lore: "Lore",
  place: "Local",
  item: "Item",
  creature: "Criatura",
  faction: "Facção",
  transition: "Transição",
};
