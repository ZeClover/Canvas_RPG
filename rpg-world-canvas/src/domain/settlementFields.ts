// Settlement Engine data — scoped to kind "city" (a "region" is a broader
// geographic area, not a populated place with a growth stage). Growth is
// never simulated or inferred: the GM logs what happened after a session,
// same discipline as everything else in this app.

export const SETTLEMENT_STAGES = [
  "Acampamento", "Vila", "Vilarejo", "Cidade pequena", "Cidade", "Metrópole", "Em ruínas", "Abandonado",
] as const;
export type SettlementStage = typeof SETTLEMENT_STAGES[number];

export interface SettlementLogEntry {
  id: string;
  at: number;
  note: string;
}

export interface SettlementFields {
  stage: SettlementStage;
  population: string;
  prosperity: number;
  stability: number;
  governance: string;
  defenses: string;
  needs: string[];
  log: SettlementLogEntry[];
}

export function defaultSettlementFields(): SettlementFields {
  return {
    stage: "Vilarejo", population: "", prosperity: 50, stability: 50,
    governance: "", defenses: "", needs: [], log: [],
  };
}

function clampPercent(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}

export function readSettlementFields(fields: Record<string, unknown>): SettlementFields {
  const defaults = defaultSettlementFields();
  const source = fields as Partial<SettlementFields>;
  return {
    stage: typeof source.stage === "string" && (SETTLEMENT_STAGES as readonly string[]).includes(source.stage) ? source.stage as SettlementStage : defaults.stage,
    population: typeof source.population === "string" ? source.population : defaults.population,
    prosperity: clampPercent(source.prosperity, defaults.prosperity),
    stability: clampPercent(source.stability, defaults.stability),
    governance: typeof source.governance === "string" ? source.governance : defaults.governance,
    defenses: typeof source.defenses === "string" ? source.defenses : defaults.defenses,
    needs: Array.isArray(source.needs) ? source.needs.filter((item): item is string => typeof item === "string") : defaults.needs,
    log: Array.isArray(source.log) ? (source.log as SettlementLogEntry[]) : defaults.log,
  };
}
