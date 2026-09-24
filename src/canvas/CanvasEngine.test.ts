import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../test/canvasTestEnv";
import { setHostSize, triggerResize } from "../test/canvasTestEnv";
import { createDemoWorkspace } from "../data/seed";
import type { WorkspaceState } from "../state/workspaceStore";
import { CanvasEngine, type CanvasEngineCallbacks } from "./CanvasEngine";

function makeState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  const workspace = createDemoWorkspace();
  return {
    ...workspace,
    selectedNodeIds: [],
    selectedRegionId: null,
    selectedConnectionId: null,
    dirty: false,
    saving: false,
    lastSavedAt: null,
    ...overrides,
  };
}

function makeCallbacks(): CanvasEngineCallbacks {
  return {
    onCameraChange: vi.fn(),
    onCreateNode: vi.fn(),
    onSelectNode: vi.fn(),
    onSelectNodes: vi.fn(),
    onSelectRegion: vi.fn(),
    onSelectConnection: vi.fn(),
    onContextMenu: vi.fn(),
    onClearSelection: vi.fn(),
    onMoveNodes: vi.fn(),
    onResizeNode: vi.fn(),
    onMoveRegion: vi.fn(),
    onResizeRegion: vi.fn(),
    onCreateConnection: vi.fn(),
    onEditNode: vi.fn(),
    onSessionAdvance: vi.fn(),
  };
}

