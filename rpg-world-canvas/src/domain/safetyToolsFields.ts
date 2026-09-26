// Safety Tools — campaign-level (lives on Campaign.safetyTools), not tied
// to any entity kind, same shape as the Calendar Engine. Lines & veils are
// agreed before/at the table and never enforced automatically — this is
// purely a place for the GM to write them down and log how something got
// handled, never a content filter over anything the app generates (the app
// never generates content).

import { createId } from "./id";

export interface SafetyLogEntry {
  id: string;
  at: number;
  note: string;
}

export interface SafetyToolsConfig {
  /** Hard limits — never include this in the story at all. */
  linesAlways: string[];
  /** Handle with care — fade to black, summarize, ask first. */
  veilsCareful: string[];
  log: SafetyLogEntry[];
}

export function defaultSafetyToolsConfig(): SafetyToolsConfig {
  return { linesAlways: [], veilsCareful: [], log: [] };
}

function readLogEntry(value: unknown): SafetyLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<SafetyLogEntry>;
  if (typeof source.id !== "string") return null;
  return { id: source.id, at: typeof source.at === "number" ? source.at : Date.now(), note: typeof source.note === "string" ? source.note : "" };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Lenient by design, same reasoning as readCalendarConfig — an older
 * export or hand-edited JSON without `safetyTools` must fall back cleanly
 * instead of rejecting the whole campaign. */
export function readSafetyToolsConfig(value: unknown): SafetyToolsConfig {
  const defaults = defaultSafetyToolsConfig();
  if (!value || typeof value !== "object") return defaults;
  const source = value as Partial<SafetyToolsConfig>;
  return {
    linesAlways: stringList(source.linesAlways),
    veilsCareful: stringList(source.veilsCareful),
    log: Array.isArray(source.log) ? source.log.map(readLogEntry).filter((e): e is SafetyLogEntry => e !== null) : defaults.log,
  };
}
