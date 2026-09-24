// NPC-specific structured data, stored inside Entity.fields — none of this
// drives automatic behavior. It's reference material the GM reads; the GM
// decides what it means at the table.

export type KnowledgeState = "sabe" | "suspeita" | "acredita" | "acredita_incorretamente" | "esqueceu" | "nao_sabe" | "mente_que_sabe";

export const KNOWLEDGE_STATE_LABEL: Record<KnowledgeState, string> = {
  sabe: "Sabe",
  suspeita: "Suspeita",
  acredita: "Acredita",
  acredita_incorretamente: "Acredita (errado)",
  esqueceu: "Esqueceu",
  nao_sabe: "Não sabe",
  mente_que_sabe: "Finge que sabe",
};

export interface NpcKnowledgeEntry {
  id: string;
  statement: string;
  state: KnowledgeState;
  discoveredAtSession: string | null;
  source: string;
}

export interface NpcHistoryEntry {
  id: string;
  sessionLabel: string;
  note: string;
  at: number;
}

export interface NpcPossibility {
  id: string;
  text: string;
  done: boolean;
}

export interface NpcFields {
  age: string;
  race: string;
  profession: string;
  organization: string;
  currentLocation: string;
  traits: string[];
  behaviors: string[];
  values: string[];
  fears: string[];
  desires: string[];
  goals: string[];
  limits: string[];
  habits: string[];
  history: NpcHistoryEntry[];
  knowledge: NpcKnowledgeEntry[];
  possibilities: NpcPossibility[];
}

export function defaultNpcFields(): NpcFields {
  return {
    age: "", race: "", profession: "", organization: "", currentLocation: "",
    traits: [], behaviors: [], values: [], fears: [], desires: [], goals: [], limits: [], habits: [],
    history: [], knowledge: [], possibilities: [],
  };
}

/** Reads NpcFields out of the generic `fields` bag defensively — a fresh
 * NPC (or one created before a given key existed) simply gets the default
 * for whatever is missing, never a crash. */
export function readNpcFields(fields: Record<string, unknown>): NpcFields {
  const defaults = defaultNpcFields();
  const source = fields as Partial<NpcFields>;
  return {
    age: typeof source.age === "string" ? source.age : defaults.age,
    race: typeof source.race === "string" ? source.race : defaults.race,
    profession: typeof source.profession === "string" ? source.profession : defaults.profession,
    organization: typeof source.organization === "string" ? source.organization : defaults.organization,
    currentLocation: typeof source.currentLocation === "string" ? source.currentLocation : defaults.currentLocation,
    traits: Array.isArray(source.traits) ? source.traits : defaults.traits,
    behaviors: Array.isArray(source.behaviors) ? source.behaviors : defaults.behaviors,
    values: Array.isArray(source.values) ? source.values : defaults.values,
    fears: Array.isArray(source.fears) ? source.fears : defaults.fears,
    desires: Array.isArray(source.desires) ? source.desires : defaults.desires,
    goals: Array.isArray(source.goals) ? source.goals : defaults.goals,
    limits: Array.isArray(source.limits) ? source.limits : defaults.limits,
    habits: Array.isArray(source.habits) ? source.habits : defaults.habits,
    history: Array.isArray(source.history) ? source.history : defaults.history,
    knowledge: Array.isArray(source.knowledge) ? source.knowledge : defaults.knowledge,
    possibilities: Array.isArray(source.possibilities) ? source.possibilities : defaults.possibilities,
  };
}
