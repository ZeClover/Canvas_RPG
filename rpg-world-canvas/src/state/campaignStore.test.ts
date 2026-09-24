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
});
