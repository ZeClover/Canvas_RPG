// Event-specific structured data, mainly for the Timeline.

export interface EventFields {
  date: string;
  era: string;
  timelineOrder: number | null;
  duration: string;
  cause: string;
  consequence: string;
}

export function defaultEventFields(): EventFields {
  return { date: "", era: "", timelineOrder: null, duration: "", cause: "", consequence: "" };
}

export function readEventFields(fields: Record<string, unknown>): EventFields {
  const defaults = defaultEventFields();
  const source = fields as Partial<EventFields>;
  return {
    date: typeof source.date === "string" ? source.date : defaults.date,
    era: typeof source.era === "string" ? source.era : defaults.era,
    timelineOrder: typeof source.timelineOrder === "number" ? source.timelineOrder : defaults.timelineOrder,
    duration: typeof source.duration === "string" ? source.duration : defaults.duration,
    cause: typeof source.cause === "string" ? source.cause : defaults.cause,
    consequence: typeof source.consequence === "string" ? source.consequence : defaults.consequence,
  };
}
