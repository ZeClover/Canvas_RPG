import type { RelationType } from "./types";

export interface RelationTypeConfig {
  label: string;
  color: string;
  /** Visual language for the arrow, independent of color — mirrors the
   * lesson from RPG Canvas Studio that connection *type* should be
   * readable at a glance, not just by color. */
  style: "solid" | "dashed" | "dotted";
  arrow: "triangle" | "diamond" | "circle" | "none";
}

export const RELATION_TYPE_CONFIG: Record<RelationType, RelationTypeConfig> = {
  knows: { label: "conhece", color: "#8290ad", style: "solid", arrow: "triangle" },
  hates: { label: "odeia", color: "#f43f5e", style: "solid", arrow: "triangle" },
  loves: { label: "ama", color: "#fb7185", style: "solid", arrow: "triangle" },
  trusts: { label: "confia em", color: "#34d399", style: "solid", arrow: "triangle" },
  fears: { label: "teme", color: "#a78bfa", style: "dashed", arrow: "triangle" },
  works_for: { label: "trabalha para", color: "#60a5fa", style: "solid", arrow: "triangle" },
  member_of: { label: "membro de", color: "#60a5fa", style: "solid", arrow: "diamond" },
  offers: { label: "oferece", color: "#fbbf24", style: "solid", arrow: "triangle" },
  involves: { label: "envolve", color: "#c084fc", style: "solid", arrow: "triangle" },
  happens_at: { label: "acontece em", color: "#2dd4bf", style: "solid", arrow: "triangle" },
  reveals: { label: "revela", color: "#f43f5e", style: "dashed", arrow: "diamond" },
  caused: { label: "causou", color: "#fb7185", style: "solid", arrow: "triangle" },
  points_to: { label: "aponta para", color: "#22d3ee", style: "dotted", arrow: "circle" },
  knows_about: { label: "sabe sobre", color: "#818cf8", style: "dotted", arrow: "circle" },
  originated_from: { label: "surgiu de", color: "#f0abfc", style: "dotted", arrow: "circle" },
  improves: { label: "melhora", color: "#34d399", style: "solid", arrow: "triangle" },
  belongs_to: { label: "pertence a", color: "#94a3b8", style: "solid", arrow: "diamond" },
  leads_to: { label: "leva a", color: "#fb923c", style: "solid", arrow: "triangle" },
  blocks: { label: "bloqueia", color: "#ef4444", style: "dashed", arrow: "diamond" },
  requires: { label: "requer", color: "#eab308", style: "dashed", arrow: "diamond" },
  unlocks_on_success: { label: "desbloqueia se concluir", color: "#34d399", style: "solid", arrow: "diamond" },
  unlocks_on_fail: { label: "desbloqueia se falhar", color: "#ef4444", style: "dashed", arrow: "diamond" },
  preys_on: { label: "caça", color: "#f87171", style: "solid", arrow: "triangle" },
  addressed_to: { label: "endereçada a", color: "#38bdf8", style: "dotted", arrow: "triangle" },
  custom: { label: "personalizada", color: "#8290ad", style: "solid", arrow: "triangle" },
};

export function relationConfig(type: RelationType): RelationTypeConfig {
  return RELATION_TYPE_CONFIG[type];
}
