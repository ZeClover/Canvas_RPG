// Downtime Engine data — scoped to kind "downtime". A personal, between-
// session activity (crafting, training, research) a character commits
// days toward. Progress is always derived from daysSpent/daysNeeded,
// never stored — same discipline as Project Engine's stage progress.
// Spending days is manual, typically alongside advancing the Calendar;
// nothing here auto-advances anything.

export interface DowntimeLogEntry {
  id: string;
  at: number;
  note: string;
}

export interface DowntimeFields {
  characterEntityId: string | null;
  activity: string;
  daysNeeded: number;
  daysSpent: number;
  outcomeNote: string;
  log: DowntimeLogEntry[];
}

export function defaultDowntimeFields(): DowntimeFields {
  return { characterEntityId: null, activity: "", daysNeeded: 1, daysSpent: 0, outcomeNote: "", log: [] };
}

function readLogEntry(value: unknown): DowntimeLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<DowntimeLogEntry>;
  if (typeof source.id !== "string") return null;
  return { id: source.id, at: typeof source.at === "number" ? source.at : Date.now(), note: typeof source.note === "string" ? source.note : "" };
}

export function readDowntimeFields(fields: Record<string, unknown>): DowntimeFields {
  const defaults = defaultDowntimeFields();
  const source = fields as Partial<DowntimeFields>;
  return {
    characterEntityId: typeof source.characterEntityId === "string" ? source.characterEntityId : defaults.characterEntityId,
    activity: typeof source.activity === "string" ? source.activity : defaults.activity,
    daysNeeded: typeof source.daysNeeded === "number" && Number.isFinite(source.daysNeeded) && source.daysNeeded >= 0 ? source.daysNeeded : defaults.daysNeeded,
    daysSpent: typeof source.daysSpent === "number" && Number.isFinite(source.daysSpent) && source.daysSpent >= 0 ? source.daysSpent : defaults.daysSpent,
    outcomeNote: typeof source.outcomeNote === "string" ? source.outcomeNote : defaults.outcomeNote,
    log: Array.isArray(source.log) ? source.log.map(readLogEntry).filter((l): l is DowntimeLogEntry => l !== null) : defaults.log,
  };
}

export interface DowntimeProgress {
  percent: number;
  complete: boolean;
}

export function downtimeProgress(fields: DowntimeFields): DowntimeProgress {
  if (fields.daysNeeded <= 0) return { percent: 100, complete: true };
  const percent = Math.min(100, Math.round((fields.daysSpent / fields.daysNeeded) * 100));
  return { percent, complete: fields.daysSpent >= fields.daysNeeded };
}
