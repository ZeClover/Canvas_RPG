// Combat/Encounter Tracker data — scoped to kind "encounter". System-agnostic
// on purpose (no fixed stat block): initiative, HP and conditions are plain
// numbers/strings the GM types in, same discipline as every other engine in
// this app. A combatant can optionally link to an existing npc/player/
// creature entity (entityId) just for quick navigation — nothing here ever
// reads or writes that entity's own fields, so turning combat tracker off
// never loses or desyncs anything.

import { createId } from "./id";

export interface Combatant {
  id: string;
  entityId: string | null;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  conditions: string[];
  isAlly: boolean;
}

export interface EncounterLogEntry {
  id: string;
  at: number;
  note: string;
}

export interface EncounterFields {
  active: boolean;
  round: number;
  /** Index into the initiative-sorted order (sortByInitiative), not into
   * `combatants` directly — stays valid as long as it's clamped below the
   * combatant count. */
  turnIndex: number;
  combatants: Combatant[];
  log: EncounterLogEntry[];
}

export function defaultEncounterFields(): EncounterFields {
  return { active: true, round: 1, turnIndex: 0, combatants: [], log: [] };
}

export function defaultCombatant(name: string): Combatant {
  return { id: createId("combatant"), entityId: null, name, initiative: 0, hp: 10, maxHp: 10, conditions: [], isAlly: false };
}

function readCombatant(value: unknown): Combatant | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<Combatant>;
  if (typeof source.id !== "string" || typeof source.name !== "string") return null;
  return {
    id: source.id,
    entityId: typeof source.entityId === "string" ? source.entityId : null,
    name: source.name,
    initiative: typeof source.initiative === "number" && Number.isFinite(source.initiative) ? source.initiative : 0,
    hp: typeof source.hp === "number" && Number.isFinite(source.hp) ? source.hp : 0,
    maxHp: typeof source.maxHp === "number" && Number.isFinite(source.maxHp) ? source.maxHp : 0,
    conditions: Array.isArray(source.conditions) ? source.conditions.filter((c): c is string => typeof c === "string") : [],
    isAlly: typeof source.isAlly === "boolean" ? source.isAlly : false,
  };
}

export function readEncounterFields(fields: Record<string, unknown>): EncounterFields {
  const defaults = defaultEncounterFields();
  const source = fields as Partial<EncounterFields>;
  const combatants = Array.isArray(source.combatants)
    ? source.combatants.map(readCombatant).filter((c): c is Combatant => c !== null)
    : defaults.combatants;
  const rawTurnIndex = typeof source.turnIndex === "number" && Number.isFinite(source.turnIndex) ? source.turnIndex : 0;
  const turnIndex = combatants.length ? Math.min(Math.max(0, rawTurnIndex), combatants.length - 1) : 0;
  return {
    active: typeof source.active === "boolean" ? source.active : defaults.active,
    round: typeof source.round === "number" && Number.isFinite(source.round) && source.round >= 1 ? Math.floor(source.round) : defaults.round,
    turnIndex,
    combatants,
    log: Array.isArray(source.log) ? (source.log as EncounterLogEntry[]) : defaults.log,
  };
}

/** Descending by initiative; ties keep insertion order (Array.prototype.sort
 * is stable as of ES2019+). */
export function sortByInitiative(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => b.initiative - a.initiative);
}

/** Whose turn it is right now — null with no combatants. */
export function currentCombatant(fields: EncounterFields): Combatant | null {
  return sortByInitiative(fields.combatants)[fields.turnIndex] ?? null;
}

/** Pure turn advance: moves to the next combatant in initiative order,
 * wrapping into a new round. Never touches HP/conditions — those stay
 * whatever the GM last typed. */
export function advanceTurn(fields: EncounterFields): EncounterFields {
  if (!fields.combatants.length) return fields;
  const nextIndex = fields.turnIndex + 1;
  if (nextIndex >= fields.combatants.length) return { ...fields, turnIndex: 0, round: fields.round + 1 };
  return { ...fields, turnIndex: nextIndex };
}
