// Agenda / "Onde estão agora" — generic, not owned by one EntityKind (see
// modules.ts: no MODULE_FOR_KIND entry). Works on any non-group entity's
// fields bag alongside whatever kind-specific section is already there
// (the "schedule" key never collides with npc_brain's/faction_engine's own
// keys). Each entry is a free-text period ("Manhãs", "Durante o cerco")
// pointing at wherever that entity is during it — never simulated, never
// auto-advanced by the Calendar.

import { createId } from "./id";

export interface ScheduleEntry {
  id: string;
  label: string;
  locationEntityId: string | null;
  note: string;
}

export interface ScheduleFields {
  entries: ScheduleEntry[];
}

export function defaultScheduleFields(): ScheduleFields {
  return { entries: [] };
}

export function defaultScheduleEntry(label: string, locationEntityId: string | null): ScheduleEntry {
  return { id: createId("scheduleentry"), label, locationEntityId, note: "" };
}

function readEntry(value: unknown): ScheduleEntry | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<ScheduleEntry>;
  if (typeof source.id !== "string" || typeof source.label !== "string") return null;
  return {
    id: source.id,
    label: source.label,
    locationEntityId: typeof source.locationEntityId === "string" ? source.locationEntityId : null,
    note: typeof source.note === "string" ? source.note : "",
  };
}

export function readScheduleFields(fields: Record<string, unknown>): ScheduleFields {
  const source = fields as { schedule?: unknown };
  const entries = Array.isArray(source.schedule) ? source.schedule.map(readEntry).filter((e): e is ScheduleEntry => e !== null) : [];
  return { entries };
}
