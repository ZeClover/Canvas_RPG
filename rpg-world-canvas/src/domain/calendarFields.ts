// Calendar Engine data — campaign-level (lives on Campaign.calendar), not
// tied to any entity kind. Fully custom on purpose: months are a free list
// of name+length pairs (works for a 10-month setting calendar as well as a
// standard one), and `currentDay` only ever moves when the GM explicitly
// advances it. Nothing here infers or simulates a date from anything else.

export interface CalendarMonth {
  name: string;
  days: number;
}

export interface CalendarLogEntry {
  id: string;
  at: number;
  daysAdvanced: number;
  note: string;
}

export interface CalendarConfig {
  epochLabel: string;
  months: CalendarMonth[];
  /** Absolute day count since day 0 (year 1, first month, day 1). */
  currentDay: number;
  log: CalendarLogEntry[];
}

function defaultMonths(): CalendarMonth[] {
  return Array.from({ length: 12 }, (_, i) => ({ name: `Mês ${i + 1}`, days: 30 }));
}

export function defaultCalendarConfig(): CalendarConfig {
  return { epochLabel: "", months: defaultMonths(), currentDay: 0, log: [] };
}

function readMonth(value: unknown): CalendarMonth | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<CalendarMonth>;
  if (typeof source.name !== "string") return null;
  const days = typeof source.days === "number" && Number.isFinite(source.days) && source.days > 0 ? Math.floor(source.days) : 30;
  return { name: source.name, days };
}

function readLogEntry(value: unknown): CalendarLogEntry | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<CalendarLogEntry>;
  if (typeof source.id !== "string") return null;
  return {
    id: source.id,
    at: typeof source.at === "number" ? source.at : Date.now(),
    daysAdvanced: typeof source.daysAdvanced === "number" ? source.daysAdvanced : 0,
    note: typeof source.note === "string" ? source.note : "",
  };
}

/** Lenient by design — used both by the UI and by campaign-archive import,
 * where a missing/malformed `calendar` (an older export, hand-edited JSON)
 * must fall back cleanly instead of rejecting the whole campaign. */
export function readCalendarConfig(value: unknown): CalendarConfig {
  const defaults = defaultCalendarConfig();
  if (!value || typeof value !== "object") return defaults;
  const source = value as Partial<CalendarConfig>;
  const months = Array.isArray(source.months) ? source.months.map(readMonth).filter((m): m is CalendarMonth => m !== null) : [];
  return {
    epochLabel: typeof source.epochLabel === "string" ? source.epochLabel : defaults.epochLabel,
    months: months.length ? months : defaults.months,
    currentDay: typeof source.currentDay === "number" && Number.isFinite(source.currentDay) && source.currentDay >= 0 ? Math.floor(source.currentDay) : defaults.currentDay,
    log: Array.isArray(source.log) ? source.log.map(readLogEntry).filter((l): l is CalendarLogEntry => l !== null) : defaults.log,
  };
}

function yearLength(months: CalendarMonth[]): number {
  return months.reduce((sum, month) => sum + month.days, 0);
}

export interface CalendarDate {
  year: number;
  monthIndex: number;
  /** 1-based day within the month. */
  day: number;
}

/** Converts an absolute day count into year/month/day, cycling through the
 * campaign's custom calendar. Pure and total: always returns a valid date,
 * even for a degenerate (zero-length) calendar. */
export function resolveCalendarDate(config: CalendarConfig, absoluteDay: number = config.currentDay): CalendarDate {
  const total = yearLength(config.months);
  if (total <= 0 || !config.months.length) return { year: 1, monthIndex: 0, day: 1 };
  const safeDay = Math.max(0, Math.floor(absoluteDay));
  const year = Math.floor(safeDay / total) + 1;
  let remaining = safeDay % total;
  for (let i = 0; i < config.months.length; i++) {
    const month = config.months[i];
    if (remaining < month.days) return { year, monthIndex: i, day: remaining + 1 };
    remaining -= month.days;
  }
  const lastIndex = config.months.length - 1;
  return { year, monthIndex: lastIndex, day: config.months[lastIndex].days };
}

export function formatCalendarDate(config: CalendarConfig, absoluteDay: number = config.currentDay): string {
  const { year, monthIndex, day } = resolveCalendarDate(config, absoluteDay);
  const monthLabel = config.months[monthIndex]?.name ?? "?";
  const yearLabel = config.epochLabel.trim() ? `${year} ${config.epochLabel.trim()}` : `Ano ${year}`;
  return `Dia ${day} de ${monthLabel}, ${yearLabel}`;
}