function firePointer(
  target: EventTarget,
  type: string,
  init: { x: number; y: number; button?: number; shiftKey?: boolean; pointerId?: number },
): void {
  const event = new MouseEvent(type, {
    clientX: init.x,
    clientY: init.y,
    button: init.button ?? 0,
    shiftKey: init.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "pointerId", { value: init.pointerId ?? 1 });
  target.dispatchEvent(event);
}

async function createEngine(state: WorkspaceState) {
  const host = document.createElement("div");
  setHostSize(host, 1200, 800);
  document.body.appendChild(host);
  const callbacks = makeCallbacks();
  const engine = new CanvasEngine(host, callbacks);
  await engine.init();
  engine.setState(state);
  const canvas = host.querySelector("canvas") as HTMLCanvasElement;
  return { host, engine, callbacks, canvas };
}

describe("CanvasEngine", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("nunca aplica fitAll enquanto o host tem tamanho 0x0 ou 1x1", async () => {
    const host = document.createElement("div");
    setHostSize(host, 0, 0);
    document.body.appendChild(host);
    const callbacks = makeCallbacks();
    const engine = new CanvasEngine(host, callbacks);
    await engine.init();
    engine.setState(makeState());

    engine.fitAll();
    const camera = engine.getCamera();
    expect(camera.viewportWidth).toBe(1);
    expect(camera.viewportHeight).toBe(1);
    expect(Number.isFinite(camera.scale)).toBe(true);
  });

  it("aplica fitAll assim que o ResizeObserver reporta um tamanho real", async () => {
    const host = document.createElement("div");
    setHostSize(host, 1, 1);
    document.body.appendChild(host);
    const callbacks = makeCallbacks();
    const engine = new CanvasEngine(host, callbacks);
    await engine.init();
    engine.setState(makeState());

    setHostSize(host, 1400, 900);
    triggerResize(host);

    const camera = engine.getCamera();
    expect(camera.viewportWidth).toBe(1400);
    expect(camera.viewportHeight).toBe(900);
    expect(Number.isFinite(camera.x)).toBe(true);
    expect(Number.isFinite(camera.y)).toBe(true);
    expect(Number.isFinite(camera.scale)).toBe(true);
  });

  it("redimensionar a janela atualiza o viewport sem resetar a posição da câmera", async () => {
    const state = makeState();
    const { engine, host } = await createEngine(state);
    engine.centerOn({ x: 500, y: 500 });
    const before = engine.getCamera();

    setHostSize(host, 1600, 1000);
    triggerResize(host);

    const after = engine.getCamera();
    expect(after.viewportWidth).toBe(1600);
    expect(after.viewportHeight).toBe(1000);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
  });

  it("arrastar uma caixa reporta a nova posição via onMoveNodes", async () => {
    const state = makeState();
    const node = state.nodes[0];
    const { engine, canvas, callbacks } = await createEngine(state);

    const start = engine.worldToScreen({ x: node.x + node.width / 2, y: node.y + node.height / 2 });
    firePointer(canvas, "pointerdown", { x: start.x, y: start.y });
    expect(callbacks.onSelectNode).toHaveBeenCalledWith(node.id, false);

    // The engine reads selection synchronously off the state passed to it,
    // mirroring how WorkspaceStore.subscribe -> engine.setState happens
    // synchronously inside the same call stack in the real app.
    engine.setState({ ...state, selectedNodeIds: [node.id] });

    firePointer(canvas, "pointerdown", { x: start.x, y: start.y });
    const moved = engine.worldToScreen({ x: node.x + node.width / 2 + 120, y: node.y + node.height / 2 + 60 });
    firePointer(canvas, "pointermove", { x: moved.x, y: moved.y });
    firePointer(window, "pointerup", { x: moved.x, y: moved.y });

    expect(callbacks.onMoveNodes).toHaveBeenCalledWith([{ id: node.id, x: node.x + 120, y: node.y + 60 }]);
  });

  it("mover uma seleção múltipla move todas as caixas selecionadas juntas", async () => {
    const state = makeState();
    const [a, b] = state.nodes;
    const selectedState = { ...state, selectedNodeIds: [a.id, b.id] };
    const { engine, canvas, callbacks } = await createEngine(selectedState);

    const start = engine.worldToScreen({ x: a.x + a.width / 2, y: a.y + a.height / 2 });
    firePointer(canvas, "pointerdown", { x: start.x, y: start.y });
    const moved = engine.worldToScreen({ x: a.x + a.width / 2 + 50, y: a.y + a.height / 2 + 20 });
    firePointer(canvas, "pointermove", { x: moved.x, y: moved.y });
    firePointer(window, "pointerup", { x: moved.x, y: moved.y });

    expect(callbacks.onMoveNodes).toHaveBeenCalledWith(
      expect.arrayContaining([
        { id: a.id, x: a.x + 50, y: a.y + 20 },
        { id: b.id, x: b.x + 50, y: b.y + 20 },
      ]),
    );
  });

  it("redimensiona uma caixa selecionada arrastando a alça", async () => {
    const state = makeState();
    const node = state.nodes[0];
    const selectedState = { ...state, selectedNodeIds: [node.id] };
    const { engine, canvas, callbacks } = await createEngine(selectedState);

    const handle = engine.worldToScreen({ x: node.x + node.width, y: node.y + node.height });
    firePointer(canvas, "pointerdown", { x: handle.x, y: handle.y });
    const dragged = engine.worldToScreen({ x: node.x + node.width + 80, y: node.y + node.height + 40 });
    firePointer(canvas, "pointermove", { x: dragged.x, y: dragged.y });
    firePointer(window, "pointerup", { x: dragged.x, y: dragged.y });

    expect(callbacks.onResizeNode).toHaveBeenCalledWith(node.id, {
      x: node.x,
      y: node.y,
      width: node.width + 80,
      height: node.height + 40,
    });
  });

  it("cria uma seleção múltipla arrastando uma caixa de seleção no fundo", async () => {
    const state = makeState();
    const { engine, canvas, callbacks } = await createEngine(state);

    const bounds = state.regions[1];
    const start = engine.worldToScreen({ x: bounds.x + 40, y: bounds.y + 200 });
    const end = engine.worldToScreen({ x: bounds.x + bounds.width - 40, y: bounds.y + bounds.height - 40 });
    firePointer(canvas, "pointerdown", { x: start.x, y: start.y });
    firePointer(canvas, "pointermove", { x: end.x, y: end.y });
    firePointer(window, "pointerup", { x: end.x, y: end.y });

    expect(callbacks.onClearSelection).toHaveBeenCalled();
    expect(callbacks.onSelectNodes).toHaveBeenCalled();
  });

  it("arrasta da alça de saída de um nó selecionado até outro nó para criar uma conexão", async () => {
    const state = makeState();
    const [from, to] = state.nodes;
    const selectedState = { ...state, selectedNodeIds: [from.id] };
    const { engine, canvas, callbacks } = await createEngine(selectedState);

    const port = engine.worldToScreen({ x: from.x + from.width, y: from.y + from.height / 2 });
    firePointer(canvas, "pointerdown", { x: port.x, y: port.y });
    const target = engine.worldToScreen({ x: to.x + to.width / 2, y: to.y + to.height / 2 });
    firePointer(canvas, "pointermove", { x: target.x, y: target.y });
    firePointer(window, "pointerup", { x: target.x, y: target.y });

    expect(callbacks.onCreateConnection).toHaveBeenCalledWith(from.id, to.id);
  });

  it("clicar perto de uma conexão existente a seleciona", async () => {
    const state = makeState();
    const connection = state.connections[0];
    const from = state.nodes.find((node) => node.id === connection.fromNodeId)!;
    const to = state.nodes.find((node) => node.id === connection.toNodeId)!;
    const { engine, canvas, callbacks } = await createEngine(state);

    const midpoint = engine.worldToScreen({
      x: (from.x + from.width + to.x) / 2,
      y: (from.y + from.height / 2 + to.y + to.height / 2) / 2,
    });
    firePointer(canvas, "pointerdown", { x: midpoint.x, y: midpoint.y });

    expect(callbacks.onSelectConnection).toHaveBeenCalledWith(connection.id);
  });

  it("zoom com a roda do mouse mantém o ponto do mundo sob o cursor", async () => {
    const state = makeState();
    const { engine, canvas, callbacks } = await createEngine(state);

    const cursor = { x: 400, y: 300 };
    const worldBefore = engine.screenToWorld(cursor);
    const scaleBefore = engine.getCamera().scale;

    const event = new WheelEvent("wheel", { clientX: cursor.x, clientY: cursor.y, deltaY: -200, bubbles: true, cancelable: true });
    canvas.dispatchEvent(event);

    const worldAfter = engine.screenToWorld(cursor);
    expect(engine.getCamera().scale).not.toBe(scaleBefore);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 5);
    expect(callbacks.onCameraChange).toHaveBeenCalled();
  });

  it("pan com o botão do meio move a câmera sem alterar a escala", async () => {
    const state = makeState();
    const { engine, canvas } = await createEngine(state);
    const scaleBefore = engine.getCamera().scale;

    firePointer(canvas, "pointerdown", { x: 300, y: 300, button: 1 });
    firePointer(canvas, "pointermove", { x: 380, y: 250 });
    firePointer(window, "pointerup", { x: 380, y: 250 });

    const after = engine.getCamera();
    expect(after.scale).toBe(scaleBefore);
    expect(after.x).not.toBe(0);
  });

  it("uma caixa permanece clicável mesmo em zoom bem distante (overview)", async () => {
    const state = makeState();
    const node = state.nodes[0];
    const { engine, canvas, callbacks } = await createEngine(state);

    for (let i = 0; i < 12; i += 1) {
      canvas.dispatchEvent(new WheelEvent("wheel", { clientX: 600, clientY: 400, deltaY: 400, bubbles: true, cancelable: true }));
    }
    expect(engine.getCamera().scale).toBeLessThan(0.12);

    const screen = engine.worldToScreen({ x: node.x + node.width / 2, y: node.y + node.height / 2 });
    firePointer(canvas, "pointerdown", { x: screen.x, y: screen.y });
    expect(callbacks.onSelectNode).toHaveBeenCalledWith(node.id, false);
  });

  it("Escape cancela um rascunho de conexão em andamento sem criá-la", async () => {
    const state = makeState();
    const [from, to] = state.nodes;
    const selectedState = { ...state, selectedNodeIds: [from.id] };
    const { engine, canvas, callbacks } = await createEngine(selectedState);

    const port = engine.worldToScreen({ x: from.x + from.width, y: from.y + from.height / 2 });
    firePointer(canvas, "pointerdown", { x: port.x, y: port.y });
    const target = engine.worldToScreen({ x: to.x + to.width / 2, y: to.y + to.height / 2 });
    firePointer(canvas, "pointermove", { x: target.x, y: target.y });

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));
    firePointer(window, "pointerup", { x: target.x, y: target.y });

    expect(callbacks.onCreateConnection).not.toHaveBeenCalled();
  });
});

describe("CanvasEngine destroy", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("remove o canvas do host ao destruir", async () => {
    const host = document.createElement("div");
    setHostSize(host, 800, 600);
    document.body.appendChild(host);
    const engine = new CanvasEngine(host, makeCallbacks());
    await engine.init();
    expect(host.querySelector("canvas")).not.toBeNull();
    engine.destroy();
    expect(host.querySelector("canvas")).toBeNull();
  });
});
