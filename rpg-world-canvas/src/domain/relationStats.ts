// Optional numeric relation stats — trust/respect/fear/debt/conflict.
// Deliberately optional per relation, never forced onto every NPC pair.

export interface RelationStats {
  trust: number | null;
  respect: number | null;
  fear: number | null;
  debt: number | null;
  conflict: number | null;
}

export const RELATION_STAT_LABEL: Record<keyof RelationStats, string> = {
  trust: "Confiança", respect: "Respeito", fear: "Medo", debt: "Dívida", conflict: "Conflito",
};

export function defaultRelationStats(): RelationStats {
  return { trust: null, respect: null, fear: null, debt: null, conflict: null };
}

export function readRelationStats(fields: Record<string, unknown>): RelationStats {
  const defaults = defaultRelationStats();
  const source = fields as Partial<RelationStats>;
  const numberOrNull = (value: unknown): number | null => (typeof value === "number" ? value : null);
  return {
    trust: numberOrNull(source.trust) ?? defaults.trust,
    respect: numberOrNull(source.respect) ?? defaults.respect,
    fear: numberOrNull(source.fear) ?? defaults.fear,
    debt: numberOrNull(source.debt) ?? defaults.debt,
    conflict: numberOrNull(source.conflict) ?? defaults.conflict,
  };
}
