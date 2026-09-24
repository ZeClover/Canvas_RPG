// Quest/Side Quest structured data. Who's involved, where it happens, what
// it reveals — all of that is expressed with the existing Relation system
// (involves/happens_at/reveals/offers/points_to…) instead of parallel ID
// lists here, so a quest's connections show up the same way everywhere
// else in the app (canvas, search, other entities' relation lists).

export const QUEST_STATUSES = [
  "Ideia", "Não disponível", "Disponível", "Descoberta", "Ativa",
  "Suspensa", "Concluída", "Falhou", "Transformada", "Cancelada",
] as const;
export type QuestStatus = typeof QUEST_STATUSES[number];

export interface QuestObjective {
  id: string;
  text: string;
  done: boolean;
}

export interface QuestResolution {
  id: string;
  title: string;
  description: string;
}

export interface QuestClock {
  label: string;
  current: number;
  max: number;
}

export interface QuestFields {
  motivation: string;
  mainObjective: string;
  secondaryObjectives: QuestObjective[];
  hiddenObjectives: QuestObjective[];
  rewards: string;
  consequences: string;
  startConditions: string;
  failConditions: string;
  completeConditions: string;
  deadline: string;
  clock: QuestClock | null;
  resolutions: QuestResolution[];
}

export function defaultQuestFields(): QuestFields {
  return {
    motivation: "", mainObjective: "", secondaryObjectives: [], hiddenObjectives: [],
    rewards: "", consequences: "", startConditions: "", failConditions: "", completeConditions: "",
    deadline: "", clock: null, resolutions: [],
  };
}

export function readQuestFields(fields: Record<string, unknown>): QuestFields {
  const defaults = defaultQuestFields();
  const source = fields as Partial<QuestFields>;
  return {
    motivation: typeof source.motivation === "string" ? source.motivation : defaults.motivation,
    mainObjective: typeof source.mainObjective === "string" ? source.mainObjective : defaults.mainObjective,
    secondaryObjectives: Array.isArray(source.secondaryObjectives) ? source.secondaryObjectives : defaults.secondaryObjectives,
    hiddenObjectives: Array.isArray(source.hiddenObjectives) ? source.hiddenObjectives : defaults.hiddenObjectives,
    rewards: typeof source.rewards === "string" ? source.rewards : defaults.rewards,
    consequences: typeof source.consequences === "string" ? source.consequences : defaults.consequences,
    startConditions: typeof source.startConditions === "string" ? source.startConditions : defaults.startConditions,
    failConditions: typeof source.failConditions === "string" ? source.failConditions : defaults.failConditions,
    completeConditions: typeof source.completeConditions === "string" ? source.completeConditions : defaults.completeConditions,
    deadline: typeof source.deadline === "string" ? source.deadline : defaults.deadline,
    clock: source.clock && typeof source.clock === "object" ? (source.clock as QuestClock) : defaults.clock,
    resolutions: Array.isArray(source.resolutions) ? source.resolutions : defaults.resolutions,
  };
}
