import { describe, expect, it, vi } from "vitest";
import { createDemoCampaign } from "../data/seed";
import { CampaignStore } from "./campaignStore";

vi.mock("../data/repository", () => ({ saveCampaignDiff: vi.fn().mockResolvedValue(undefined) }));

describe("CampaignStore", () => {
  it("cria, desfaz e refaz um elemento", () => {
    const store = new CampaignStore(createDemoCampaign());
    const initial = store.getSnapshot().entities.length;
    store.createEntity("npc", { x: 12, y: 34 });
    expect(store.getSnapshot().entities).toHaveLength(initial + 1);
    store.undo();
    expect(store.getSnapshot().entities).toHaveLength(initial);
    store.redo();
    expect(store.getSnapshot().entities).toHaveLength(initial + 1);
  });

  it("move uma seleção inteira em uma única operação reversível", () => {
    const store = new CampaignStore(createDemoCampaign());
    const [a, b] = store.getSnapshot().entities.filter((entity) => entity.kind !== "group");
    const origin = new Map([[a.id, { x: a.x, y: a.y }], [b.id, { x: b.x, y: b.y }]]);
    store.selectEntities([a.id, b.id]);
    store.moveEntities([{ id: a.id, x: a.x + 80, y: a.y - 40 }, { id: b.id, x: b.x + 80, y: b.y - 40 }]);
    expect(store.getSnapshot().entities.find((e) => e.id === a.id)?.x).toBe(a.x + 80);
    store.undo();
    expect(store.getSnapshot().entities.find((e) => e.id === a.id)?.x).toBe(origin.get(a.id)?.x);
  });

  it("move um grupo junto com seus descendentes e elementos filhos", () => {
    const store = new CampaignStore(createDemoCampaign());
    const parent = store.createEntity("group", { x: 10_000, y: 10_000 });
    const child = store.createEntity("group", { x: 10_120, y: 10_140 }, { groupId: parent.id });
    const entity = store.createEntity("npc", { x: 10_180, y: 10_200 }, { groupId: child.id });
    store.moveGroup(parent.id, { x: parent.x + 300, y: parent.y + 160 });
    const state = store.getSnapshot();
    expect(state.entities.find((e) => e.id === child.id)?.x).toBe(child.x + 300);
    expect(state.entities.find((e) => e.id === entity.id)?.y).toBe(entity.y + 160);
  });

  it("cria uma relação sem duplicar o mesmo tipo/direção", () => {
    const store = new CampaignStore(createDemoCampaign());
    const first = store.createEntity("npc", { x: 12_000, y: 12_000 });
    const second = store.createEntity("npc", { x: 12_400, y: 12_000 });
    const initial = store.getSnapshot().relations.length;
    store.createRelation(first.id, second.id, "knows");
    store.createRelation(first.id, second.id, "knows");
    expect(store.getSnapshot().relations).toHaveLength(initial + 1);
  });

  it("excluir um grupo reconecta seus filhos ao grupo pai, sem apagá-los", () => {
    const store = new CampaignStore(createDemoCampaign());
    const parent = store.createEntity("group", { x: 20_000, y: 20_000 });
    const child = store.createEntity("group", { x: 20_100, y: 20_100 }, { groupId: parent.id });
    const npc = store.createEntity("npc", { x: 20_150, y: 20_150 }, { groupId: child.id });
    store.selectEntity(child.id);
    store.deleteSelected();
    const state = store.getSnapshot();
    expect(state.entities.some((e) => e.id === child.id)).toBe(false);
    expect(state.entities.find((e) => e.id === npc.id)?.groupId).toBe(parent.id);
  });

  it("excluir um elemento também remove as relações que o tocam", () => {
    const store = new CampaignStore(createDemoCampaign());
    const first = store.createEntity("npc", { x: 13_000, y: 13_000 });
    const second = store.createEntity("npc", { x: 13_400, y: 13_000 });
    const relation = store.createRelation(first.id, second.id, "knows")!;
    store.selectEntity(first.id);
    store.deleteSelected();
    expect(store.getSnapshot().relations.some((r) => r.id === relation.id)).toBe(false);
  });

  it("duplica elementos no lugar preservando um novo groupId compartilhado", () => {
    const store = new CampaignStore(createDemoCampaign());
    const [a, b] = store.getSnapshot().entities.filter((entity) => entity.kind !== "group").slice(0, 2);
    const copies = store.duplicateEntitiesInPlace([a.id, b.id]);
    expect(copies).toHaveLength(2);
    expect(copies[0].x).toBe(a.x);
    expect(copies[0].groupId).toBe(copies[1].groupId);
    expect(copies[0].groupId).not.toBeNull();
  });

  it("altera a view ativa", () => {
    const store = new CampaignStore(createDemoCampaign());
    const npcView = store.getSnapshot().views.find((view) => view.title === "NPCs")!;
    store.setActiveView(npcView.id);
    expect(store.getSnapshot().activeViewId).toBe(npcView.id);
  });

  it("Rules Engine: a regra semeada dispara sozinha quando a entidade observada atinge o status do gatilho", () => {
    const store = new CampaignStore(createDemoCampaign());
    const dungeon = store.getSnapshot().entities.find((entity) => entity.title === "A Dungeon")!;
    const quest = store.getSnapshot().entities.find((entity) => entity.title === "O Exercício Perigoso")!;
    expect(quest.status).toBe("Ativa");

    store.updateEntity(dungeon.id, { status: "Instável" });

    const after = store.getSnapshot();
    expect(after.entities.find((entity) => entity.id === quest.id)?.status).toBe("Suspensa");
    const rule = after.entities.find((entity) => entity.kind === "rule")!;
    expect((rule.fields as { log: unknown[] }).log).toHaveLength(1);
  });

  it("Rules Engine: não dispara de novo enquanto o status observado permanece o mesmo", () => {
    const store = new CampaignStore(createDemoCampaign());
    const dungeon = store.getSnapshot().entities.find((entity) => entity.title === "A Dungeon")!;
    store.updateEntity(dungeon.id, { status: "Instável" });

    const quest = store.getSnapshot().entities.find((entity) => entity.title === "O Exercício Perigoso")!;
    store.updateEntity(quest.id, { status: "Ativa" }); // o mestre reverte manualmente
    store.updateEntity(dungeon.id, { summary: "Atualizado" }); // status da dungeon continua "Instável"

    expect(store.getSnapshot().entities.find((entity) => entity.id === quest.id)?.status).toBe("Ativa");
  });

  it("Módulos: desligar rules_engine para a avaliação das regras, sem apagar a regra", () => {
    const store = new CampaignStore(createDemoCampaign());
    const ruleId = store.getSnapshot().entities.find((entity) => entity.kind === "rule")!.id;
    store.setEnabledModules(store.getSnapshot().campaign.enabledModules.filter((key) => key !== "rules_engine"));

    const dungeon = store.getSnapshot().entities.find((entity) => entity.title === "A Dungeon")!;
    const quest = store.getSnapshot().entities.find((entity) => entity.title === "O Exercício Perigoso")!;
    store.updateEntity(dungeon.id, { status: "Instável" });

    expect(store.getSnapshot().entities.find((entity) => entity.id === quest.id)?.status).toBe("Ativa");
    expect(store.getSnapshot().entities.some((entity) => entity.id === ruleId)).toBe(true);

    // religar o módulo não recupera o disparo perdido (não é retroativo),
    // mas a próxima transição volta a funcionar normalmente
    store.setEnabledModules([...store.getSnapshot().campaign.enabledModules, "rules_engine"]);
    store.updateEntity(dungeon.id, { status: "Estável" });
    store.updateEntity(dungeon.id, { status: "Instável" });
    expect(store.getSnapshot().entities.find((entity) => entity.id === quest.id)?.status).toBe("Suspensa");
  });

  it("Módulos: setEnabledModules persiste na campanha e não entra no histórico de undo", () => {
    const store = new CampaignStore(createDemoCampaign());
    const before = store.getSnapshot().entities.length;
    store.setEnabledModules(["npc_brain"]);
    expect(store.getSnapshot().campaign.enabledModules).toEqual(["npc_brain"]);
    store.undo(); // não deve afetar o toggle de módulos, que não passa por commit()
    expect(store.getSnapshot().campaign.enabledModules).toEqual(["npc_brain"]);
    expect(store.getSnapshot().entities.length).toBe(before);
  });
});
