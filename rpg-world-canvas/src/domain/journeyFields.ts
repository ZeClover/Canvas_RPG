// Travel & Journey Engine data — scoped to kind "journey". A route is a
// plain list of legs the GM lays out by hand; nothing here rolls dice or
// advances anything automatically — "concluído" is a checkbox the GM
// ticks, same discipline as a Quest Studio objective.

import { createId } from "./id";

export interface JourneyLeg {
  id: string;
  fromEntityId: string | null;
  toEntityId: string | null;
  distanceNote: string;
  days: number;
  done: boolean;
}

export interface JourneyLogEntry {
  id: string;
  at: number;
  note: string;
}

export interface JourneyFields {
  legs: JourneyLeg[];
  supplyNote: string;
  encounterNote: string;
  log: JourneyLogEntry[];
}

export function defaultJourneyFields(): JourneyFields {
  return { legs: [], supplyNote: "", encounterNote: "", log: [] };
}

export function defaultLeg(): JourneyLeg {
  return { id: createId("journeyleg"), fromEntityId: null, toEntityId: null, distanceNote: "", days: 1, done: false };
}

function readLeg(value: unknown): JourneyLeg | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<JourneyLeg>;
  if (typeof source.id !== "string") return null;
  return {
    id: source.id,
    fromEntityId: typeof source.fromEntityId === "string" ? source.fromEntityId : null,
    toEntityId: typeof source.toEntityId === "string" ? source.toEntityId : null,
    distanceNote: typeof source.distanceNote === "string" ? source.distanceNote : "",
    days: typeof source.days === "number" && Number.isFinite(source.days) && source.days >= 0 ? source.days : 1,
    done: typeof source.done === "boolean" ? source.done : false,
  };
}

export function readJourneyFields(fields: Record<string, unknown>): JourneyFields {
  const defaults = defaultJourneyFields();
  const source = fields as Partial<JourneyFields>;
  return {
    legs: Array.isArray(source.legs) ? source.legs.map(readLeg).filter((l): l is JourneyLeg => l !== null) : defaults.legs,
    supplyNote: typeof source.supplyNote === "string" ? source.supplyNote : defaults.supplyNote,
    encounterNote: typeof source.encounterNote === "string" ? source.encounterNote : defaults.encounterNote,
    log: Array.isArray(source.log) ? (source.log as JourneyLogEntry[]) : defaults.log,
  };
}

export function totalDays(legs: JourneyLeg[]): number {
  return legs.reduce((sum, leg) => sum + leg.days, 0);
}

export function daysRemaining(legs: JourneyLeg[]): number {
  return legs.filter((leg) => !leg.done).reduce((sum, leg) => sum + leg.days, 0);
}

export function legsDone(legs: JourneyLeg[]): number {
  return legs.filter((leg) => leg.done).length;
}
