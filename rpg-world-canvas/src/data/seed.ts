import { createId } from "../domain/id";
import { kindConfig } from "../domain/entityKindRegistry";
import type { Campaign, CampaignData, Entity, EntityKind, Relation, RelationType, View } from "../domain/types";

export function createDefaultViews(campaignId: string): View[] {
  const now = Date.now();
  const view = (title: string, icon: string, kinds: EntityKind[] | undefined, isDefault = false): View => ({
    id: createId("view"),
    campaignId,
    title,
    icon,
    filter: kinds ? { kinds } : {},
    isDefault,
    createdAt: now,
    updatedAt: now,
  });
  return [
    view("Visão Geral", "🌐", undefined, true),
    view("NPCs", "🧑", ["npc"]),
    view("Quests", "⭐", ["quest", "side_quest"]),
    view("Facções", "🚩", ["faction"]),
    view("Locais", "📍", ["location", "city", "region"]),
    view("Mistérios", "🔍", ["secret", "clue", "rumor"]),
  ];
}

interface EntitySeed {
  key: string;
  kind: EntityKind;
  title: string;
  x: number;
  y: number;
  summary?: string;
  color?: string;
  tags?: string[];
  groupKey?: string;
  status?: string;
  important?: boolean;
}

function buildEntity(campaignId: string, seed: EntitySeed, groupIds: Map<string, string>, now: number): Entity {
  const config = kindConfig(seed.kind);
  return {
    id: createId("entity"),
    campaignId,
    kind: seed.kind,
    title: seed.title,
    summary: seed.summary ?? "",
    color: seed.color ?? null,
    icon: null,
    imageSrc: null,
    tags: seed.tags ?? [],
    status: seed.status ?? null,
    fields: {},
    x: seed.x,
    y: seed.y,
    width: config.width,
    height: config.height,
    groupId: seed.groupKey ? groupIds.get(seed.groupKey) ?? null : null,
    visibility: "gm_only",
    important: seed.important ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createDemoCampaign(): CampaignData {
  const now = Date.now();
  const campaign: Campaign = {
    id: createId("campaign"),
    title: "Academia Mágica",
    description: "Aulas, professores, alunos, facções e a Dungeon sob a escola.",
    color: "#a78bfa",
    icon: "🪄",
    createdAt: now,
    updatedAt: now,
  };

  const groupSeeds: EntitySeed[] = [
    { key: "campus", kind: "group", title: "CAMPUS", x: -300, y: -300 },
    { key: "sessions", kind: "group", title: "SESSÕES", x: 2900, y: -300 },
  ];
  const groupIds = new Map<string, string>();
  const groups = groupSeeds.map((seed) => {
    const entity = buildEntity(campaign.id, { ...seed, x: seed.x, y: seed.y }, groupIds, now);
    entity.width = seed.key === "campus" ? 2200 : 1600;
    entity.height = 1400;
    groupIds.set(seed.key, entity.id);
    return entity;
  });

  const entitySeeds: EntitySeed[] = [
    { key: "n_potter", kind: "npc", title: "Potter Magwood", x: -180, y: -180, summary: "Professor marcado por um trauma com magia exagerada.", tags: ["professor"], groupKey: "campus" },
    { key: "n_vivian", kind: "npc", title: "Vivian Ashcombe", x: 160, y: -180, summary: "Bibliotecária que sabe mais do que aparenta.", tags: ["biblioteca"], groupKey: "campus" },
    { key: "n_kaleb", kind: "npc", title: "Kaleb Orne", x: 500, y: -180, summary: "Aluno do último ano, ambicioso.", tags: ["aluno"], groupKey: "campus" },
    { key: "f_order", kind: "faction", title: "Ordem dos Selos", x: -180, y: 140, summary: "Mantém a Dungeon contida há gerações.", groupKey: "campus" },
    { key: "l_dungeon", kind: "location", title: "A Dungeon", x: 160, y: 140, summary: "Abre todas as noites, mas parece estar mudando.", important: true, groupKey: "campus" },
    { key: "l_library", kind: "location", title: "Biblioteca Proibida", x: 500, y: 140, summary: "Seção trancada sobre a Dungeon.", groupKey: "campus" },
    { key: "q_exercise", kind: "quest", title: "O Exercício Perigoso", x: 160, y: 420, summary: "Um professor propõe um treino arriscado demais.", status: "Ativa", groupKey: "campus", important: true },
    { key: "sq_grimorio", kind: "side_quest", title: "O Grimório Sumido", x: 500, y: 420, summary: "Criada a partir de uma suspeita de Kaleb.", status: "Disponível", groupKey: "campus" },
    { key: "s_rune", kind: "secret", title: "A runa quebrada abre um caminho", x: -180, y: 420, summary: "Só Vivian e Potter sabem disso.", groupKey: "campus" },
    { key: "c_rune", kind: "clue", title: "Pista: runa quebrada", x: -180, y: 680, summary: "A mesma runa existe na entrada proibida.", groupKey: "campus" },
    { key: "r_dungeon", kind: "rumor", title: "\"A Dungeon está mudando\"", x: 160, y: 680, summary: "Circula entre os alunos do último ano.", groupKey: "campus" },
    { key: "e_alarm", kind: "event", title: "Alarme na Dungeon", x: 500, y: 680, summary: "Sinos tocam no meio da noite.", groupKey: "campus" },
    { key: "sess_01", kind: "session", title: "Sessão 01 · A Primeira Aula", x: 3000, y: -180, summary: "Abertura da campanha.", groupKey: "sessions" },
    { key: "sess_02", kind: "session", title: "Sessão 02 · A Dungeon Desperta", x: 3400, y: -180, summary: "O alarme toca.", groupKey: "sessions" },
  ];

  const entityIds = new Map<string, string>();
  const entities = entitySeeds.map((seed) => {
    const entity = buildEntity(campaign.id, seed, groupIds, now);
    entityIds.set(seed.key, entity.id);
    return entity;
  });

  const relationSeeds: Array<{ from: string; to: string; type: RelationType; label?: string }> = [
    { from: "n_potter", to: "n_vivian", type: "trusts" },
    { from: "n_potter", to: "f_order", type: "member_of" },
    { from: "n_vivian", to: "f_order", type: "member_of" },
    { from: "n_kaleb", to: "sq_grimorio", type: "involves" },
    { from: "q_exercise", to: "l_dungeon", type: "happens_at" },
    { from: "sq_grimorio", to: "n_vivian", type: "offers" },
    { from: "s_rune", to: "l_dungeon", type: "reveals" },
    { from: "c_rune", to: "s_rune", type: "points_to" },
    { from: "r_dungeon", to: "e_alarm", type: "originated_from" },
    { from: "e_alarm", to: "q_exercise", type: "leads_to" },
    { from: "n_vivian", to: "s_rune", type: "knows_about" },
  ];
  const relations: Relation[] = relationSeeds.map((seed) => ({
    id: createId("relation"),
    campaignId: campaign.id,
    fromEntityId: entityIds.get(seed.from)!,
    toEntityId: entityIds.get(seed.to)!,
    type: seed.type,
    label: seed.label ?? "",
    description: "",
    date: null,
    sessionId: null,
    importance: null,
    state: null,
    history: [],
    createdAt: now,
    updatedAt: now,
  }));

  return {
    campaign,
    entities: [...groups, ...entities],
    relations,
    views: createDefaultViews(campaign.id),
  };
}
