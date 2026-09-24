// Theme data — recurring motifs/images the GM wants to echo through the
// campaign. Where a theme shows up is expressed via relations to the
// scenes/quests/NPCs that carry it, not a stored list here.

export interface ThemeFields {
  motifs: string[];
  notes: string;
}

export function defaultThemeFields(): ThemeFields {
  return { motifs: [], notes: "" };
}

export function readThemeFields(fields: Record<string, unknown>): ThemeFields {
  const defaults = defaultThemeFields();
  const source = fields as Partial<ThemeFields>;
  return {
    motifs: Array.isArray(source.motifs) ? source.motifs.filter((item): item is string => typeof item === "string") : defaults.motifs,
    notes: typeof source.notes === "string" ? source.notes : defaults.notes,
  };
}
