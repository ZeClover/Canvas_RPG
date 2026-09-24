import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../test/canvasTestEnv";
import { setHostSize, triggerResize } from "../test/canvasTestEnv";
import { createDemoCampaign } from "../data/seed";
import { CanvasEngine, type CanvasEngineCallbacks, type CanvasRenderState } from "./CanvasEngine";

function makeState(overrides: Partial<CanvasRenderState> = {}): CanvasRenderState {
  const data = createDemoCampaign();
  return { entities: data.entities, relations: data.relations, selectedEntityIds: [], selectedRelationId: null, ...overrides };
}

function makeCallbacks(): CanvasEngineCallbacks {
  return {
    onCameraChange: vi.fn(),
    onCreateEntity: vi.fn(),
    onSelectEntity: vi.fn(),
    onSelectEntities: vi.fn(),
    onSelectRelation: vi.fn(),
    onContextMenu: vi.fn(),
    onClearSelection: vi.fn(),
    onMoveEntities: vi.fn(),
    onResizeEntity: vi.fn(),
    onMoveGroup: vi.fn(),
    onCreateRelation: vi.fn(),
    onEditEntity: vi.fn(),
    onDuplicateEntitiesInPlace: vi.fn().mockReturnValue([]),
  };
}

function firePointer(
  target: EventTarget,
  type: string,
  init: { x: number; y: number; button?: number; shiftKey?: boolean; altKey?: boolean; pointerId?: number },
): void {
  const event = new MouseEvent(type, {
    clientX: init.x, clientY: init.y, button: init.button ?? 0, shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false, bubbles: true, cancelable: true,
  });
  Object.defineProperty(event, "pointerId", { value: init.pointerId ?? 1 });
  target.dispatchEvent(event);
}

