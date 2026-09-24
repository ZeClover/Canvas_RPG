import { describe, expect, it, vi } from "vitest";
import { createDemoWorkspace } from "../data/seed";
import { BUILT_IN_TEMPLATES } from "../data/templateLibrary";
import { WorkspaceStore } from "./workspaceStore";

vi.mock("../data/repository", () => ({ saveWorkspace: vi.fn().mockResolvedValue(undefined) }));

describe("WorkspaceStore", () => {
  it("cria, desfaz e refaz um nó", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const initial = store.getSnapshot().nodes.length;
    store.createNode({ x: 12, y: 34 });
    expect(store.getSnapshot().nodes).toHaveLength(initial + 1);
    store.undo();
    expect(store.getSnapshot().nodes).toHaveLength(initial);
    store.redo();
    expect(store.getSnapshot().nodes).toHaveLength(initial + 1);
  });

  it("conecta dois nós selecionados", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const [a, b] = store.getSnapshot().nodes;
    const initial = store.getSnapshot().connections.length;
    store.selectNode(a.id);
    store.selectNode(b.id, true);
    store.connectSelected();
    expect(store.getSnapshot().connections.length).toBeGreaterThanOrEqual(initial);
  });

  it("move uma seleção inteira em uma única operação reversível", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const [a, b] = store.getSnapshot().nodes;
    const origin = new Map([[a.id, { x: a.x, y: a.y }], [b.id, { x: b.x, y: b.y }]]);
    store.selectNodes([a.id, b.id]);
    store.moveNodes([
      { id: a.id, x: a.x + 80, y: a.y - 40 },
      { id: b.id, x: b.x + 80, y: b.y - 40 },
    ]);
    expect(store.getSnapshot().nodes.find((node) => node.id === a.id)?.x).toBe(a.x + 80);
    expect(store.getSnapshot().nodes.find((node) => node.id === b.id)?.y).toBe(b.y - 40);
    store.undo();
    expect(store.getSnapshot().nodes.find((node) => node.id === a.id)?.x).toBe(origin.get(a.id)?.x);
    expect(store.getSnapshot().nodes.find((node) => node.id === b.id)?.y).toBe(origin.get(b.id)?.y);
  });

  it("move uma região junto com regiões filhas e seus nós", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const parent = store.createRegion({ x: 10_000, y: 10_000 });
    const child = store.createRegion({ x: 10_120, y: 10_140 });
    const node = store.createNode({ x: 10_180, y: 10_200 }, child.id);
    store.moveRegion(parent.id, { x: parent.x + 300, y: parent.y + 160 });
    const state = store.getSnapshot();
    expect(state.regions.find((region) => region.id === child.id)?.x).toBe(child.x + 300);
    expect(state.nodes.find((candidate) => candidate.id === node.id)?.y).toBe(node.y + 160);
  });

  it("cria uma conexão arrastada sem duplicar a mesma direção", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const first = store.createNode({ x: 12_000, y: 12_000 }, null);
    const second = store.createNode({ x: 12_400, y: 12_000 }, null);
    const initial = store.getSnapshot().connections.length;
    store.createConnection(first.id, second.id);
    store.createConnection(first.id, second.id);
    expect(store.getSnapshot().connections).toHaveLength(initial + 1);
  });

  it("limita o redimensionamento direto de nós e regiões", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const node = store.createNode({ x: 14_000, y: 14_000 }, null);
    const region = store.createRegion({ x: 16_000, y: 16_000 });
    store.resizeNode(node.id, { x: node.x, y: node.y, width: 20, height: 20 });
    store.resizeRegion(region.id, { x: region.x, y: region.y, width: 20, height: 20 });
    expect(store.getSnapshot().nodes.find((candidate) => candidate.id === node.id)).toMatchObject({ width: 140, height: 76 });
    expect(store.getSnapshot().regions.find((candidate) => candidate.id === region.id)).toMatchObject({ width: 360, height: 260 });
  });

  it("edita e inverte uma conexão", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const connection = store.getSnapshot().connections[0];
    store.updateConnection(connection.id, { label: "novo caminho", relation: "condition" });
    store.reverseConnection(connection.id);
    expect(store.getSnapshot().connections.find((item) => item.id === connection.id)).toMatchObject({
      label: "novo caminho",
      relation: "condition",
      fromNodeId: connection.toNodeId,
      toNodeId: connection.fromNodeId,
    });
  });

  it("seleciona e remove uma conexão sem apagar caixas", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const connection = store.getSnapshot().connections[0];
    const nodeCount = store.getSnapshot().nodes.length;
    store.selectConnection(connection.id);
    store.deleteSelected();
    expect(store.getSnapshot().connections.some((item) => item.id === connection.id)).toBe(false);
    expect(store.getSnapshot().nodes).toHaveLength(nodeCount);
  });

  it("reinicia somente o progresso da sessão escolhida", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const session = store.getSnapshot().regions.find((region) => region.kind === "session")!;
    const node = store.getSnapshot().nodes.find((candidate) => candidate.regionId === session.id)!;
    store.advanceSession(node.id);
    store.resetSession(session.id);
    expect(store.getSnapshot().sessionProgress[node.id]).toBeUndefined();
  });

  it("cria uma sessão completa a partir de template em uma única operação", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const before = store.getSnapshot();
    const template = BUILT_IN_TEMPLATES.find((item) => item.id === "builtin-session")!;
    store.createFromTemplate(template, { x: 20_000, y: 20_000 });
    const after = store.getSnapshot();
    expect(after.regions).toHaveLength(before.regions.length + 1);
    expect(after.nodes).toHaveLength(before.nodes.length + 3);
    expect(after.connections).toHaveLength(before.connections.length + 2);
    store.undo();
    expect(store.getSnapshot().nodes).toHaveLength(before.nodes.length);
  });

  it("edita etiquetas e tipo de várias caixas em uma operação", () => {
    const store = new WorkspaceStore(createDemoWorkspace());
    const [first, second] = store.getSnapshot().nodes;
    store.selectNodes([first.id, second.id]);
    store.updateSelectedNodes({ tags: ["boss", "final"], kind: "combat" });
    const changed = store.getSnapshot().nodes.filter((node) => node.id === first.id || node.id === second.id);
    expect(changed.every((node) => node.kind === "combat" && node.tags.join(",") === "boss,final")).toBe(true);
    store.undo();
    expect(store.getSnapshot().nodes.find((node) => node.id === first.id)?.kind).toBe(first.kind);
  });
});
