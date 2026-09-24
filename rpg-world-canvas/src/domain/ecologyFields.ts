// Encounter Ecology Engine data — a creature's reference profile for
// reuse across encounters. Predator/prey relationships are expressed via
// the "preys_on" relation type (graph data, reusable by the Mystery Board
// and any future ecology-chain view), not stored here.

export const THREAT_LEVELS = ["Trivial", "Baixa", "Média", "Alta", "Mortal"] as const;
export type ThreatLevel = typeof THREAT_LEVELS[number];

export interface EcologyFields {
  habitat: string;
  diet: string;
  behavior: string;
  threatLevel: ThreatLevel;
  groupSize: string;
}

export function defaultEcologyFields(): EcologyFields {
  return { habitat: "", diet: "", behavior: "", threatLevel: "Baixa", groupSize: "" };
}

export function readEcologyFields(fields: Record<string, unknown>): EcologyFields {
  const defaults = defaultEcologyFields();
  const source = fields as Partial<EcologyFields>;
  return {
    habitat: typeof source.habitat === "string" ? source.habitat : defaults.habitat,
    diet: typeof source.diet === "string" ? source.diet : defaults.diet,
    behavior: typeof source.behavior === "string" ? source.behavior : defaults.behavior,
    threatLevel: typeof source.threatLevel === "string" && (THREAT_LEVELS as readonly string[]).includes(source.threatLevel) ? source.threatLevel as ThreatLevel : defaults.threatLevel,
    groupSize: typeof source.groupSize === "string" ? source.groupSize : defaults.groupSize,
  };
}
