// Per-campaign module toggles. Every specialized tool from Fase 2 onward
// (NPC Brain, Quest Studio, Mystery Board, Rules Engine, Settlement
// Engine...) is useful in some campaigns and unwanted noise in others —
// "tem certas coisas que eu não quero em uma campanha mas quero na
// outra". A module only gates the SPECIALIZED editor section for its
// kind(s) and its entry in the Ferramentas menu; the underlying entity
// kind (npc, city, rule...) stays a normal, always-creatable card either
// way, so turning a module off or back on never loses data — the fields
// bag is still there, just not shown.
//
// Core Fase 1 (Canvas, Views, busca, grupos, relações, undo/redo) is the
// foundation and is never gated — only the specialized layers on top are.

import type { EntityKind } from "./types";

export type ModuleKey =
  | "npc_brain" | "quest_studio" | "session_system" | "timeline"
  | "knowledge_engine" | "mystery_board" | "causality_engine" | "rules_engine"
  | "settlement_engine" | "project_engine" | "economy_engine" | "resource_engine"
  | "scene_composer" | "theme_foreshadowing" | "ecology_engine" | "rumor_engine"
  | "transcript_engine" | "campaign_health" | "player_knowledge_view"
  | "world_communication" | "combat_tracker" | "character_sheet"
  | "faction_engine" | "calendar_engine" | "table_engine" | "travel_engine"
  | "presentation_mode" | "schedule_engine" | "safety_tools" | "downtime_engine";

export interface ModuleConfig {
  key: ModuleKey;
  label: string;
  description: string;
  phase: number;
}

export const MODULE_REGISTRY: ModuleConfig[] = [
  { key: "npc_brain", label: "NPC Brain", description: "Personalidade, conhecimento e possibilidades futuras no card de NPC.", phase: 2 },
  { key: "quest_studio", label: "Quest Studio", description: "Objetivos, condições, relógio de tensão e resoluções em quests/side quests.", phase: 2 },
  { key: "session_system", label: "Sistema de Sessões", description: "Registro estruturado de sessão, com a ação \"Finalizar sessão\".", phase: 2 },
  { key: "timeline", label: "Timeline", description: "Linha do tempo agregando eventos e sessões por data.", phase: 2 },
  { key: "knowledge_engine", label: "Knowledge Engine", description: "Painel \"quem sabe o quê\" a partir das relações já desenhadas.", phase: 3 },
  { key: "mystery_board", label: "Mystery/Conspiracy Board", description: "Ranking de conexões, pistas soltas e explorador de vizinhança.", phase: 3 },
  { key: "causality_engine", label: "Efeito Borboleta", description: "Cadeia causal recursiva entre decisões, eventos e quests.", phase: 3 },
  { key: "rules_engine", label: "Rules Engine", description: "Automação determinística (\"quando X vira Y, então Z\") — desligar também para de avaliar as regras da campanha.", phase: 3 },
  { key: "settlement_engine", label: "Settlement Engine", description: "Progresso de cidades: estágio, população, prosperidade, estabilidade.", phase: 4 },
  { key: "project_engine", label: "Project Engine", description: "Objetivo, etapas marcáveis, prazo e bloqueios em projetos.", phase: 4 },
  { key: "economy_engine", label: "Economy Engine", description: "Preço, moeda e raridade em itens, mais o painel de preços.", phase: 4 },
  { key: "resource_engine", label: "Resource & Survival Engine", description: "Estoque, unidade e limite crítico em recursos.", phase: 4 },
  { key: "scene_composer", label: "Scene Composer", description: "Texto de leitura, tom e complicações para cenas.", phase: 5 },
  { key: "theme_foreshadowing", label: "Tema & Foreshadowing", description: "Motivos recorrentes e rastreamento de presságios até o pagamento.", phase: 5 },
  { key: "ecology_engine", label: "Encounter Ecology", description: "Perfil ecológico de criaturas: habitat, dieta, comportamento, ameaça.", phase: 5 },
  { key: "rumor_engine", label: "Rumor Engine", description: "Estado de verdade/fonte em rumores, mais o gerador por templates.", phase: 5 },
  { key: "transcript_engine", label: "Transcrições", description: "Importa TXT/SRT/VTT, busca por palavra-chave e converte trechos em elementos do Canvas.", phase: 6 },
  { key: "campaign_health", label: "Campaign Health Dashboard", description: "Painel de saúde da campanha: contagens, pistas soltas, recursos críticos, regras desativadas.", phase: 6 },
  { key: "player_knowledge_view", label: "Player Knowledge View", description: "O que os jogadores sabem oficialmente, a partir da visibilidade de cada elemento.", phase: 6 },
  { key: "world_communication", label: "World Communication System", description: "Cartas, mensageiros e feitiços de comunicação entre NPCs/facções, com meio, status de entrega e conteúdo.", phase: 7 },
  { key: "combat_tracker", label: "Combat Tracker", description: "Iniciativa, PV e condições por combatente, com avanço de turno/rodada.", phase: 8 },
  { key: "character_sheet", label: "Character Sheet", description: "PV, nível e atributos genéricos no card de Personagem, agnóstico de sistema.", phase: 8 },
  { key: "faction_engine", label: "Faction Engine", description: "Objetivo, recursos, standing e relógios de progresso (estilo clocks) por facção.", phase: 8 },
  { key: "calendar_engine", label: "Calendar Engine", description: "Calendário customizável e relógio in-fiction da campanha, avançado manualmente pelo mestre.", phase: 8 },
  { key: "table_engine", label: "Random Table Engine", description: "Tabelas reutilizáveis com sorteio ponderado (nomes, loot, encontros, o que for) — RNG puro, sem IA.", phase: 8 },
  { key: "travel_engine", label: "Travel & Journey Engine", description: "Trechos de viagem entre locais, com distância, dias e progresso — planejado pelo mestre, nunca simulado.", phase: 9 },
  { key: "presentation_mode", label: "Modo Apresentação", description: "Botão \"Mostrar aos jogadores\" abre qualquer elemento em tela cheia, respeitando a visibilidade já definida.", phase: 9 },
  { key: "schedule_engine", label: "Agenda", description: "Onde alguém ou algo está em cada período — funciona em qualquer elemento, com painel \"Onde estão agora\" agrupado por local.", phase: 9 },
  { key: "safety_tools", label: "Safety Tools", description: "Limites e cuidados combinados para a mesa (lines & veils), com registro de ajustes feitos em sessão.", phase: 10 },
  { key: "downtime_engine", label: "Downtime Engine", description: "Atividades de entressessões por personagem — dias necessários vs. gastos, progresso sempre derivado.", phase: 10 },
];

