// Rumor Engine data — the GM-only truth behind what circulates. "Falso"/
// "Parcial" rumors are exactly why Player Knowledge View (Fase 6) will
// matter: players hear the summary, only the GM sees this.

export const RUMOR_TRUTH_STATES = ["Desconhecido", "Verdadeiro", "Falso", "Parcial"] as const;
export type RumorTruthState = typeof RUMOR_TRUTH_STATES[number];

export interface RumorFields {
  truth: RumorTruthState;
  source: string;
  spreadNotes: string;
  templateId: string | null;
}

export function defaultRumorFields(): RumorFields {
  return { truth: "Desconhecido", source: "", spreadNotes: "", templateId: null };
}

export function readRumorFields(fields: Record<string, unknown>): RumorFields {
  const defaults = defaultRumorFields();
  const source = fields as Partial<RumorFields>;
  return {
    truth: typeof source.truth === "string" && (RUMOR_TRUTH_STATES as readonly string[]).includes(source.truth) ? source.truth as RumorTruthState : defaults.truth,
    source: typeof source.source === "string" ? source.source : defaults.source,
    spreadNotes: typeof source.spreadNotes === "string" ? source.spreadNotes : defaults.spreadNotes,
    templateId: typeof source.templateId === "string" ? source.templateId : defaults.templateId,
  };
}
