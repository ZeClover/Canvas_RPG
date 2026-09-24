import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Sprite,
  Text,
} from "pixi.js";
import { cameraForBounds, cameraWorldBounds, clampScale, collectBounds, intersects, semanticLod } from "../domain/spatial";
import { SpatialIndex } from "../domain/SpatialIndex";
import { applyNodeRenderBudget } from "../domain/renderBudget";
import type {
  CameraState,
  CanvasConnection,
  CanvasNode,
  CanvasRegion,
  ProgressState,
  WorldBounds,
  WorldPoint,
} from "../domain/types";
import type { WorkspaceState } from "../state/workspaceStore";

export interface CanvasEngineCallbacks {
  onCameraChange: (camera: CameraState) => void;
  onCreateNode: (point: WorldPoint, screen: WorldPoint) => void;
  onSelectNode: (id: string, additive: boolean) => void;
  onSelectNodes: (ids: string[], additive: boolean) => void;
  onSelectRegion: (id: string) => void;
  onSelectConnection: (id: string) => void;
  onContextMenu: (target: CanvasContextTarget) => void;
  onClearSelection: () => void;
  onMoveNodes: (moves: Array<{ id: string; x: number; y: number }>) => void;
  onResizeNode: (id: string, bounds: WorldBounds) => void;
  onMoveRegion: (id: string, point: WorldPoint) => void;
  onResizeRegion: (id: string, bounds: WorldBounds) => void;
  onCreateConnection: (fromId: string, toId: string) => void;
  onEditNode: (id: string, screenBounds: WorldBounds) => void;
  onSessionAdvance: (id: string) => void;
}

export interface CanvasContextTarget {
  kind: "canvas" | "node" | "region";
  id: string | null;
  world: WorldPoint;
  screen: WorldPoint;
}

interface DragState {
  pointerStart: WorldPoint;
  positions: Map<string, WorldPoint>;
  dx: number;
  dy: number;
}

interface ResizeState {
  id: string;
  pointerStart: WorldPoint;
  bounds: WorldBounds;
  width: number;
  height: number;
}

interface RegionDragState extends DragState {
  id: string;
  regionIds: Set<string>;
  nodePositions: Map<string, WorldPoint>;
}

interface SelectionState {
  start: WorldPoint;
  end: WorldPoint;
  additive: boolean;
}

interface ConnectionDraft {
  fromId: string;
  start: WorldPoint;
  end: WorldPoint;
}

const TYPE_COLORS: Record<CanvasNode["kind"], number> = {
  free: 0x8290ad,
  scene: 0xa78bfa,
  speech: 0xf0abfc,
  npc: 0x38bdf8,
  event: 0xc084fc,
  decision: 0xfb7185,
  condition: 0xfbbf24,
  combat: 0xf43f5e,
  clue: 0x22d3ee,
  improv: 0xf97316,
  lore: 0x818cf8,
  place: 0x2dd4bf,
  item: 0xfacc15,
  creature: 0xef4444,
  faction: 0x60a5fa,
  transition: 0x94a3b8,
};

export class CanvasEngine {
  private app = new Application();
  private host: HTMLElement;
  private nativeCanvas = document.createElement("canvas");
  private nativeContext: CanvasRenderingContext2D | null = null;
  private callbacks: CanvasEngineCallbacks;
  private world = new Container();
  private gridLayer = new Graphics();
  private regionLayer = new Container();
  private edgeLayer = new Container();
  private nodeLayer = new Container();
  private interactionLayer = new Container();
  private state: WorkspaceState | null = null;
  private camera: CameraState = { x: 0, y: 0, scale: 0.75, viewportWidth: 1, viewportHeight: 1 };
  private isPanning = false;
  private panOrigin = { x: 0, y: 0, cameraX: 0, cameraY: 0 };
  private drag: DragState | null = null;
  private resize: ResizeState | null = null;
  private regionDrag: RegionDragState | null = null;
  private regionResize: ResizeState | null = null;
  private selection: SelectionState | null = null;
  private connectionDraft: ConnectionDraft | null = null;
  private destroyed = false;
  private sessionMode = false;
  private activeSessionId: string | null = null;
  private lastCullBounds: WorldBounds | null = null;
  private lastLod = "";
  private resizeObserver: ResizeObserver | null = null;
  private spacePressed = false;
  private initialized = false;
  private nodeIndex = new SpatialIndex<CanvasNode>();
  private nodeById = new Map<string, CanvasNode>();
  private edgesByNodeId = new Map<string, CanvasConnection[]>();
  private initialFitDone = false;
  private cameraAnimationId = 0;

  constructor(host: HTMLElement, callbacks: CanvasEngineCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
  }

  async init(): Promise<void> {
    const initialWidth = Math.max(1, this.host.clientWidth);
    const initialHeight = Math.max(1, this.host.clientHeight);
    await this.app.init({
      width: initialWidth,
      height: initialHeight,
      antialias: true,
      backgroundAlpha: 0,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      // Canvas 2D is more reliable inside Windows WebView2 than forcing WebGL.
      // The render budget still keeps large workspaces responsive.
      preference: "canvas",
    });
    this.initialized = true;
    if (this.destroyed) {
      this.app.destroy(true, { children: true });
      return;
    }

    this.nativeCanvas.className = "native-canvas";
    this.nativeContext = this.nativeCanvas.getContext("2d");
    this.app.canvas.className = "pixi-canvas";
    this.host.append(this.nativeCanvas, this.app.canvas);
    this.resizeNativeCanvas(initialWidth, initialHeight);
    this.world.addChild(this.gridLayer, this.regionLayer, this.edgeLayer, this.nodeLayer, this.interactionLayer);
    this.app.stage.addChild(this.world);
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = new Rectangle(0, 0, this.host.clientWidth, this.host.clientHeight);

    this.camera.viewportWidth = initialWidth;
    this.camera.viewportHeight = initialHeight;
    this.updateCameraTransform();
    this.attachEvents();

    this.resizeObserver = new ResizeObserver(() => {
      const width = Math.max(1, this.host.clientWidth);
      const height = Math.max(1, this.host.clientHeight);
      this.app.renderer.resize(width, height);
      this.resizeNativeCanvas(width, height);
      this.camera = {
        ...this.camera,
        viewportWidth: width,
        viewportHeight: height,
      };
      this.app.stage.hitArea = new Rectangle(0, 0, width, height);
      if (!this.initialFitDone && this.state && width >= 100 && height >= 100) {
        this.fitAll();
        return;
      }
      this.drawScene(true);
      this.app.render();
      this.callbacks.onCameraChange(this.getCamera());
    });
    this.resizeObserver.observe(this.host);
  }

