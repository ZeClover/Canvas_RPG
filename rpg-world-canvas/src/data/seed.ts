import { defaultCalendarConfig } from "../domain/calendarFields";
import { createId } from "../domain/id";
import { kindConfig } from "../domain/entityKindRegistry";
import { defaultEnabledModules } from "../domain/modules";
import type { Campaign, CampaignData, Entity, EntityKind, Relation, RelationType, View, Visibility } from "../domain/types";

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
    view("Regras", "🧩", ["rule"]),
    view("Projetos", "🛠️", ["project"]),
    view("Economia", "🎒", ["item", "resource"]),
    view("Narrativa", "🎬", ["scene", "theme", "foreshadowing"]),
    view("Criaturas", "🐾", ["creature"]),
    view("Transcrições", "📝", ["transcript"]),
    view("Mensagens", "✉️", ["message"]),
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
  fields?: Record<string, unknown>;
  visibility?: Visibility;
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
    fields: seed.fields ?? {},
    x: seed.x,
    y: seed.y,
    width: config.width,
    height: config.height,
    groupId: seed.groupKey ? groupIds.get(seed.groupKey) ?? null : null,
    visibility: seed.visibility ?? "gm_only",
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
    enabledModules: defaultEnabledModules(),
    favoriteEntityIds: [],
    favoriteViewIds: [],
    calendar: defaultCalendarConfig(),
    createdAt: now,
    updatedAt: now,
  };

  const groupSeeds: EntitySeed[] = [
    { key: "campus", kind: "group", title: "CAMPUS", x: -300, y: -300 },
    { key: "sessions", kind: "group", title: "SESSÕES", x: 2900, y: -300 },
    { key: "region", kind: "group", title: "REGIÃO", x: -300, y: 1300 },
    { key: "narrative", kind: "group", title: "NARRATIVA", x: -300, y: 2100 },
  ];
  const groupIds = new Map<string, string>();
  const groupSizes: Record<string, { width: number; height: number }> = {
    campus: { width: 2200, height: 1400 },
    sessions: { width: 1600, height: 1400 },
    region: { width: 1600, height: 700 },
    narrative: { width: 1600, height: 560 },
  };
  const groups = groupSeeds.map((seed) => {
    const entity = buildEntity(campaign.id, { ...seed, x: seed.x, y: seed.y }, groupIds, now);
    entity.width = groupSizes[seed.key].width;
    entity.height = groupSizes[seed.key].height;
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
    {
      key: "c_rune", kind: "clue", title: "Pista: runa quebrada", x: -180, y: 680, summary: "A mesma runa existe na entrada proibida.", groupKey: "campus",
      visibility: "partial",
    },
    {
      key: "r_dungeon", kind: "rumor", title: "\"A Dungeon está mudando\"", x: 160, y: 680, summary: "Circula entre os alunos do último ano.", groupKey: "campus",
      fields: { truth: "Verdadeiro", source: "Alunos do último ano", spreadNotes: "Comentado nos corredores depois das aulas.", templateId: null },
      visibility: "revealed",
    },
    { key: "e_alarm", kind: "event", title: "Alarme na Dungeon", x: 500, y: 680, summary: "Sinos tocam no meio da noite.", groupKey: "campus" },
    {
      key: "msg_warning", kind: "message", title: "Bilhete: \"Fiquem longe da runa\"", x: 900, y: 680, summary: "Vivian avisa Kaleb para não mexer na runa sozinho.", groupKey: "campus",
      fields: { medium: "Carta", deliveryStatus: "Entregue", content: "Kaleb, não toque na runa sozinho. Fale comigo antes.", sentDate: "Depois da Sessão 02" },
    },
    {
      key: "msg_intercepted", kind: "message", title: "Aviso da Ordem sobre a Dungeon", x: 1240, y: 680, summary: "Um aviso urgente da Ordem dos Selos nunca chegou ao destino.", groupKey: "campus",
      fields: { medium: "Mensageiro", deliveryStatus: "Interceptada", content: "A Dungeon está instável, redobrem a vigilância esta noite.", sentDate: "Na noite do alarme" },
    },
    { key: "sess_01", kind: "session", title: "Sessão 01 · A Primeira Aula", x: 3000, y: -180, summary: "Abertura da campanha.", groupKey: "sessions" },
    { key: "sess_02", kind: "session", title: "Sessão 02 · A Dungeon Desperta", x: 3400, y: -180, summary: "O alarme toca.", groupKey: "sessions" },
    { key: "region_vale", kind: "region", title: "Vale de Ashgrove", x: -180, y: 1420, summary: "A região ao redor da Academia, entre colinas e a floresta velha.", groupKey: "region" },
    {
      key: "city_ashgrove", kind: "city", title: "Vilarejo de Ashgrove", x: 160, y: 1420, summary: "Cresceu ao redor da Academia, vive do comércio com os alunos.", groupKey: "region",
      fields: {
        stage: "Vila", population: "~600", prosperity: 55, stability: 70,
        governance: "Conselho de anciãos", defenses: "Milícia local, muralha baixa",
        needs: ["mais grãos", "proteção contra a Dungeon"],
        log: [{ id: "seed_settlement_log_1", at: 0, note: "Fundado há três gerações, cresceu ao redor da Academia." }],
      },
    },
    {
      key: "proj_ala_leste", kind: "project", title: "Restaurar a Ala Leste", x: 500, y: 1420, summary: "Reabrir a ala interditada após o incidente do ano passado.", groupKey: "region",
      fields: {
        goal: "Reabrir a ala leste da Academia, interditada desde o incidente.",
        stages: [
          { id: "seed_stage_1", text: "Avaliar danos estruturais", done: true },
          { id: "seed_stage_2", text: "Convocar pedreiros", done: true },
          { id: "seed_stage_3", text: "Reconstruir o telhado", done: false },
          { id: "seed_stage_4", text: "Reencantar as wards", done: false },
        ],
        blockers: "Falta de recursos e mão de obra qualificada.",
        deadline: "Antes do inverno",
        notes: "",
      },
    },
    {
      key: "item_ring", kind: "item", title: "Anel do Vínculo", x: -180, y: 1700, summary: "Permite que duas pessoas sintam a direção uma da outra.", groupKey: "region",
      fields: { price: 120, currency: "po", rarity: "Raro", tradeNotes: "Vendido só por Vivian, sob consulta." },
    },
    {
      key: "res_racoes", kind: "resource", title: "Rações da Academia", x: 160, y: 1700, summary: "Estoque de comida usado em expedições à Dungeon.", groupKey: "region",
      fields: { stock: 40, unit: "porções", criticalThreshold: 15, regenNote: "Reabastece 20 a cada sessão de mercado", notes: "Consumidas durante expedições à Dungeon." },
    },
    {
      key: "creature_shadow", kind: "creature", title: "Sombra da Dungeon", x: -180, y: 2220, summary: "Uma silhueta que se move nas paredes, nunca vista por completo.", groupKey: "narrative",
      fields: { habitat: "Corredores da Dungeon, sempre longe da luz", diet: "Drena mana ambiente", behavior: "Evita confronto direto; observa e desaparece.", threatLevel: "Alta", groupSize: "Solitário" },
    },
    {
      key: "scene_crack_door", kind: "scene", title: "A Porta Rachada", x: 160, y: 2220, summary: "O momento em que o grupo encontra a entrada proibida pela primeira vez.", groupKey: "narrative",
      fields: {
        mood: "Tenso, curioso", readAloud: "A pedra está rachada ao meio, e pelo vão frio escapa um cheiro de terra molhada e algo mais antigo.",
        sensoryDetails: ["frio incomum", "silêncio absoluto", "cheiro de terra molhada"], complications: "A runa na porta reage se alguém tocar sem cuidado.", musicNote: "sino distante, uma nota só",
      },
    },
    {
      key: "theme_secrets", kind: "theme", title: "Segredos Enterrados", x: 500, y: 2220, summary: "O que a Academia escondeu não ficou enterrado — só quieto.", groupKey: "narrative",
      fields: { motifs: ["portas trancadas", "runas quebradas", "silêncio dos professores"], notes: "Reforçar sempre que um NPC souber mais do que conta." },
    },
    {
      key: "foreshadowing_ring", kind: "foreshadowing", title: "O Anel Pulsa Perto da Dungeon", x: -180, y: 2400, summary: "O Anel do Vínculo esquenta sempre que alguém se aproxima da entrada proibida.", groupKey: "narrative",
      fields: { status: "Reforçado", hint: "O anel esquenta e vibra perto da Dungeon, sem explicação ainda dada.", intendedPayoff: "O anel é feito do mesmo material das runas — foi forjado para reagir a elas.", log: [{ id: "seed_foreshadowing_log_1", at: 0, note: "Mencionado na Sessão 02, quando o grupo se aproximou da entrada." }] },
    },
    {
      key: "transcript_sess02", kind: "transcript", title: "Transcrição — Sessão 02", x: 160, y: 2400, summary: "Gravação da sessão em que o grupo se aproxima da entrada proibida.", groupKey: "narrative",
      fields: {
        sourceFormat: "srt",
        content: [
          "Mestre: Vocês chegam à porta rachada da Dungeon.",
          "Kaleb: Acho que essa runa não é normal.",
          "Vivian: Essa runa é antiga, mais antiga que a Academia.",
          "Potter: Fiquem longe da runa até sabermos mais.",
          "Kaleb: A Dungeon parece estar respirando.",
          "Vivian: Eu já vi essa runa antes, num livro proibido.",
        ].join("\n"),
      },
    },
  ];

  const entityIds = new Map<string, string>();
  const baseEntities = entitySeeds.map((seed) => {
    const entity = buildEntity(campaign.id, seed, groupIds, now);
    entityIds.set(seed.key, entity.id);
    return entity;
  });

  // Regra de exemplo (Rules Engine, Fase 3): totalmente determinística —
  // nenhuma IA decide isso, é só uma condição/ação que o próprio
  // CampaignStore avalia a cada mudança de status.
  const ruleFields = {
    enabled: true,
    trigger: { kind: "status_equals", entityId: entityIds.get("l_dungeon")!, value: "Instável" },
    action: { kind: "set_status", targetEntityId: entityIds.get("q_exercise")!, value: "Suspensa", relationType: "leads_to" },
    log: [],
  };
  const ruleEntity: Entity = {
    id: createId("entity"),
    campaignId: campaign.id,
    kind: "rule",
    title: "Dungeon instável suspende o exercício",
    summary: "Se a Dungeon ficar Instável, o Exercício Perigoso é suspenso automaticamente.",
    color: null,
    icon: null,
    imageSrc: null,
    tags: [],
    status: null,
    fields: ruleFields,
    x: 900,
    y: 420,
    width: kindConfig("rule").width,
    height: kindConfig("rule").height,
    groupId: groupIds.get("campus") ?? null,
    visibility: "gm_only",
    important: false,
    createdAt: now,
    updatedAt: now,
  };
  entityIds.set("rule_dungeon_unstable", ruleEntity.id);
  const entities = [...baseEntities, ruleEntity];

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
    { from: "q_exercise", to: "sq_grimorio", type: "leads_to" },
    { from: "n_vivian", to: "s_rune", type: "knows_about" },
    { from: "n_potter", to: "s_rune", type: "knows_about" },
    { from: "city_ashgrove", to: "region_vale", type: "belongs_to" },
    { from: "l_dungeon", to: "region_vale", type: "belongs_to" },
    { from: "proj_ala_leste", to: "res_racoes", type: "requires" },
    { from: "creature_shadow", to: "l_dungeon", type: "happens_at" },
    { from: "scene_crack_door", to: "l_dungeon", type: "happens_at" },
    { from: "foreshadowing_ring", to: "item_ring", type: "points_to" },
    { from: "foreshadowing_ring", to: "l_dungeon", type: "points_to" },
    { from: "transcript_sess02", to: "sess_02", type: "belongs_to" },
    { from: "msg_warning", to: "n_vivian", type: "originated_from" },
    { from: "msg_warning", to: "n_kaleb", type: "addressed_to" },
    { from: "msg_intercepted", to: "f_order", type: "originated_from" },
    { from: "msg_intercepted", to: "n_potter", type: "addressed_to" },
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
    fields: {},
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

/** Second example campaign, deliberately a different genre (sci-fi salvage
 * crew instead of magic academy) — same generic entity kinds/module system,
 * proving neither is fantasy-specific. Also seeded with a curated module
 * subset (no Encounter Ecology or Settlement Engine — a lone derelict
 * station isn't a wilderness or a growing city) instead of everything on,
 * to show the per-campaign toggle is a real starting choice, not just a
 * checkbox nobody touches. */
export function createSecondDemoCampaign(): CampaignData {
  const now = Date.now();
  const campaign: Campaign = {
    id: createId("campaign"),
    title: "Estação Kessler",
    description: "Uma tripulação de resgate/salvamento investiga uma estação espacial à deriva.",
    color: "#38bdf8",
    icon: "🛰️",
    enabledModules: defaultEnabledModules().filter((key) => key !== "ecology_engine" && key !== "settlement_engine"),
    favoriteEntityIds: [],
    favoriteViewIds: [],
    calendar: defaultCalendarConfig(),
    createdAt: now,
    updatedAt: now,
  };

  const groupSeeds: EntitySeed[] = [
    { key: "ship", kind: "group", title: "NAVE HORIZONTE", x: -300, y: -300 },
    { key: "station", kind: "group", title: "ESTAÇÃO KESSLER", x: 2100, y: -300 },
  ];
  const groupIds = new Map<string, string>();
  const groupSizes: Record<string, { width: number; height: number }> = {
    ship: { width: 1800, height: 1000 },
    station: { width: 1800, height: 1000 },
  };
  const groups = groupSeeds.map((seed) => {
    const entity = buildEntity(campaign.id, seed, groupIds, now);
    entity.width = groupSizes[seed.key].width;
    entity.height = groupSizes[seed.key].height;
    groupIds.set(seed.key, entity.id);
    return entity;
  });

  const entitySeeds: EntitySeed[] = [
    { key: "n_reyes", kind: "npc", title: "Capitã Reyes", x: -180, y: -180, summary: "Comanda a Horizonte há oito anos; não confia no Consórcio.", tags: ["capitã"], groupKey: "ship" },
    { key: "n_ibrahim", kind: "npc", title: "Doc Ibrahim", x: 160, y: -180, summary: "Engenheiro e médico de bordo, cético quanto ao sinal.", tags: ["engenheiro"], groupKey: "ship" },
    { key: "n_eco", kind: "npc", title: "ECO", x: 500, y: -180, summary: "IA da nave. Educada demais para ser inteiramente confiável.", important: true, groupKey: "ship" },
    { key: "f_halcyon", kind: "faction", title: "Consórcio Halcyon", x: -180, y: 100, summary: "Dona legal dos destroços — quer a estação intacta, a qualquer custo.", groupKey: "ship" },
    { key: "q_signal", kind: "quest", title: "Investigar o Sinal", x: 160, y: 100, summary: "Um sinal de socorro sai da Estação Kessler há três dias.", status: "Ativa", important: true, groupKey: "ship" },
    { key: "res_oxygen", kind: "resource", title: "Oxigênio (Horizonte)", x: 500, y: 100, summary: "Reserva da nave; cai rápido em EVA prolongada.", groupKey: "ship", fields: { stock: 68, unit: "%", criticalThreshold: 20, regenNote: "Recicladores restauram 5%/dia em operação normal.", notes: "Cair abaixo de 20% cancela EVAs." } },
    { key: "msg_distress", kind: "message", title: "Sinal de socorro da Kessler", x: -180, y: 380, summary: "Transmissão em loop, sem resposta a chamadas.", groupKey: "ship", fields: { medium: "Outro", deliveryStatus: "Entregue", content: "...kessler chamando... alguém... o núcleo não...", sentDate: "3 dias antes da chegada da Horizonte" } },
    { key: "e_breach", kind: "event", title: "Brecha no casco", x: 160, y: 380, summary: "Alarme dispara no convés de carga da Horizonte.", groupKey: "ship" },
    {
      key: "l_kessler", kind: "location", title: "Estação Kessler", x: 2200, y: -180, summary: "À deriva há seis meses; luzes de emergência ainda ativas.", important: true, groupKey: "station",
    },
    { key: "l_cargo", kind: "location", title: "Convés de Carga (Kessler)", x: 2560, y: -180, summary: "Contêineres selados, um deles amassado por dentro.", groupKey: "station" },
    { key: "item_core", kind: "item", title: "Núcleo de Dados Recuperado", x: 2200, y: 100, summary: "Criptografado; o Consórcio pagaria bem por ele intacto.", groupKey: "station", fields: { price: 4000, currency: "créditos", rarity: "Raro", tradeNotes: "O Consórcio não sabe que já foi recuperado." } },
    { key: "s_core", kind: "secret", title: "O que o núcleo realmente registrou", x: 2560, y: 100, summary: "Só ECO sabe — e não contou tudo à Capitã Reyes.", groupKey: "station" },
    { key: "r_signal", kind: "rumor", title: "\"O sinal não é da tripulação da Kessler\"", x: 2200, y: 380, summary: "Comentado nos canais abertos da rota comercial.", groupKey: "station", fields: { truth: "Verdadeiro", source: "Tripulações de outras naves na rota", spreadNotes: "Ninguém leva a sério até a Horizonte chegar perto.", templateId: null }, visibility: "revealed" },
  ];

  const entityIds = new Map<string, string>();
  const baseEntities = entitySeeds.map((seed) => {
    const entity = buildEntity(campaign.id, seed, groupIds, now);
    entityIds.set(seed.key, entity.id);
    return entity;
  });

  // Regra de exemplo: oxigênio crítico marca a IA como importante (chamando
  // atenção do mestre), mesma disciplina determinística das outras regras.
  const ruleFields = {
    enabled: true,
    trigger: { kind: "status_equals", entityId: entityIds.get("res_oxygen")!, value: "Crítico" },
    action: { kind: "mark_important", targetEntityId: entityIds.get("n_eco")!, value: "" },
    log: [],
  };
  const ruleEntity: Entity = {
    id: createId("entity"),
    campaignId: campaign.id,
    kind: "rule",
    title: "Oxigênio crítico chama atenção para ECO",
    summary: "Se o oxigênio da Horizonte ficar Crítico, ECO é marcada como importante automaticamente.",
    color: null,
    icon: null,
    imageSrc: null,
    tags: [],
    status: null,
    fields: ruleFields,
    x: -180,
    y: 660,
    width: kindConfig("rule").width,
    height: kindConfig("rule").height,
    groupId: groupIds.get("ship") ?? null,
    visibility: "gm_only",
    important: false,
    createdAt: now,
    updatedAt: now,
  };
  entityIds.set("rule_oxygen_critical", ruleEntity.id);
  const entities = [...baseEntities, ruleEntity];

  const relationSeeds: Array<{ from: string; to: string; type: RelationType; label?: string }> = [
    { from: "n_reyes", to: "n_ibrahim", type: "trusts" },
    { from: "n_reyes", to: "f_halcyon", type: "fears" },
    { from: "n_ibrahim", to: "f_halcyon", type: "member_of" },
    { from: "q_signal", to: "l_kessler", type: "happens_at" },
    { from: "e_breach", to: "res_oxygen", type: "leads_to" },
    { from: "n_eco", to: "s_core", type: "knows_about" },
    { from: "item_core", to: "s_core", type: "reveals" },
    { from: "item_core", to: "l_cargo", type: "originated_from" },
    { from: "r_signal", to: "l_kessler", type: "originated_from" },
    { from: "msg_distress", to: "n_eco", type: "originated_from" },
    { from: "msg_distress", to: "n_reyes", type: "addressed_to" },
    { from: "q_signal", to: "item_core", type: "leads_to" },
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
    fields: {},
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
