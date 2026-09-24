import type { EntityKind } from "./types";

export interface EntityKindConfig {
  label: string;
  icon: string;
  color: string;
  /** Default box size on the canvas, in world units. */
  width: number;
  height: number;
}

export const ENTITY_KIND_CONFIG: Record<EntityKind, EntityKindConfig> = {
  npc: { label: "NPC", icon: "🧑", color: "#38bdf8", width: 240, height: 126 },
  player: { label: "Personagem", icon: "🎮", color: "#22d3ee", width: 240, height: 126 },
  quest: { label: "Quest", icon: "⭐", color: "#fb7185", width: 260, height: 140 },
  side_quest: { label: "Side Quest", icon: "🔸", color: "#f97316", width: 240, height: 126 },
  event: { label: "Evento", icon: "⚡", color: "#c084fc", width: 240, height: 126 },
  session: { label: "Sessão", icon: "📅", color: "#a78bfa", width: 240, height: 126 },
  location: { label: "Local", icon: "📍", color: "#2dd4bf", width: 240, height: 126 },
  city: { label: "Cidade", icon: "🏙️", color: "#34d399", width: 260, height: 140 },
  region: { label: "Região", icon: "🗺️", color: "#4ade80", width: 260, height: 140 },
  faction: { label: "Facção", icon: "🚩", color: "#60a5fa", width: 240, height: 126 },
  creature: { label: "Criatura", icon: "🐾", color: "#ef4444", width: 240, height: 126 },
  item: { label: "Item", icon: "🎒", color: "#facc15", width: 220, height: 116 },
  secret: { label: "Segredo", icon: "🔒", color: "#f43f5e", width: 240, height: 126 },
  knowledge: { label: "Conhecimento", icon: "📖", color: "#818cf8", width: 240, height: 126 },
  clue: { label: "Pista", icon: "🔍", color: "#22d3ee", width: 220, height: 116 },
  rumor: { label: "Rumor", icon: "💬", color: "#f0abfc", width: 240, height: 126 },
  decision: { label: "Decisão", icon: "🔀", color: "#fbbf24", width: 240, height: 126 },
  possibility: { label: "Possibilidade", icon: "🌱", color: "#94a3b8", width: 240, height: 126 },
  scene: { label: "Cena", icon: "🎬", color: "#a78bfa", width: 240, height: 126 },
  project: { label: "Projeto", icon: "🛠️", color: "#fb923c", width: 240, height: 126 },
  resource: { label: "Recurso", icon: "📦", color: "#eab308", width: 220, height: 116 },
  theme: { label: "Tema", icon: "🎭", color: "#c084fc", width: 220, height: 116 },
  foreshadowing: { label: "Foreshadowing", icon: "🔮", color: "#818cf8", width: 240, height: 126 },
  transcript: { label: "Transcrição", icon: "📝", color: "#8290ad", width: 260, height: 140 },
  universe: { label: "Universo", icon: "🌌", color: "#7c3aed", width: 260, height: 140 },
  group: { label: "Grupo", icon: "🗂️", color: "#7767e9", width: 920, height: 620 },
};

export const CARD_KINDS: EntityKind[] = Object.keys(ENTITY_KIND_CONFIG).filter((kind) => kind !== "group") as EntityKind[];

export function kindConfig(kind: EntityKind): EntityKindConfig {
  return ENTITY_KIND_CONFIG[kind];
}