  private attachEvents(): void {
    this.app.stage.on("pointerdown", this.onStagePointerDown);
    this.app.stage.on("pointermove", this.onStagePointerMove);
    this.app.stage.on("pointerup", this.onStagePointerUp);
    this.app.stage.on("pointerupoutside", this.onStagePointerUp);
    this.app.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.app.canvas.addEventListener("dblclick", this.onDoubleClick);
    this.app.canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space" && !this.isTypingTarget(event.target)) {
      this.spacePressed = true;
      this.app.canvas.classList.add("is-pannable");
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      this.spacePressed = false;
      this.app.canvas.classList.remove("is-pannable");
    }
  };

  private isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }

  private onStagePointerDown = (event: FederatedPointerEvent): void => {
    if (event.target !== this.app.stage && !this.spacePressed) return;
    if (this.spacePressed || event.button === 1) {
      this.isPanning = true;
      this.panOrigin = {
        x: event.global.x,
        y: event.global.y,
        cameraX: this.camera.x,
        cameraY: this.camera.y,
      };
      this.app.canvas.classList.add("is-panning");
      return;
    }
    const point = this.screenToWorld(event.global);
    this.selection = { start: point, end: point, additive: Boolean(event.shiftKey) };
    if (!event.shiftKey) this.callbacks.onClearSelection();
    this.drawInteraction();
  };

  private onStagePointerMove = (event: FederatedPointerEvent): void => {
    const worldPoint = this.screenToWorld(event.global);
    if (this.connectionDraft) {
      this.connectionDraft.end = worldPoint;
      this.drawInteraction();
      return;
    }
    if (this.resize) {
      this.resize.width = Math.max(140, Math.min(900, this.resize.bounds.width + worldPoint.x - this.resize.pointerStart.x));
      this.resize.height = Math.max(76, Math.min(700, this.resize.bounds.height + worldPoint.y - this.resize.pointerStart.y));
      this.previewResize(this.nodeLayer, this.resize.id, this.resize.bounds, this.resize.width, this.resize.height);
      return;
    }
    if (this.regionResize) {
      this.regionResize.width = Math.max(360, Math.min(6000, this.regionResize.bounds.width + worldPoint.x - this.regionResize.pointerStart.x));
      this.regionResize.height = Math.max(260, Math.min(5000, this.regionResize.bounds.height + worldPoint.y - this.regionResize.pointerStart.y));
      this.previewResize(this.regionLayer, `region:${this.regionResize.id}`, this.regionResize.bounds, this.regionResize.width, this.regionResize.height);
      return;
    }
    if (this.drag) {
      this.drag.dx = worldPoint.x - this.drag.pointerStart.x;
      this.drag.dy = worldPoint.y - this.drag.pointerStart.y;
      for (const [id, position] of this.drag.positions) {
        const display = this.nodeLayer.children.find((child) => child.label === id);
        display?.position.set(position.x + this.drag.dx, position.y + this.drag.dy);
      }
      return;
    }
    if (this.regionDrag) {
      this.regionDrag.dx = worldPoint.x - this.regionDrag.pointerStart.x;
      this.regionDrag.dy = worldPoint.y - this.regionDrag.pointerStart.y;
      for (const [id, position] of this.regionDrag.positions) {
        const display = this.regionLayer.children.find((child) => child.label === `region:${id}`);
        display?.position.set(position.x + this.regionDrag.dx, position.y + this.regionDrag.dy);
      }
      for (const [id, position] of this.regionDrag.nodePositions) {
        const display = this.nodeLayer.children.find((child) => child.label === id);
        display?.position.set(position.x + this.regionDrag.dx, position.y + this.regionDrag.dy);
      }
      return;
    }
    if (this.selection) {
      this.selection.end = worldPoint;
      this.drawInteraction();
      return;
    }
    if (!this.isPanning) return;
    this.camera.x = this.panOrigin.cameraX + event.global.x - this.panOrigin.x;
    this.camera.y = this.panOrigin.cameraY + event.global.y - this.panOrigin.y;
    this.updateCameraTransform();
    this.refreshVisibilityIfNeeded();
    this.callbacks.onCameraChange(this.getCamera());
  };

  private onStagePointerUp = (): void => {
    if (this.connectionDraft) {
      const draft = this.connectionDraft;
      const target = this.hitNode(draft.end);
      this.connectionDraft = null;
      this.drawInteraction();
      if (target && target.id !== draft.fromId) this.callbacks.onCreateConnection(draft.fromId, target.id);
    }
    if (this.resize) {
      const { id, bounds, width, height } = this.resize;
      this.resize = null;
      if (width !== bounds.width || height !== bounds.height) {
        this.callbacks.onResizeNode(id, { ...bounds, width, height });
      }
    }
    if (this.regionResize) {
      const { id, bounds, width, height } = this.regionResize;
      this.regionResize = null;
      if (width !== bounds.width || height !== bounds.height) {
        this.callbacks.onResizeRegion(id, { ...bounds, width, height });
      }
    }
    if (this.drag) {
      const { positions, dx, dy } = this.drag;
      this.drag = null;
      if (dx !== 0 || dy !== 0) {
        this.callbacks.onMoveNodes([...positions].map(([id, position]) => ({
          id,
          x: position.x + dx,
          y: position.y + dy,
        })));
      }
    }
    if (this.regionDrag) {
      const { id, positions, dx, dy } = this.regionDrag;
      this.regionDrag = null;
      const position = positions.get(id);
      if (position && (dx !== 0 || dy !== 0)) {
        this.callbacks.onMoveRegion(id, { x: position.x + dx, y: position.y + dy });
      }
    }
    if (this.selection) {
      const selection = this.selection;
      this.selection = null;
      const bounds = this.normalizedBounds(selection.start, selection.end);
      if (bounds.width > 4 / this.camera.scale || bounds.height > 4 / this.camera.scale) {
        const ids = this.nodeIndex.search(bounds).map((node) => node.id);
        this.callbacks.onSelectNodes(ids, selection.additive);
      }
      this.drawInteraction();
    }
    this.isPanning = false;
    this.app.canvas.classList.remove("is-panning");
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const before = this.screenToWorld(cursor);
    const factor = Math.exp(-event.deltaY * 0.0012);
    const nextScale = clampScale(this.camera.scale * factor);
    this.camera.scale = nextScale;
    this.camera.x = cursor.x - before.x * nextScale;
    this.camera.y = cursor.y - before.y * nextScale;
    this.updateCameraTransform();
    if (semanticLod(nextScale) !== this.lastLod) this.drawScene(true);
    else {
      this.drawGrid();
      this.refreshVisibilityIfNeeded();
    }
    this.callbacks.onCameraChange(this.getCamera());
  };

  private onDoubleClick = (event: MouseEvent): void => {
    const rect = this.app.canvas.getBoundingClientRect();
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const point = this.screenToWorld(screen);
    const hit = this.hitNode(point);
    if (hit) {
      this.callbacks.onEditNode(hit.id, this.nodeScreenBounds(hit));
      return;
    }
    this.callbacks.onCreateNode({ x: point.x - 120, y: point.y - 40 }, screen);
  };

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    const rect = this.app.canvas.getBoundingClientRect();
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const world = this.screenToWorld(screen);
    const node = this.hitNode(world);
    if (node) {
      this.callbacks.onSelectNode(node.id, false);
      this.callbacks.onContextMenu({ kind: "node", id: node.id, world, screen });
      return;
    }
    const region = this.hitRegion(world);
    if (region) {
      this.callbacks.onSelectRegion(region.id);
      this.callbacks.onContextMenu({ kind: "region", id: region.id, world, screen });
      return;
    }
    this.callbacks.onClearSelection();
    this.callbacks.onContextMenu({ kind: "canvas", id: null, world, screen });
  };

  private hitNode(point: WorldPoint): CanvasNode | null {
    if (!this.state) return null;
    for (let index = this.state.nodes.length - 1; index >= 0; index -= 1) {
      const node = this.state.nodes[index];
      if (
        point.x >= node.x &&
        point.x <= node.x + node.width &&
        point.y >= node.y &&
        point.y <= node.y + node.height
      ) return node;
    }
    return null;
  }

  private hitRegion(point: WorldPoint): CanvasRegion | null {
    return this.state?.regions
      .filter((region) => point.x >= region.x && point.x <= region.x + region.width && point.y >= region.y && point.y <= region.y + region.height)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
  }

  private nodeScreenBounds(node: CanvasNode): WorldBounds {
    const point = this.worldToScreen({ x: node.x, y: node.y });
    return {
      x: point.x,
      y: point.y,
      width: node.width * this.camera.scale,
      height: node.height * this.camera.scale,
    };
  }

  setState(state: WorkspaceState): void {
    const nodesChanged = state.nodes !== this.state?.nodes;
    const edgesChanged = state.connections !== this.state?.connections;
    this.state = state;
    if (nodesChanged) {
      this.nodeIndex.rebuild(state.nodes);
      this.nodeById = new Map(state.nodes.map((node) => [node.id, node]));
    }
    if (edgesChanged) {
      this.edgesByNodeId.clear();
      for (const edge of state.connections) {
        this.edgesByNodeId.set(edge.fromNodeId, [...(this.edgesByNodeId.get(edge.fromNodeId) ?? []), edge]);
        this.edgesByNodeId.set(edge.toNodeId, [...(this.edgesByNodeId.get(edge.toNodeId) ?? []), edge]);
      }
    }
    this.drawScene(true);
  }

  setSessionMode(active: boolean, sessionId: string | null = null): void {
    this.sessionMode = active;
    this.activeSessionId = sessionId;
    this.drawScene(true);
  }

  private updateCameraTransform(): void {
    this.world.position.set(this.camera.x, this.camera.y);
    this.world.scale.set(this.camera.scale);
    if (this.initialized) this.drawNativeScene();
  }

  private refreshVisibilityIfNeeded(): void {
    const next = cameraWorldBounds(this.camera, 300);
    if (!this.lastCullBounds) {
      this.drawScene(true);
      return;
    }
    const insetX = this.lastCullBounds.width * 0.18;
    const insetY = this.lastCullBounds.height * 0.18;
    const safe = {
      x: this.lastCullBounds.x + insetX,
      y: this.lastCullBounds.y + insetY,
      width: this.lastCullBounds.width - insetX * 2,
      height: this.lastCullBounds.height - insetY * 2,
    };
    const viewportExpanded = next.width > this.lastCullBounds.width * 1.35 || next.height > this.lastCullBounds.height * 1.35;
    if (viewportExpanded || !intersects(safe, { x: next.x + next.width / 2, y: next.y + next.height / 2, width: 1, height: 1 })) {
      this.drawScene(true);
    }
  }

  private drawScene(force = false): void {
    if (!this.state || !this.app.renderer) return;
    this.drawNativeScene();
    const lod = semanticLod(this.camera.scale);
    if (!force && lod === this.lastLod) {
      this.drawGrid();
      return;
    }
    this.lastLod = lod;
    const viewport = cameraWorldBounds(this.camera, 420);
    this.lastCullBounds = viewport;
    this.drawGrid();
    this.regionLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.edgeLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.nodeLayer.removeChildren().forEach((child) => child.destroy({ children: true }));

    const visibleRegions = this.state.regions.filter((region) => intersects(viewport, region));
    // Every node must remain visible at every zoom level. LOD changes detail,
    // never whether the user's content exists on screen.
    const candidates = this.nodeIndex.search(viewport);
    const visibleNodes = applyNodeRenderBudget(candidates, {
      x: viewport.x + viewport.width / 2,
      y: viewport.y + viewport.height / 2,
    });
    const visibleIds = new Set(visibleNodes.map((node) => node.id));

    for (const region of visibleRegions) this.drawRegion(region, lod);
    if (lod !== "overview") {
      const visibleEdges = new Map<string, CanvasConnection>();
      for (const nodeId of visibleIds) {
        for (const edge of this.edgesByNodeId.get(nodeId) ?? []) visibleEdges.set(edge.id, edge);
      }
      for (const edge of visibleEdges.values()) this.drawEdge(edge, lod);
    }
    for (const node of visibleNodes) this.drawNode(node, lod);
    this.app.render();
  }

  private resizeNativeCanvas(width: number, height: number): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.nativeCanvas.width = Math.max(1, Math.round(width * ratio));
    this.nativeCanvas.height = Math.max(1, Math.round(height * ratio));
    this.nativeCanvas.style.width = `${width}px`;
    this.nativeCanvas.style.height = `${height}px`;
  }

  /**
   * WebView2 can create a working Pixi interaction surface while failing to
   * paint its accelerated scene. This native 2D layer is the dependable visual
   * renderer; the transparent Pixi canvas above it keeps the existing input
   * and hit-testing behavior intact.
   */
  private drawNativeScene(): void {
    const ctx = this.nativeContext;
    if (!ctx || !this.state) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = this.camera.viewportWidth;
    const height = this.camera.viewportHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.nativeCanvas.width, this.nativeCanvas.height);
    ctx.setTransform(
      ratio * this.camera.scale,
      0,
      0,
      ratio * this.camera.scale,
      ratio * this.camera.x,
      ratio * this.camera.y,
    );

    const viewport = cameraWorldBounds(this.camera, 420);
    const lod = semanticLod(this.camera.scale);
    const minor = this.camera.scale < 0.16 ? 400 : this.camera.scale < 0.5 ? 160 : 80;
    const startX = Math.floor(viewport.x / minor) * minor;
    const startY = Math.floor(viewport.y / minor) * minor;
    ctx.beginPath();
    for (let x = startX; x <= viewport.x + viewport.width; x += minor) {
      ctx.moveTo(x, viewport.y);
      ctx.lineTo(x, viewport.y + viewport.height);
    }
    for (let y = startY; y <= viewport.y + viewport.height; y += minor) {
      ctx.moveTo(viewport.x, y);
      ctx.lineTo(viewport.x + viewport.width, y);
    }
    ctx.strokeStyle = "rgba(83, 96, 120, .13)";
    ctx.lineWidth = 1 / this.camera.scale;
    ctx.stroke();

    for (const region of this.state.regions.filter((item) => intersects(viewport, item))) {
      ctx.save();
      ctx.globalAlpha = region.kind === "session" ? 0.08 : 0.055;
      ctx.fillStyle = region.color;
      ctx.beginPath();
      ctx.roundRect(region.x, region.y, region.width, region.height, 24);
      ctx.fill();
      ctx.globalAlpha = this.state.selectedRegionId === region.id ? 0.95 : 0.58;
      ctx.strokeStyle = this.state.selectedRegionId === region.id ? "#ffffff" : region.color;
      ctx.lineWidth = (this.state.selectedRegionId === region.id ? 5 : 3) / this.camera.scale;
      ctx.stroke();
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = region.color;
      ctx.font = `700 ${lod === "overview" ? Math.max(56, 22 / this.camera.scale) : 28}px Inter, system-ui, sans-serif`;
      ctx.fillText(region.title, region.x + 22, region.y + 46);
      ctx.restore();
    }

    const candidates = this.nodeIndex.search(viewport);
    const visibleNodes = applyNodeRenderBudget(candidates, {
      x: viewport.x + viewport.width / 2,
      y: viewport.y + viewport.height / 2,
    });
    const visibleIds = new Set(visibleNodes.map((node) => node.id));

    if (lod !== "overview") {
      const edges = new Map<string, CanvasConnection>();
      for (const id of visibleIds) {
        for (const edge of this.edgesByNodeId.get(id) ?? []) edges.set(edge.id, edge);
      }
      for (const edge of edges.values()) {
        const from = this.nodeById.get(edge.fromNodeId);
        const to = this.nodeById.get(edge.toNodeId);
        if (!from || !to) continue;
        const x1 = from.x + from.width;
        const y1 = from.y + from.height / 2;
        const x2 = to.x;
        const y2 = to.y + to.height / 2;
        const control = Math.max(60, Math.abs(x2 - x1) * 0.42);
        const direction = Math.sign(x2 - x1 || 1);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1 + direction * control, y1, x2 - direction * control, y2, x2, y2);
        ctx.strokeStyle = edge.color;
        ctx.globalAlpha = this.state.selectedConnectionId === edge.id ? 1 : 0.72;
        ctx.lineWidth = (this.state.selectedConnectionId === edge.id ? 5 : 3) / this.camera.scale;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    for (const source of visibleNodes) {
      const node = this.resolvedNode(source);
      const selected = this.state.selectedNodeIds.includes(node.id);
      const progress = this.state.sessionProgress[node.id] ?? "pending";
      const accentNumber = progress === "completed" ? 0x34d399 : progress === "active" ? 0xfbbf24 : TYPE_COLORS[node.kind];
      const accent = `#${accentNumber.toString(16).padStart(6, "0")}`;
      const active = !this.sessionMode || this.nodeIsInActiveSession(node);
      ctx.save();
      ctx.globalAlpha = active ? 1 : 0.12;
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, node.width, node.height, 15);
      ctx.fill();
      ctx.strokeStyle = selected ? "#ffffff" : accent;
      ctx.lineWidth = selected ? 4 : 2;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(node.x, node.y, 7, node.height, 4);
      ctx.fill();
      ctx.fillStyle = "#f7f8ff";
      ctx.font = `600 ${lod === "region" ? 22 : 19}px Inter, system-ui, sans-serif`;
      this.fillWrappedText(ctx, node.title || "Sem título", node.x + 22, node.y + 39, node.width - 42, 24, 2);
      if (lod === "detail" && node.body) {
        ctx.fillStyle = "#aeb8ce";
        ctx.font = "13px Inter, system-ui, sans-serif";
        this.fillWrappedText(ctx, node.body, node.x + 22, node.y + 76, node.width - 42, 18, 3);
      }
      ctx.restore();
    }

    // Prevent unused-variable regressions when the viewport is initially tiny.
    void width;
    void height;
  }

  private fillWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
  ): void {
    const words = text.split(/\s+/);
    let line = "";
    let lineNumber = 0;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        ctx.fillText(line, x, y + lineNumber * lineHeight);
        lineNumber += 1;
        line = word;
        if (lineNumber >= maxLines) return;
      } else {
        line = candidate;
      }
    }
    if (line && lineNumber < maxLines) ctx.fillText(line, x, y + lineNumber * lineHeight);
  }

  private drawGrid(): void {
    this.gridLayer.clear();
    const bounds = cameraWorldBounds(this.camera, 20);
    const minor = this.camera.scale < 0.16 ? 400 : this.camera.scale < 0.5 ? 160 : 80;
    const startX = Math.floor(bounds.x / minor) * minor;
    const startY = Math.floor(bounds.y / minor) * minor;
    const maxLines = 160;
    let lineCount = 0;
    for (let x = startX; x <= bounds.x + bounds.width && lineCount < maxLines; x += minor, lineCount += 1) {
      this.gridLayer.moveTo(x, bounds.y).lineTo(x, bounds.y + bounds.height);
    }
    for (let y = startY; y <= bounds.y + bounds.height && lineCount < maxLines; y += minor, lineCount += 1) {
      this.gridLayer.moveTo(bounds.x, y).lineTo(bounds.x + bounds.width, y);
    }
    this.gridLayer.stroke({ color: 0x536078, width: 1 / this.camera.scale, alpha: 0.13 });
  }

  private normalizedBounds(start: WorldPoint, end: WorldPoint): WorldBounds {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  private previewResize(layer: Container, label: string, original: WorldBounds, width: number, height: number): void {
    const display = layer.children.find((child) => child.label === label);
    display?.scale.set(width / original.width, height / original.height);
  }

  private drawInteraction(): void {
    this.interactionLayer.removeChildren().forEach((child) => child.destroy({ children: true }));
    if (this.selection) {
      const bounds = this.normalizedBounds(this.selection.start, this.selection.end);
      const selection = new Graphics()
        .rect(bounds.x, bounds.y, bounds.width, bounds.height)
        .fill({ color: 0xa78bfa, alpha: 0.1 })
        .stroke({ color: 0xc4b5fd, width: 1.5 / this.camera.scale, alpha: 0.9 });
      this.interactionLayer.addChild(selection);
    }
    if (this.connectionDraft) {
      const { start, end } = this.connectionDraft;
      const dx = end.x - start.x;
      const direction = Math.sign(dx || 1);
      const control = Math.max(60, Math.abs(dx) * 0.42);
      const draft = new Graphics()
        .moveTo(start.x, start.y)
        .bezierCurveTo(start.x + direction * control, start.y, end.x - direction * control, end.y, end.x, end.y)
        .stroke({ color: 0xc4b5fd, width: 3 / Math.max(this.camera.scale, 0.2), alpha: 0.9 });
      this.interactionLayer.addChild(draft);
    }
  }

  private drawRegion(region: CanvasRegion, lod: string): void {
    const selected = this.state?.selectedRegionId === region.id;
    const container = new Container();
    container.position.set(region.x, region.y);
    container.label = `region:${region.id}`;
    const graphic = new Graphics()
      .roundRect(0, 0, region.width, region.height, 24)
      .fill({ color: region.color, alpha: region.kind === "session" ? 0.035 : 0.022 })
      .stroke({
        color: selected ? 0xffffff : region.color,
        width: (selected ? 5 : 3) / Math.max(this.camera.scale, 0.16),
        alpha: selected ? 0.9 : 0.55,
      });
    container.addChild(graphic);

    const fontSize = lod === "overview" ? Math.max(56, 22 / this.camera.scale) : 28;
    const title = new Text({
      text: region.title,
      style: {
        fill: region.color,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize,
        fontWeight: "700",
        letterSpacing: 2,
      },
    });
    title.position.set(22, 18);
    container.addChild(title);

    if (!this.sessionMode) {
      const header = new Graphics().roundRect(0, 0, region.width, 62, 24).fill({ color: 0xffffff, alpha: 0.001 });
      header.eventMode = "static";
      header.cursor = "grab";
      header.hitArea = new Rectangle(0, 0, region.width, 62);
      header.on("pointerdown", (event: FederatedPointerEvent) => {
        if (this.spacePressed) return;
        event.stopPropagation();
        this.callbacks.onSelectRegion(region.id);
        const pointerStart = this.screenToWorld(event.global);
        const regionIds = this.descendantRegionIds(region.id);
        const positions = new Map(
          (this.state?.regions ?? [])
            .filter((candidate) => regionIds.has(candidate.id))
            .map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]),
        );
        const nodePositions = new Map(
          (this.state?.nodes ?? [])
            .filter((node) => node.regionId && regionIds.has(node.regionId))
            .map((node) => [node.id, { x: node.x, y: node.y }]),
        );
        this.regionDrag = { id: region.id, pointerStart, positions, nodePositions, regionIds, dx: 0, dy: 0 };
      });
      container.addChild(header);
    }

    if (selected && !this.sessionMode) {
      const size = 18 / Math.max(this.camera.scale, 0.25);
      const handle = new Graphics()
        .roundRect(-size / 2, -size / 2, size, size, size * 0.2)
        .fill({ color: 0xffffff, alpha: 0.95 })
        .stroke({ color: region.color, width: 2 / Math.max(this.camera.scale, 0.25) });
      handle.position.set(region.width, region.height);
      handle.eventMode = "static";
      handle.cursor = "nwse-resize";
      handle.hitArea = new Rectangle(-size, -size, size * 2, size * 2);
      handle.on("pointerdown", (event: FederatedPointerEvent) => {
        if (this.spacePressed) return;
        event.stopPropagation();
        this.regionResize = {
          id: region.id,
          pointerStart: this.screenToWorld(event.global),
          bounds: { x: region.x, y: region.y, width: region.width, height: region.height },
          width: region.width,
          height: region.height,
        };
      });
      container.addChild(handle);
    }
    this.regionLayer.addChild(container);
  }

  private descendantRegionIds(id: string): Set<string> {
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const region of this.state?.regions ?? []) {
        if (region.parentRegionId && ids.has(region.parentRegionId) && !ids.has(region.id)) {
          ids.add(region.id);
          changed = true;
        }
      }
    }
    return ids;
  }

  private resolvedNode(node: CanvasNode): CanvasNode {
    if (!node.sourceNodeId || !this.state) return node;
    const original = this.nodeById.get(node.sourceNodeId);
    return original ? { ...node, title: original.title, imageSrc: original.imageSrc, tags: original.tags, color: original.color } : node;
  }

  private drawNode(sourceNode: CanvasNode, lod: string): void {
    const node = this.resolvedNode(sourceNode);
    const selected = this.state?.selectedNodeIds.includes(node.id) ?? false;
    const hasFocusedSelection = Boolean(this.state?.selectedNodeIds.length);
    const related = !hasFocusedSelection || selected || this.isConnectedToSelection(node.id);
    const progress = this.state?.sessionProgress[node.id] ?? "pending";
    const inActiveSession = !this.sessionMode || this.nodeIsInActiveSession(node);
    const container = new Container();
    container.position.set(node.x, node.y);
    container.eventMode = "static";
    container.cursor = this.sessionMode ? (inActiveSession ? "pointer" : "default") : "grab";
    container.hitArea = new Rectangle(0, 0, node.width, node.height);
    container.alpha = inActiveSession ? (related ? 1 : 0.22) : 0.1;
    container.label = node.id;

    const box = new Graphics();
    const accent = progress === "completed" ? 0x34d399 : progress === "active" ? 0xfbbf24 : TYPE_COLORS[node.kind];
    box
      .roundRect(0, 0, node.width, node.height, 15)
      .fill({ color: node.color, alpha: 0.98 })
      .stroke({ color: selected ? 0xffffff : accent, width: selected ? 4 : 2, alpha: selected ? 0.95 : 0.8 });
    box.roundRect(0, 0, 7, node.height, 4).fill({ color: accent, alpha: 1 });
    container.addChild(box);

    if (node.sourceNodeId) {
      const badge = new Graphics().circle(node.width - 20, 20, 9).fill({ color: 0x38bdf8, alpha: 0.95 });
      container.addChild(badge);
    }

    const hasImage = Boolean(node.imageSrc) && lod === "detail";
    const title = new Text({
      text: node.title || "Sem título",
      style: {
        fill: 0xf7f8ff,
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: lod === "region" ? 22 : 19,
        fontWeight: "600",
        wordWrap: true,
        wordWrapWidth: node.width - (hasImage ? 112 : 38),
        lineHeight: 24,
      },
    });
    title.position.set(22, 17);
    container.addChild(title);

    if (hasImage && node.imageSrc) {
      const thumbnail = Sprite.from(node.imageSrc);
      const availableHeight = Math.max(44, Math.min(84, node.height - 28));
      thumbnail.position.set(node.width - availableHeight - 14, 14);
      thumbnail.width = availableHeight;
      thumbnail.height = availableHeight;
      thumbnail.alpha = 0.92;
      container.addChild(thumbnail);
    }

    if (lod === "detail" && node.body) {
      const body = new Text({
        text: node.body.length > 150 ? `${node.body.slice(0, 147)}…` : node.body,
        style: {
          fill: 0xaeb8ce,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 13,
          wordWrap: true,
          wordWrapWidth: node.width - 38,
          lineHeight: 18,
        },
      });
      body.position.set(22, Math.min(node.height - 50, 54));
      container.addChild(body);
    }

    if (progress !== "pending") {
      const symbol = new Text({
        text: progress === "completed" ? "✓" : "▶",
        style: { fill: progress === "completed" ? 0x34d399 : 0xfbbf24, fontSize: 22, fontWeight: "800" },
      });
      symbol.position.set(node.width - 34, node.height - 34);
      container.addChild(symbol);
    }

    if (selected && !this.sessionMode) {
      const controlSize = 13 / Math.max(this.camera.scale, 0.25);
      const inputPort = new Graphics()
        .circle(0, 0, controlSize * 0.52)
        .fill({ color: 0x111827, alpha: 1 })
        .stroke({ color: 0xc4b5fd, width: 2 / Math.max(this.camera.scale, 0.25), alpha: 0.9 });
      inputPort.position.set(0, node.height / 2);
      container.addChild(inputPort);

      const outputPort = new Graphics()
        .circle(0, 0, controlSize * 0.62)
        .fill({ color: 0xc4b5fd, alpha: 1 })
        .stroke({ color: 0x111827, width: 2 / Math.max(this.camera.scale, 0.25), alpha: 0.95 });
      outputPort.position.set(node.width, node.height / 2);
      outputPort.eventMode = "static";
      outputPort.cursor = "crosshair";
      outputPort.hitArea = new Rectangle(-controlSize * 1.4, -controlSize * 1.4, controlSize * 2.8, controlSize * 2.8);
      outputPort.on("pointerdown", (event: FederatedPointerEvent) => {
        if (this.spacePressed) return;
        event.stopPropagation();
        const start = { x: node.x + node.width, y: node.y + node.height / 2 };
        this.connectionDraft = { fromId: node.id, start, end: start };
        this.drawInteraction();
      });
      container.addChild(outputPort);

      if (this.state?.selectedNodeIds.length === 1) {
        const handleSize = 17 / Math.max(this.camera.scale, 0.25);
        const handle = new Graphics()
          .roundRect(-handleSize / 2, -handleSize / 2, handleSize, handleSize, handleSize * 0.2)
          .fill({ color: 0xffffff, alpha: 0.96 })
          .stroke({ color: accent, width: 2 / Math.max(this.camera.scale, 0.25) });
        handle.position.set(node.width, node.height);
        handle.eventMode = "static";
        handle.cursor = "nwse-resize";
        handle.hitArea = new Rectangle(-handleSize, -handleSize, handleSize * 2, handleSize * 2);
        handle.on("pointerdown", (event: FederatedPointerEvent) => {
          if (this.spacePressed) return;
          event.stopPropagation();
          this.resize = {
            id: node.id,
            pointerStart: this.screenToWorld(event.global),
            bounds: { x: node.x, y: node.y, width: node.width, height: node.height },
            width: node.width,
            height: node.height,
          };
        });
        container.addChild(handle);
      }
    }

    container.on("pointerdown", (event: FederatedPointerEvent) => {
      if (this.spacePressed) return;
      event.stopPropagation();
      if (this.sessionMode) {
        if (this.nodeIsInActiveSession(node)) this.callbacks.onSessionAdvance(node.id);
        return;
      }
      this.callbacks.onSelectNode(node.id, Boolean(event.shiftKey));
      if (!this.state?.selectedNodeIds.includes(node.id)) return;
      const positions = new Map(
        this.state.nodes
          .filter((candidate) => this.state?.selectedNodeIds.includes(candidate.id))
          .map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]),
      );
      this.drag = {
        pointerStart: this.screenToWorld(event.global),
        positions,
        dx: 0,
        dy: 0,
      };
    });
    this.nodeLayer.addChild(container);
  }

  private isConnectedToSelection(nodeId: string): boolean {
    if (!this.state) return false;
    const selected = new Set(this.state.selectedNodeIds);
    return [...selected].some((selectedId) =>
      (this.edgesByNodeId.get(selectedId) ?? []).some((edge) =>
        (edge.fromNodeId === selectedId && edge.toNodeId === nodeId) ||
        (edge.toNodeId === selectedId && edge.fromNodeId === nodeId),
      ),
    );
  }

  private nodeIsInActiveSession(node: CanvasNode): boolean {
    if (!this.activeSessionId || !node.regionId) return false;
    let regionId: string | null = node.regionId;
    while (regionId) {
      if (regionId === this.activeSessionId) return true;
      regionId = this.state?.regions.find((region) => region.id === regionId)?.parentRegionId ?? null;
    }
    return false;
  }

  private drawEdge(edge: CanvasConnection, lod: string): void {
    if (!this.state) return;
    const from = this.nodeById.get(edge.fromNodeId);
    const to = this.nodeById.get(edge.toNodeId);
    if (!from || !to) return;

    const selected = new Set(this.state.selectedNodeIds);
    const edgeSelected = this.state.selectedConnectionId === edge.id;
    const focused = selected.size > 0 || Boolean(this.state.selectedConnectionId);
    const related = edgeSelected || selected.has(from.id) || selected.has(to.id);
    const alpha = focused ? (related ? 0.95 : 0.08) : edge.relation === "reference" ? 0.45 : 0.7;
    const start = this.edgePoint(from, to);
    const end = this.edgePoint(to, from);
    const dx = end.x - start.x;
    const control = Math.max(60, Math.abs(dx) * 0.42);
    const graphic = new Graphics();
    const hitGraphic = new Graphics()
      .moveTo(start.x, start.y)
      .bezierCurveTo(start.x + Math.sign(dx || 1) * control, start.y, end.x - Math.sign(dx || 1) * control, end.y, end.x, end.y)
      .stroke({ color: 0xffffff, width: 16 / Math.max(this.camera.scale, 0.2), alpha: 0.001 });
    hitGraphic.eventMode = "static";
    hitGraphic.cursor = "pointer";
    hitGraphic.on("pointerdown", (event: FederatedPointerEvent) => {
      event.stopPropagation();
      this.callbacks.onSelectConnection(edge.id);
    });
    this.edgeLayer.addChild(hitGraphic);
    graphic
      .moveTo(start.x, start.y)
      .bezierCurveTo(start.x + Math.sign(dx || 1) * control, start.y, end.x - Math.sign(dx || 1) * control, end.y, end.x, end.y)
      .stroke({ color: edgeSelected ? 0xffffff : edge.color, width: (edgeSelected ? 5 : related ? 3.5 : 2.2) / Math.max(this.camera.scale, 0.2), alpha });

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const size = 11 / Math.max(this.camera.scale, 0.25);
    graphic
      .moveTo(end.x, end.y)
      .lineTo(end.x - Math.cos(angle - Math.PI / 6) * size, end.y - Math.sin(angle - Math.PI / 6) * size)
      .lineTo(end.x - Math.cos(angle + Math.PI / 6) * size, end.y - Math.sin(angle + Math.PI / 6) * size)
      .closePath()
      .fill({ color: edge.color, alpha });
    this.edgeLayer.addChild(graphic);

    if (edge.label && lod === "detail") {
      const label = new Text({
        text: edge.label,
        style: { fill: 0xb7c0d5, fontFamily: "Inter, system-ui", fontSize: 12 },
      });
      label.anchor.set(0.5);
      label.position.set((start.x + end.x) / 2, (start.y + end.y) / 2 - 10);
      label.alpha = alpha;
      this.edgeLayer.addChild(label);
    }
  }

  private edgePoint(node: CanvasNode, other: CanvasNode): WorldPoint {
    const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    const otherCenter = { x: other.x + other.width / 2, y: other.y + other.height / 2 };
    const dx = otherCenter.x - center.x;
    const dy = otherCenter.y - center.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return { x: dx > 0 ? node.x + node.width : node.x, y: center.y };
    }
    return { x: center.x, y: dy > 0 ? node.y + node.height : node.y };
  }

  getCamera(): CameraState {
    return { ...this.camera };
  }

  getViewportCenter(): WorldPoint {
    return this.screenToWorld({ x: this.camera.viewportWidth / 2, y: this.camera.viewportHeight / 2 });
  }

  screenToWorld(point: WorldPoint): WorldPoint {
    return {
      x: (point.x - this.camera.x) / this.camera.scale,
      y: (point.y - this.camera.y) / this.camera.scale,
    };
  }

  worldToScreen(point: WorldPoint): WorldPoint {
    return {
      x: point.x * this.camera.scale + this.camera.x,
      y: point.y * this.camera.scale + this.camera.y,
    };
  }

  fitAll(): void {
    if (!this.state) return;
    const viewportWidth = this.host.clientWidth;
    const viewportHeight = this.host.clientHeight;
    // Tauri/WebView2 may mount the canvas before layout has produced a usable
    // size. Fitting against 1x1 permanently sent the camera to minimum zoom.
    if (viewportWidth < 100 || viewportHeight < 100) return;
    this.initialFitDone = true;
    this.camera.viewportWidth = viewportWidth;
    this.camera.viewportHeight = viewportHeight;
    const bounds = collectBounds(this.state.nodes, this.state.regions);
    this.animateCamera(cameraForBounds(bounds, viewportWidth, viewportHeight, 90));
  }

  focusNode(id: string): void {
    const node = this.state?.nodes.find((candidate) => candidate.id === id);
    if (!node) return;
    const scale = Math.max(this.camera.scale, 0.85);
    this.animateCamera({
      ...this.camera,
      scale,
      x: this.camera.viewportWidth / 2 - (node.x + node.width / 2) * scale,
      y: this.camera.viewportHeight / 2 - (node.y + node.height / 2) * scale,
    });
  }

  focusRegion(id: string): void {
    const region = this.state?.regions.find((candidate) => candidate.id === id);
    if (!region) return;
    this.animateCamera(cameraForBounds(region, this.camera.viewportWidth, this.camera.viewportHeight, 70));
  }

  centerOn(point: WorldPoint): void {
    this.animateCamera({
      ...this.camera,
      x: this.camera.viewportWidth / 2 - point.x * this.camera.scale,
      y: this.camera.viewportHeight / 2 - point.y * this.camera.scale,
    });
  }

  private animateCamera(target: CameraState): void {
    const animationId = ++this.cameraAnimationId;
    const start = this.getCamera();
    const startedAt = performance.now();
    const duration = 320;
    const tick = (time: number) => {
      if (animationId !== this.cameraAnimationId || this.destroyed) return;
      const raw = Math.min(1, (time - startedAt) / duration);
      const eased = 1 - Math.pow(1 - raw, 3);
      this.camera = {
        ...this.camera,
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        scale: start.scale + (target.scale - start.scale) * eased,
      };
      this.updateCameraTransform();
      this.drawScene(semanticLod(this.camera.scale) !== this.lastLod);
      this.callbacks.onCameraChange(this.getCamera());
      if (raw < 1) requestAnimationFrame(tick);
      else this.drawScene(true);
    };
    requestAnimationFrame(tick);
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    if (this.initialized) {
      this.app.canvas.removeEventListener("wheel", this.onWheel);
      this.app.canvas.removeEventListener("dblclick", this.onDoubleClick);
      this.app.canvas.removeEventListener("contextmenu", this.onContextMenu);
    }
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    if (this.initialized) this.app.destroy(true, { children: true });
    this.nativeCanvas.remove();
  }
}
