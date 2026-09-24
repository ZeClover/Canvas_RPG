// Foreshadowing Engine data — a planted hint tracked to its payoff. The
// GM logs each time it was mentioned/reinforced in play by hand (same
// discipline as the Settlement Engine's growth log); nothing here is
// inferred from session transcripts or generated automatically.

export const FORESHADOWING_STATUSES = ["Plantado", "Reforçado", "Pago", "Abandonado"] as const;
export type ForeshadowingStatus = typeof FORESHADOWING_STATUSES[number];

export interface ForeshadowingLogEntry {
  id: string;
  at: number;
  note: string;
}

export interface ForeshadowingFields {
  status: ForeshadowingStatus;
  hint: string;
  intendedPayoff: string;
  log: ForeshadowingLogEntry[];
}

export function defaultForeshadowingFields(): ForeshadowingFields {
  return { status: "Plantado", hint: "", intendedPayoff: "", log: [] };
}

export function readForeshadowingFields(fields: Record<string, unknown>): ForeshadowingFields {
  const defaults = defaultForeshadowingFields();
  const source = fields as Partial<ForeshadowingFields>;
  return {
    status: typeof source.status === "string" && (FORESHADOWING_STATUSES as readonly string[]).includes(source.status) ? source.status as ForeshadowingStatus : defaults.status,
    hint: typeof source.hint === "string" ? source.hint : defaults.hint,
    intendedPayoff: typeof source.intendedPayoff === "string" ? source.intendedPayoff : defaults.intendedPayoff,
    log: Array.isArray(source.log) ? (source.log as ForeshadowingLogEntry[]) : defaults.log,
  };
}
