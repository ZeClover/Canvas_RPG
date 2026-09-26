// Character Sheet Engine data — scoped to kind "player". Deliberately
// system-agnostic: attributes are free label/value pairs (works for
// "Força: 16", "Vigor: d8", "Foco: ●●○" or anything else a system uses)
// instead of a fixed stat block, matching the "geral para todas as
// campanhas" requirement. Inventory is NOT duplicated here — it's the
// existing relation graph (RelationType "carries" → an "item" entity), same
// "um dado, várias lentes" discipline as everything else.

import { createId } from "./id";

export interface AttributeEntry {
  id: string;
  label: string;
  value: string;
}

export interface CharacterFields {
  hp: number;
  maxHp: number;
  level: string;
  attributes: AttributeEntry[];
  conditions: string[];
  notes: string;
}

export function defaultCharacterFields(): CharacterFields {
  return { hp: 10, maxHp: 10, level: "", attributes: [], conditions: [], notes: "" };
}

export function defaultAttribute(label: string, value: string): AttributeEntry {
  return { id: createId("attribute"), label, value };
}

function readAttribute(value: unknown): AttributeEntry | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<AttributeEntry>;
  if (typeof source.id !== "string" || typeof source.label !== "string") return null;
  return { id: source.id, label: source.label, value: typeof source.value === "string" ? source.value : "" };
}

export function readCharacterFields(fields: Record<string, unknown>): CharacterFields {
  const defaults = defaultCharacterFields();
  const source = fields as Partial<CharacterFields>;
  return {
    hp: typeof source.hp === "number" && Number.isFinite(source.hp) ? source.hp : defaults.hp,
    maxHp: typeof source.maxHp === "number" && Number.isFinite(source.maxHp) ? source.maxHp : defaults.maxHp,
    level: typeof source.level === "string" ? source.level : defaults.level,
    attributes: Array.isArray(source.attributes)
      ? source.attributes.map(readAttribute).filter((a): a is AttributeEntry => a !== null)
      : defaults.attributes,
    conditions: Array.isArray(source.conditions) ? source.conditions.filter((c): c is string => typeof c === "string") : defaults.conditions,
    notes: typeof source.notes === "string" ? source.notes : defaults.notes,
  };
}
