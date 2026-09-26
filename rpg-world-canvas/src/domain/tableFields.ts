// Random Table / Generator Engine data — scoped to kind "table". Pure RNG,
// never AI: the GM defines a weighted list of entries (names, loot,
// rumors, weather, anything) and rolls on it whenever inspiration is
// needed, same "the GM stays in control" discipline as Rules Engine.

import { createId } from "./id";

export interface TableEntry {
  id: string;
  text: string;
  weight: number;
}

export interface TableRollEntry {
  id: string;
  at: number;
  result: string;
}

export interface TableFields {
  entries: TableEntry[];
  history: TableRollEntry[];
}

export function defaultTableFields(): TableFields {
  return { entries: [], history: [] };
}

export function defaultEntry(text: string, weight = 1): TableEntry {
  return { id: createId("tableentry"), text, weight: Math.max(0, weight) };
}

function readEntry(value: unknown): TableEntry | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<TableEntry>;
  if (typeof source.id !== "string" || typeof source.text !== "string") return null;
  const weight = typeof source.weight === "number" && Number.isFinite(source.weight) && source.weight >= 0 ? source.weight : 1;
  return { id: source.id, text: source.text, weight };
}

function readRoll(value: unknown): TableRollEntry | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<TableRollEntry>;
  if (typeof source.id !== "string" || typeof source.result !== "string") return null;
  return { id: source.id, at: typeof source.at === "number" ? source.at : Date.now(), result: source.result };
}

export function readTableFields(fields: Record<string, unknown>): TableFields {
  const defaults = defaultTableFields();
  const source = fields as Partial<TableFields>;
  return {
    entries: Array.isArray(source.entries) ? source.entries.map(readEntry).filter((e): e is TableEntry => e !== null) : defaults.entries,
    history: Array.isArray(source.history) ? source.history.map(readRoll).filter((h): h is TableRollEntry => h !== null) : defaults.history,
  };
}

/** Weighted random pick — entries with weight 0 can never be rolled but stay
 * visible (useful to temporarily "retire" an entry without deleting it).
 * `random` defaults to Math.random and is injectable so this stays a pure,
 * deterministic function under test. Returns null with no rollable entries. */
export function rollTable(entries: TableEntry[], random: () => number = Math.random): TableEntry | null {
  const rollable = entries.filter((entry) => entry.weight > 0);
  const total = rollable.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;
  let target = random() * total;
  for (const entry of rollable) {
    target -= entry.weight;
    if (target < 0) return entry;
  }
  return rollable[rollable.length - 1];
}
