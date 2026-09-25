// Core data model for RPG World Canvas.
//
// Everything the user sees — cards, groups, connections — is one of two
// database rows: an Entity or a Relation. Every tool (NPC Brain, Quest
// Studio, Mystery Board, Timeline, Views...) is a different way to read and
// write these same two tables, never a separate store. That is the whole
// point of the "não quero informação duplicada" requirement.

import type { ModuleKey } from "./modules";

export type EntityKind =
  | "npc"
  | "player"
  | "quest"
  | "side_quest"
  | "event"
  | "session"
  | "location"
  | "city"
  | "region"
  | "faction"
  | "creature"
  | "item"
  | "secret"
  | "knowledge"
  | "clue"
  | "rumor"
  | "decision"
  | "possibility"
  | "scene"
  | "project"
  | "resource"
  | "theme"
  | "foreshadowing"
  | "transcript"
  | "universe"
  // Deterministic automation (Rules Engine): "quando X vira Y, então Z" —
  // evaluated by CampaignStore itself, never by an AI. Stored as a normal
  // entity (fields hold the trigger/action) so it's searchable, sits on
  // the canvas and follows the same undo/redo path as everything else.
  | "rule"
  // World Communication System (Fase 7): a letter/messenger/spell that
  // travels between two existing entities — who sent it and who it's
  // addressed to are the same relation graph as everything else
  // (originated_from/addressed_to), never a parallel sender/recipient
  // field.
  | "message"
  // Structural kind: a resizable/draggable area on the canvas that other
  // entities can belong to (via their groupId). Rendered as a bounded
  // region, not a card — everything else about it (tags, search, views,
  // relations) works exactly like any other entity.
  | "group";

export const ENTITY_KINDS: EntityKind[] = [
  "npc", "player", "quest", "side_quest", "event", "session",
  "location", "city", "region", "faction", "creature", "item",
  "secret", "knowledge", "clue", "rumor", "decision", "possibility",
  "scene", "project", "resource", "theme", "foreshadowing",
  "transcript", "universe", "rule", "message", "group",
];

export type Visibility = "gm_only" | "revealed" | "partial";

export type RelationType =
  | "knows" | "hates" | "loves" | "trusts" | "fears" | "works_for"
  | "member_of" | "offers" | "involves" | "happens_at" | "reveals"
  | "caused" | "points_to" | "knows_about" | "originated_from"
  | "improves" | "belongs_to" | "leads_to" | "blocks" | "requires"
  | "unlocks_on_success" | "unlocks_on_fail" | "preys_on" | "addressed_to"
  | "custom";

export const RELATION_TYPES: RelationType[] = [
  "knows", "hates", "loves", "trusts", "fears", "works_for", "member_of",
  "offers", "involves", "happens_at", "reveals", "caused", "points_to",
  "knows_about", "originated_from", "improves", "belongs_to", "leads_to",
  "blocks", "requires", "unlocks_on_success", "unlocks_on_fail", "preys_on", "addressed_to", "custom",
];

export interface Entity {
  id: string;
  campaignId: string;
  kind: EntityKind;
  title: string;
  summary: string;
  color: string | null;
  icon: string | null;
  imageSrc: string | null;
  tags: string[];
  status: string | null;
  /** Kind-specific structured data (e.g. a quest's objectives, an NPC's
   * fears/desires). Free-form on purpose: each phase adds richer editors
   * over this same bag of fields instead of migrating the schema. */
  fields: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
  groupId: string | null;
  visibility: Visibility;
  important: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RelationHistoryEntry {
  id: string;
  at: number;
  note: string;
  sessionId: string | null;
}

export interface Relation {
  id: string;
  campaignId: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationType;
  label: string;
  description: string;
  date: string | null;
  sessionId: string | null;
  importance: "low" | "medium" | "high" | null;
  state: string | null;
  /** Optional numeric stats (trust/respect/fear/debt/conflict...) mostly
   * meaningful for NPC↔NPC relations. Never required — most relations
   * (e.g. "quest happens_at location") never touch this. */
  fields: Record<string, unknown>;
  history: RelationHistoryEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface ViewFilter {
  kinds?: EntityKind[];
  tags?: string[];
  groupIds?: string[];
  status?: string[];
  search?: string;
}

export interface View {
  id: string;
  campaignId: string;
  title: string;
  icon: string | null;
  filter: ViewFilter;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  color: string;
  icon: string | null;
  /** Which specialized tools (Fase 2+) are active in this campaign — see
   * domain/modules.ts. A module being off never deletes data, it just
   * hides that kind's editor section and its Ferramentas entry. */
  enabledModules: ModuleKey[];
  createdAt: number;
  updatedAt: number;
}

/** A link between two campaigns/universes — the seed of the Multiverse
 * Engine (full graph UI is a later phase; the data shape exists from the
 * start so nothing has to migrate). */
export interface UniverseLink {
  id: string;
  fromCampaignId: string;
  toCampaignId: string;
  description: string;
  createdAt: number;
}

export interface CampaignData {
  campaign: Campaign;
  entities: Entity[];
  relations: Relation[];
  views: View[];
}

export interface WorldPoint {
  x: number;
  y: number;
}

export interface WorldBounds extends WorldPoint {
  width: number;
  height: number;
}

export interface CameraState {
  x: number;
  y: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
}