export const ALL_MODULE_KEYS: ModuleKey[] = MODULE_REGISTRY.map((module) => module.key);
const MODULE_KEY_SET = new Set<string>(ALL_MODULE_KEYS);

export function isModuleKey(value: string): value is ModuleKey {
  return MODULE_KEY_SET.has(value);
}

/** New campaigns (and any campaign saved before this feature existed) get
 * everything enabled — nothing changes until the GM deliberately turns a
 * module off. */
export function defaultEnabledModules(): ModuleKey[] {
  return [...ALL_MODULE_KEYS];
}

/** Which module (if any) owns the specialized inspector section for a
 * given entity kind. A kind with no entry here has no specialized
 * section — it's always just the generic card (title/summary/tags/
 * relations), same with a module on or off. */
export const MODULE_FOR_KIND: Partial<Record<EntityKind, ModuleKey>> = {
  npc: "npc_brain",
  quest: "quest_studio",
  side_quest: "quest_studio",
  session: "session_system",
  rule: "rules_engine",
  city: "settlement_engine",
  project: "project_engine",
  item: "economy_engine",
  resource: "resource_engine",
  scene: "scene_composer",
  theme: "theme_foreshadowing",
  foreshadowing: "theme_foreshadowing",
  creature: "ecology_engine",
  rumor: "rumor_engine",
  transcript: "transcript_engine",
  message: "world_communication",
  encounter: "combat_tracker",
  player: "character_sheet",
  faction: "faction_engine",
  table: "table_engine",
  journey: "travel_engine",
  downtime: "downtime_engine",
};

export function isKindSectionEnabled(kind: EntityKind, enabledModules: ModuleKey[]): boolean {
  const owner = MODULE_FOR_KIND[kind];
  return !owner || enabledModules.includes(owner);
}
