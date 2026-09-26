// Faction Engine data — scoped to kind "faction". Clocks follow the
// Blades-in-the-Dark convention (a segmented ring that fills toward
// something happening) but are pure GM bookkeeping: nothing here ever
// auto-fills or auto-resolves a clock, same discipline as Settlement's
// prosperity/stability or Resource's stock.

import { createId } from "./id";

export const CLOCK_SEGMENT_OPTIONS = [4, 6, 8, 10, 12] as const;

export interface FactionClock {
  id: string;
  label: string;
  segments: number;
  filled: number;
}

export interface FactionLogEntry {
  id: string;
  at: number;
  note: string;
}

export interface FactionFields {
  goal: string;
  resources: string;
  standing: number;
  clocks: FactionClock[];
  log: FactionLogEntry[];
}

export function defaultFactionFields(): FactionFields {
  return { goal: "", resources: "", standing: 0, clocks: [], log: [] };
}

export function defaultClock(label: string, segments: number): FactionClock {
  const safeSegments = (CLOCK_SEGMENT_OPTIONS as readonly number[]).includes(segments) ? segments : 6;
  return { id: createId("clock"), label, segments: safeSegments, filled: 0 };
}

/** Pure, clamped update — used both by the "click a dot" and any future
 * +/- control so a stray value never renders more filled segments than a
 * clock actually has. */
export function setClockFilled(clock: FactionClock, filled: number): FactionClock {
  return { ...clock, filled: Math.max(0, Math.min(clock.segments, filled)) };
}

function readClock(value: unknown): FactionClock | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<FactionClock>;
  if (typeof source.id !== "string" || typeof source.label !== "string") return null;
  const segments = typeof source.segments === "number" && source.segments > 0 ? Math.floor(source.segments) : 6;
  const filled = typeof source.filled === "number" ? Math.max(0, Math.min(segments, Math.floor(source.filled))) : 0;
  return { id: source.id, label: source.label, segments, filled };
}

function clampStanding(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(-100, Math.min(100, value));
}

export function readFactionFields(fields: Record<string, unknown>): FactionFields {
  const defaults = defaultFactionFields();
  const source = fields as Partial<FactionFields>;
  return {
    goal: typeof source.goal === "string" ? source.goal : defaults.goal,
    resources: typeof source.resources === "string" ? source.resources : defaults.resources,
    standing: clampStanding(source.standing),
    clocks: Array.isArray(source.clocks) ? source.clocks.map(readClock).filter((c): c is FactionClock => c !== null) : defaults.clocks,
    log: Array.isArray(source.log) ? (source.log as FactionLogEntry[]) : defaults.log,
  };
}
