import type { CanvasConnection, CanvasNode, CanvasRegion, Project, WorkspaceData } from "../domain/types";

const now = Date.now();

export const demoProjects: Project[] = [
  {
    id: "project_academia",
    title: "Academia Mágica",
    description: "Aulas, professores, alunos e a Dungeon",
    color: "#a78bfa",
    updatedAt: now,
  },
  {
    id: "project_darkrem",
    title: "Darkrem",
    description: "Famílias, deuses, continentes e eras",
    color: "#34d399",
    updatedAt: now - 86_400_000,
  },
  {
    id: "project_monster",
    title: "Monster Hunter",
    description: "Base perdida e a caçada ao Tarrasque",
    color: "#fb923c",
    updatedAt: now - 172_800_000,
  },
];

const node = (
  id: string,
  title: string,
  x: number,
  y: number,
  kind: CanvasNode["kind"],
  regionId: string,
  body = "",
  color = "#20283a",
  width = 240,
  height = 126,
): CanvasNode => ({
  id,
  projectId: "project_academia",
  regionId,
  sourceNodeId: null,
  title,
  body,
  instanceNotes: "",
  kind,
  x,
  y,
  width,
  height,
  color,
  imageSrc: null,
  tags: [],
  important: kind === "decision" || kind === "combat",
  createdAt: now,
  updatedAt: now,
});

const regions: CanvasRegion[] = [
  {
    id: "region_sessoes",
    projectId: "project_academia",
    parentRegionId: null,
    title: "SESSÕES",
    kind: "collection",
    x: -200,
    y: -240,
    width: 2760,
    height: 1860,
    color: "#7767e9",
    minDetailScale: 0.06,
  },
  {
    id: "session_01",
    projectId: "project_academia",
    parentRegionId: "region_sessoes",
    title: "SESSÃO 01 · A PRIMEIRA AULA",
    kind: "session",
    x: 60,
    y: 40,
    width: 2200,
    height: 1320,
    color: "#a78bfa",
    minDetailScale: 0.11,
  },
  {
    id: "region_lore",
    projectId: "project_academia",
    parentRegionId: null,
    title: "LORE E PERSONAGENS",
    kind: "collection",
    x: 2800,
    y: -240,
    width: 1540,
    height: 1000,
    color: "#38bdf8",
    minDetailScale: 0.06,
  },
];

const nodes: CanvasNode[] = [
  node("n_intro", "Chegada à escola", 210, 240, "scene", "session_01", "Os portões se abrem pela primeira vez.", "#253047"),
  node("n_class", "Sala de aula", 560, 240, "place", "session_01", "Apresentar o lugar antes dos alunos.", "#24364a"),
  node("n_students", "Apresentar os alunos", 910, 240, "scene", "session_01", "Todos dizem nome, poder e expectativa.", "#253047"),
  node("n_teacher", "Aula de um professor aleatório", 1260, 240, "event", "session_01", "Sortear ou escolher um professor.", "#31284b"),
  node("n_choice", "O professor propõe um exercício perigoso", 1610, 240, "decision", "session_01", "Os jogadores podem aceitar, recusar ou inventar outro caminho.", "#4a2f3f", 270, 142),
  node("n_accept", "Aceitar o exercício", 1510, 540, "condition", "session_01", "A turma entra no campo de treinamento.", "#23453e"),
  node("n_refuse", "Recusar e investigar", 1880, 540, "condition", "session_01", "O professor fica desconfiado.", "#473a28"),
  node("n_combat", "Criatura foge do selo", 1450, 850, "combat", "session_01", "Combate curto; algo está errado com a Dungeon.", "#532f3b", 290, 150),
  node("n_clue", "Pista: runa quebrada", 1840, 850, "clue", "session_01", "A mesma runa existe na entrada proibida.", "#263f52"),
  node("n_end", "Fim da primeira noite", 1660, 1140, "transition", "session_01", "Os caminhos se reencontram no dormitório.", "#26334a", 300, 120),
  node("l_potter", "Potter Magwood", 3000, 40, "npc", "region_lore", "Professor marcado por um trauma com magia exagerada.", "#25425a", 300, 160),
  node("l_dungeon", "A Dungeon", 3380, 40, "place", "region_lore", "Abre todas as noites, mas parece estar mudando.", "#2c3157", 300, 160),
  node("l_rune", "Runas de contenção", 3760, 40, "lore", "region_lore", "Protegem a escola de algo abaixo dela.", "#3b3054", 300, 160),
  {
    ...node("ref_potter", "Potter Magwood", 1180, 540, "npc", "session_01", "", "#25425a", 240, 126),
    sourceNodeId: "l_potter",
    instanceNotes: "Nesta cena, Potter evita falar sobre a Dungeon.",
  },
];

const edge = (
  id: string,
  fromNodeId: string,
  toNodeId: string,
  label = "",
  relation: CanvasConnection["relation"] = "flow",
): CanvasConnection => ({
  id,
  projectId: "project_academia",
  fromNodeId,
  toNodeId,
  label,
  relation,
  color: relation === "reference" ? "#38bdf8" : "#8290ad",
});

const connections: CanvasConnection[] = [
  edge("e1", "n_intro", "n_class"),
  edge("e2", "n_class", "n_students"),
  edge("e3", "n_students", "n_teacher"),
  edge("e4", "n_teacher", "n_choice"),
  edge("e5", "n_choice", "n_accept", "aceitam"),
  edge("e6", "n_choice", "n_refuse", "recusam"),
  edge("e7", "n_accept", "n_combat"),
  edge("e8", "n_refuse", "n_clue"),
  edge("e9", "n_combat", "n_end"),
  edge("e10", "n_clue", "n_end"),
  edge("e11", "ref_potter", "l_potter", "referência", "reference"),
];

export function createDemoWorkspace(project = demoProjects[0]): WorkspaceData {
  if (project.id !== "project_academia") {
    return {
      project,
      nodes: [],
      regions: [],
      connections: [],
      sessionProgress: {},
    };
  }
  return { project, nodes, regions, connections, sessionProgress: {} };
}
