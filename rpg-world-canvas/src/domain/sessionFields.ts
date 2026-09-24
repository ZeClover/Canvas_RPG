// Session structured data. Presence (NPCs/players/locations/scenes/quests)
// is expressed with Relations, not parallel ID lists — see questFields.ts
// for the same reasoning.

export interface SessionFields {
  number: string;
  date: string;
  duration: string;
  notes: string;
  transcript: string;
  consequences: string;
  developmentPoints: number;
  resourcesUsed: string;
  finalizedAt: number | null;
}

export function defaultSessionFields(): SessionFields {
  return { number: "", date: "", duration: "", notes: "", transcript: "", consequences: "", developmentPoints: 0, resourcesUsed: "", finalizedAt: null };
}

export function readSessionFields(fields: Record<string, unknown>): SessionFields {
  const defaults = defaultSessionFields();
  const source = fields as Partial<SessionFields>;
  return {
    number: typeof source.number === "string" ? source.number : defaults.number,
    date: typeof source.date === "string" ? source.date : defaults.date,
    duration: typeof source.duration === "string" ? source.duration : defaults.duration,
    notes: typeof source.notes === "string" ? source.notes : defaults.notes,
    transcript: typeof source.transcript === "string" ? source.transcript : defaults.transcript,
    consequences: typeof source.consequences === "string" ? source.consequences : defaults.consequences,
    developmentPoints: typeof source.developmentPoints === "number" ? source.developmentPoints : defaults.developmentPoints,
    resourcesUsed: typeof source.resourcesUsed === "string" ? source.resourcesUsed : defaults.resourcesUsed,
    finalizedAt: typeof source.finalizedAt === "number" ? source.finalizedAt : defaults.finalizedAt,
  };
}