async function createEngine(state: CanvasRenderState) {
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

  it("nunca aplica fitAll enquanto o host tem tamanho 0x0", async () => {
    const host = document.createElement("div");
    setHostSize(host, 0, 0);
    document.body.appendChild(host);
    const engine = new CanvasEngine(host, makeCallbacks());
    await engine.init();
    engine.setState(makeState());
    engine.fitAll();
    const camera = engine.getCamera();
    expect(camera.viewportWidth).toBe(1);
    expect(Number.isFinite(camera.scale)).toBe(true);
  });

  it("aplica fitAll assim que o ResizeObserver reporta um tamanho real", async () => {
    const host = document.createElement("div");
    setHostSize(host, 1, 1);
    document.body.appendChild(host);
    const engine = new CanvasEngine(host, makeCallbacks());
    await engine.init();
    engine.setState(makeState());
    setHostSize(host, 1400, 900);
    triggerResize(host);
    const camera = engine.getCamera();
    expect(camera.viewportWidth).toBe(1400);
    expect(Number.isFinite(camera.x)).toBe(true);
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
    expect(after.x).toBeCloseTo(before.x, 5);
  });

  it("arrastar um elemento (isolado) reporta a nova posição via onMoveEntities", async () => {
    const base = makeState();
    const npc = base.entities.find((entity) => entity.kind !== "group")!;
    const state = { ...base, entities: [npc] };
    const { engine, canvas, callbacks } = await createEngine(state);

    const start = engine.worldToScreen({ x: npc.x + npc.width / 2, y: npc.y + npc.height / 2 });
    firePointer(canvas, "pointerdown", { x: start.x, y: start.y });
    expect(callbacks.onSelectEntity).toHaveBeenCalledWith(npc.id, false);

    engine.setState({ ...state, selectedEntityIds: [npc.id] });
    firePointer(canvas, "pointerdown", { x: start.x, y: start.y });
    const moved = engine.worldToScreen({ x: npc.x + npc.width / 2 + 120, y: npc.y + npc.height / 2 + 60 });
    firePointer(canvas, "pointermove", { x: moved.x, y: moved.y });
    firePointer(window, "pointerup", { x: moved.x, y: moved.y });

    expect(callbacks.onMoveEntities).toHaveBeenCalledWith([{ id: npc.id, x: npc.x + 120, y: npc.y + 60 }]);
  });

  it("redimensiona um elemento selecionado arrastando a alça", async () => {
    const base = makeState();
    const npc = base.entities.find((entity) => entity.kind !== "group")!;
    const state = { ...base, entities: [npc], selectedEntityIds: [npc.id] };
    const { engine, canvas, callbacks } = await createEngine(state);

    const handle = engine.worldToScreen({ x: npc.x + npc.width, y: npc.y + npc.height });
    firePointer(canvas, "pointerdown", { x: handle.x, y: handle.y });
    const dragged = engine.worldToScreen({ x: npc.x + npc.width + 80, y: npc.y + npc.height + 40 });
    firePointer(canvas, "pointermove", { x: dragged.x, y: dragged.y });
    firePointer(window, "pointerup", { x: dragged.x, y: dragged.y });

    expect(callbacks.onResizeEntity).toHaveBeenCalledWith(npc.id, { x: npc.x, y: npc.y, width: npc.width + 80, height: npc.height + 40 });
  });

  it("cria uma seleção múltipla arrastando uma caixa de seleção no fundo", async () => {
    const state = makeState();
    const group = state.entities.find((entity) => entity.kind === "group")!;
    const { engine, canvas, callbacks } = await createEngine(state);

    const start = engine.worldToScreen({ x: group.x + 20, y: group.y + 200 });
    const end = engine.worldToScreen({ x: group.x + group.width - 20, y: group.y + group.height - 20 });
    firePointer(canvas, "pointerdown", { x: start.x, y: start.y });
    firePointer(canvas, "pointermove", { x: end.x, y: end.y });
    firePointer(window, "pointerup", { x: end.x, y: end.y });

    expect(callbacks.onClearSelection).toHaveBeenCalled();
    expect(callbacks.onSelectEntities).toHaveBeenCalled();
  });

  it("arrasta da alça de saída até outro elemento para criar uma relação", async () => {
    const base = makeState();
    const [from, to] = base.entities.filter((entity) => entity.kind !== "group");
    const state = { ...base, selectedEntityIds: [from.id] };
    const { engine, canvas, callbacks } = await createEngine(state);

    const port = engine.worldToScreen({ x: from.x + from.width, y: from.y + from.height / 2 });
    firePointer(canvas, "pointerdown", { x: port.x, y: port.y });
    const target = engine.worldToScreen({ x: to.x + to.width / 2, y: to.y + to.height / 2 });
    firePointer(canvas, "pointermove", { x: target.x, y: target.y });
    firePointer(window, "pointerup", { x: target.x, y: target.y });

    expect(callbacks.onCreateRelation).toHaveBeenCalledWith(from.id, to.id);
  });

  it("clicar em um elemento de um grupo seleciona e arrasta esse grupo com seus filhos", async () => {
    const base = makeState();
    const group = base.entities.find((entity) => entity.kind === "group")!;
    const npc = base.entities.find((entity) => entity.groupId === group.id)!;
    const { engine, canvas, callbacks } = await createEngine(base);

    const header = engine.worldToScreen({ x: group.x + 40, y: group.y + 20 });
    firePointer(canvas, "pointerdown", { x: header.x, y: header.y });
    expect(callbacks.onSelectEntity).toHaveBeenCalledWith(group.id, false);

    const moved = engine.worldToScreen({ x: group.x + 40 + 100, y: group.y + 20 + 60 });
    firePointer(canvas, "pointermove", { x: moved.x, y: moved.y });
    firePointer(window, "pointerup", { x: moved.x, y: moved.y });

    expect(callbacks.onMoveGroup).toHaveBeenCalledWith(group.id, { x: group.x + 100, y: group.y + 60 });
    void npc;
  });

  it("Alt+arrastar duplica o elemento em vez de movê-lo", async () => {
    const base = makeState();
    const npc = base.entities.find((entity) => entity.kind !== "group")!;
    const state = { ...base, entities: [npc] };
    const { engine, canvas, callbacks } = await createEngine(state);
    const duplicated = { id: "entity_copy", x: npc.x, y: npc.y };
    (callbacks.onDuplicateEntitiesInPlace as ReturnType<typeof vi.fn>).mockReturnValue([duplicated]);

    const start = engine.worldToScreen({ x: npc.x + npc.width / 2, y: npc.y + npc.height / 2 });
    firePointer(canvas, "pointerdown", { x: start.x, y: start.y, altKey: true });
    expect(callbacks.onDuplicateEntitiesInPlace).toHaveBeenCalledWith([npc.id]);

    const moved = engine.worldToScreen({ x: npc.x + npc.width / 2 + 90, y: npc.y + npc.height / 2 + 40 });
    firePointer(canvas, "pointermove", { x: moved.x, y: moved.y });
    firePointer(window, "pointerup", { x: moved.x, y: moved.y });

    expect(callbacks.onMoveEntities).toHaveBeenCalledWith([{ id: "entity_copy", x: npc.x + 90, y: npc.y + 40 }]);
    expect(callbacks.onSelectEntity).not.toHaveBeenCalled();
  });

  it("zoom com a roda do mouse mantém o ponto do mundo sob o cursor", async () => {
    const state = makeState();
    const { engine, canvas, callbacks } = await createEngine(state);
    const cursor = { x: 400, y: 300 };
    const worldBefore = engine.screenToWorld(cursor);
    const scaleBefore = engine.getCamera().scale;
    canvas.dispatchEvent(new WheelEvent("wheel", { clientX: cursor.x, clientY: cursor.y, deltaY: -200, bubbles: true, cancelable: true }));
    const worldAfter = engine.screenToWorld(cursor);
    expect(engine.getCamera().scale).not.toBe(scaleBefore);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5);
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

  it("Escape cancela um rascunho de relação em andamento sem criá-la", async () => {
    const base = makeState();
    const [from, to] = base.entities.filter((entity) => entity.kind !== "group");
    const state = { ...base, selectedEntityIds: [from.id] };
    const { engine, canvas, callbacks } = await createEngine(state);
    const port = engine.worldToScreen({ x: from.x + from.width, y: from.y + from.height / 2 });
    firePointer(canvas, "pointerdown", { x: port.x, y: port.y });
    const target = engine.worldToScreen({ x: to.x + to.width / 2, y: to.y + to.height / 2 });
    firePointer(canvas, "pointermove", { x: target.x, y: target.y });
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));
    firePointer(window, "pointerup", { x: target.x, y: target.y });
    expect(callbacks.onCreateRelation).not.toHaveBeenCalled();
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
