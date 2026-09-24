import { cameraForBounds, cameraWorldBounds, clampScale, collectBounds, intersects, semanticLod } from "../domain/spatial";
import { SpatialIndex } from "../domain/SpatialIndex";
import { applyNodeRenderBudget } from "../domain/renderBudget";
import type {
  CameraState,
  CanvasConnection,
  CanvasNode,
  CanvasRegion,
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
  onDuplicateNodesInPlace: (ids: string[]) => Array<{ id: string; x: number; y: number }>;
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

const TYPE_COLORS: Record<CanvasNode["kind"], string> = {
  free: "#8290ad",
  scene: "#a78bfa",
  speech: "#f0abfc",
  npc: "#38bdf8",
  event: "#c084fc",
  decision: "#fb7185",
  condition: "#fbbf24",
  combat: "#f43f5e",
  clue: "#22d3ee",
  improv: "#f97316",
  lore: "#818cf8",
  place: "#2dd4bf",
  item: "#facc15",
  creature: "#ef4444",
  faction: "#60a5fa",
  transition: "#94a3b8",
};

const TYPE_ICONS: Record<CanvasNode["kind"], string> = {
  free: "✎",
  scene: "🎬",
  speech: "💬",
  npc: "🧑",
  event: "⚡",
  decision: "🔀",
  condition: "❓",
  combat: "⚔️",
  clue: "🔍",
  improv: "🎲",
  lore: "📖",
  place: "📍",
  item: "🎒",
  creature: "🐾",
  faction: "🚩",
  transition: "🔁",
};

const NODE_MIN_WIDTH = 140;
const NODE_MAX_WIDTH = 900;
const NODE_MIN_HEIGHT = 76;
const NODE_MAX_HEIGHT = 700;
const REGION_MIN_WIDTH = 360;
const REGION_MAX_WIDTH = 6000;
const REGION_MIN_HEIGHT = 260;
const REGION_MAX_HEIGHT = 5000;
const REGION_HEADER_HEIGHT = 62;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * CanvasEngine is the single source of truth for rendering, coordinates,
 * hit-testing, camera and every visual interaction on the map. It draws
 * directly onto one visible <canvas> and reads pointer events from that
 * same element, so whatever the user sees is exactly what receives clicks —
 * there is no separate invisible interaction layer to fall out of sync.
 */
export class CanvasEngine {
  private host: HTMLElement;
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D | null = null;
  private callbacks: CanvasEngineCallbacks;
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
  private resizeObserver: ResizeObserver | null = null;
  private spacePressed = false;
  private initialized = false;
  private nodeIndex = new SpatialIndex<CanvasNode>();
  private nodeById = new Map<string, CanvasNode>();
  private edgesByNodeId = new Map<string, CanvasConnection[]>();
  private initialFitDone = false;
  private cameraAnimationId = 0;
  private imageCache = new Map<string, HTMLImageElement>();
  private focusMode = false;
  private focusReachable: Set<string> | null = null;
  private focusRelatedRegions: Set<string> | null = null;
  private snapGuideX: number | null = null;
  private snapGuideY: number | null = null;

  constructor(host: HTMLElement, callbacks: CanvasEngineCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
  }

  async init(): Promise<void> {
    this.canvas.className = "canvas-view";
    this.ctx = this.canvas.getContext("2d");
    this.host.appendChild(this.canvas);
    this.initialized = true;

    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.resizeCanvasElement(width, height);
    this.camera.viewportWidth = width;
    this.camera.viewportHeight = height;

    this.attachEvents();
    this.render();

    this.resizeObserver = new ResizeObserver(() => this.handleHostResize());
    this.resizeObserver.observe(this.host);
  }

  private handleHostResize(): void {
    if (this.destroyed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.resizeCanvasElement(width, height);
    this.camera = { ...this.camera, viewportWidth: width, viewportHeight: height };
    // Tauri/WebView2 may report layout before the workspace has a usable
    // size. Never fit against a 1x1 (or otherwise tiny) viewport.
    if (!this.initialFitDone && this.state && width >= 100 && height >= 100) {
      this.fitAll();
      return;
    }
    this.render();
    this.callbacks.onCameraChange(this.getCamera());
  }

  private resizeCanvasElement(width: number, height: number): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(width * ratio));
    this.canvas.height = Math.max(1, Math.round(height * ratio));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  private attachEvents(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("dblclick", this.onDoubleClick);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.isTypingTarget(event.target)) return;
    if (event.code === "Space") {
      this.spacePressed = true;
      this.canvas.classList.add("is-pannable");
      return;
    }
    if (event.code === "Escape") {
      const hadActiveGesture = Boolean(
        this.connectionDraft || this.resize || this.regionResize || this.drag || this.regionDrag || this.selection,
      );
      if (hadActiveGesture) {
        event.preventDefault();
        this.finalizeGesture(false);
      }
    }
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      this.spacePressed = false;
      this.canvas.classList.remove("is-pannable");
    }
  };

  private eventPoint(event: PointerEvent | MouseEvent): WorldPoint {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2) return;
    const screen = this.eventPoint(event);
    const world = this.screenToWorld(screen);

    if (this.spacePressed || event.button === 1) {
      this.capture(event.pointerId);
      this.isPanning = true;
      this.panOrigin = { x: screen.x, y: screen.y, cameraX: this.camera.x, cameraY: this.camera.y };
      this.canvas.classList.add("is-panning");
      return;
    }
    if (event.button !== 0 || !this.state) return;

    if (this.state.selectedNodeIds.length === 1 && !this.sessionMode) {
      const node = this.nodeById.get(this.state.selectedNodeIds[0]);
      if (node) {
        const port = this.outputPortWorld(node);
        if (this.pointInCircle(world, port.center, port.radius)) {
          this.capture(event.pointerId);
          const start = { x: node.x + node.width, y: node.y + node.height / 2 };
          this.connectionDraft = { fromId: node.id, start, end: world };
          this.render();
          return;
        }
        const handle = this.nodeResizeHandleWorld(node);
        if (this.pointInRect(world, handle)) {
          this.capture(event.pointerId);
          this.resize = {
            id: node.id,
            pointerStart: world,
            bounds: { x: node.x, y: node.y, width: node.width, height: node.height },
            width: node.width,
            height: node.height,
          };
          return;
        }
      }
    }

    if (this.state.selectedRegionId && !this.sessionMode) {
      const region = this.state.regions.find((candidate) => candidate.id === this.state!.selectedRegionId);
      if (region) {
        const handle = this.regionResizeHandleWorld(region);
        if (this.pointInRect(world, handle)) {
          this.capture(event.pointerId);
          this.regionResize = {
            id: region.id,
            pointerStart: world,
            bounds: { x: region.x, y: region.y, width: region.width, height: region.height },
            width: region.width,
            height: region.height,
          };
          return;
        }
      }
    }

    const hitNode = this.hitNode(world);
    if (hitNode) {
      this.capture(event.pointerId);
      if (this.sessionMode) {
        if (this.nodeIsInActiveSession(hitNode)) this.callbacks.onSessionAdvance(hitNode.id);
        return;
      }

      if (event.altKey) {
        // Alt+drag: duplicate the current selection (or the node/group under
        // the cursor) in place, then immediately continue this same pointer
        // gesture dragging the copies — the originals never move.
        const sourceIds =
          this.groupMembersOf(hitNode) ?? (this.state.selectedNodeIds.includes(hitNode.id) ? this.state.selectedNodeIds : [hitNode.id]);
        const copies = this.callbacks.onDuplicateNodesInPlace(sourceIds);
        if (copies.length) {
          const positions = new Map(copies.map((copy) => [copy.id, { x: copy.x, y: copy.y }]));
          this.drag = { pointerStart: world, positions, dx: 0, dy: 0 };
        }
        return;
      }

      const groupMembers = this.groupMembersOf(hitNode);
      if (groupMembers && !event.shiftKey) {
        this.callbacks.onSelectNodes(groupMembers, false);
      } else {
        this.callbacks.onSelectNode(hitNode.id, Boolean(event.shiftKey));
      }
      if (!this.state.selectedNodeIds.includes(hitNode.id)) return;
      const positions = new Map(
        this.state.nodes
          .filter((candidate) => this.state?.selectedNodeIds.includes(candidate.id))
          .map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]),
      );
      this.drag = { pointerStart: world, positions, dx: 0, dy: 0 };
      return;
    }

    if (!this.sessionMode) {
      const edge = this.hitEdge(world);
      if (edge) {
        this.callbacks.onSelectConnection(edge.id);
        this.render();
        return;
      }

      const region = this.hitRegionHeader(world);
      if (region) {
        this.capture(event.pointerId);
        this.callbacks.onSelectRegion(region.id);
        const regionIds = this.descendantRegionIds(region.id);
        const positions = new Map(
          (this.state.regions ?? [])
            .filter((candidate) => regionIds.has(candidate.id))
            .map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]),
        );
        const nodePositions = new Map(
          (this.state.nodes ?? [])
            .filter((node) => node.regionId && regionIds.has(node.regionId))
            .map((node) => [node.id, { x: node.x, y: node.y }]),
        );
        this.regionDrag = { id: region.id, pointerStart: world, positions, nodePositions, regionIds, dx: 0, dy: 0 };
        return;
      }
    }

    this.capture(event.pointerId);
    this.selection = { start: world, end: world, additive: Boolean(event.shiftKey) };
    if (!event.shiftKey) this.callbacks.onClearSelection();
    this.render();
  };

  private capture(pointerId: number): void {
    try {
      this.canvas.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is best-effort; ignore when unsupported (e.g. tests).
    }
  }

  private onPointerMove = (event: PointerEvent): void => {
    const screen = this.eventPoint(event);
    const world = this.screenToWorld(screen);

    if (this.connectionDraft) {
      this.connectionDraft.end = world;
      this.render();
      return;
    }
    if (this.resize) {
      this.resize.width = clamp(this.resize.bounds.width + world.x - this.resize.pointerStart.x, NODE_MIN_WIDTH, NODE_MAX_WIDTH);
      this.resize.height = clamp(this.resize.bounds.height + world.y - this.resize.pointerStart.y, NODE_MIN_HEIGHT, NODE_MAX_HEIGHT);
      this.render();
      return;
    }
    if (this.regionResize) {
      this.regionResize.width = clamp(this.regionResize.bounds.width + world.x - this.regionResize.pointerStart.x, REGION_MIN_WIDTH, REGION_MAX_WIDTH);
      this.regionResize.height = clamp(this.regionResize.bounds.height + world.y - this.regionResize.pointerStart.y, REGION_MIN_HEIGHT, REGION_MAX_HEIGHT);
      this.render();
      return;
    }
    if (this.drag) {
      const rawDx = world.x - this.drag.pointerStart.x;
      const rawDy = world.y - this.drag.pointerStart.y;
      const snapped = this.computeDragSnap(rawDx, rawDy, this.drag.positions);
      this.drag.dx = snapped.dx;
      this.drag.dy = snapped.dy;
      this.render();
      return;
    }
    if (this.regionDrag) {
      this.regionDrag.dx = world.x - this.regionDrag.pointerStart.x;
      this.regionDrag.dy = world.y - this.regionDrag.pointerStart.y;
      this.render();
      return;
    }
    if (this.selection) {
      this.selection.end = world;
      this.render();
      return;
    }
    if (this.isPanning) {
      this.camera.x = this.panOrigin.cameraX + screen.x - this.panOrigin.x;
      this.camera.y = this.panOrigin.cameraY + screen.y - this.panOrigin.y;
      this.render();
      this.callbacks.onCameraChange(this.getCamera());
      return;
    }
    if (!this.spacePressed) this.updateHoverCursor(world);
  };

  private updateHoverCursor(world: WorldPoint): void {
    if (!this.state) return;
    if (this.state.selectedNodeIds.length === 1 && !this.sessionMode) {
      const node = this.nodeById.get(this.state.selectedNodeIds[0]);
      if (node) {
        const port = this.outputPortWorld(node);
        if (this.pointInCircle(world, port.center, port.radius)) {
          this.canvas.style.cursor = "crosshair";
          return;
        }
        if (this.pointInRect(world, this.nodeResizeHandleWorld(node))) {
          this.canvas.style.cursor = "nwse-resize";
          return;
        }
      }
    }
    if (this.state.selectedRegionId && !this.sessionMode) {
      const region = this.state.regions.find((candidate) => candidate.id === this.state!.selectedRegionId);
      if (region && this.pointInRect(world, this.regionResizeHandleWorld(region))) {
        this.canvas.style.cursor = "nwse-resize";
        return;
      }
    }
    if (this.hitNode(world)) {
      this.canvas.style.cursor = this.sessionMode ? "pointer" : "grab";
      return;
    }
    if (!this.sessionMode && this.hitEdge(world)) {
      this.canvas.style.cursor = "pointer";
      return;
    }
    if (!this.sessionMode && this.hitRegionHeader(world)) {
      this.canvas.style.cursor = "grab";
      return;
    }
    this.canvas.style.cursor = "default";
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (this.canvas.hasPointerCapture?.(event.pointerId)) {
      try {
        this.canvas.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore — pointer may already have been released by the browser.
      }
    }
    this.finalizeGesture(true);
  };

  private finalizeGesture(commit: boolean): void {
    if (this.connectionDraft) {
      const draft = this.connectionDraft;
      this.connectionDraft = null;
      if (commit) {
        const target = this.hitNode(draft.end);
        if (target && target.id !== draft.fromId) this.callbacks.onCreateConnection(draft.fromId, target.id);
      }
    }
    if (this.resize) {
      const { id, bounds, width, height } = this.resize;
      this.resize = null;
      if (commit && (width !== bounds.width || height !== bounds.height)) {
        this.callbacks.onResizeNode(id, { ...bounds, width, height });
      }
    }
    if (this.regionResize) {
      const { id, bounds, width, height } = this.regionResize;
      this.regionResize = null;
      if (commit && (width !== bounds.width || height !== bounds.height)) {
        this.callbacks.onResizeRegion(id, { ...bounds, width, height });
      }
    }
    if (this.drag) {
      const { positions, dx, dy } = this.drag;
      this.drag = null;
      this.snapGuideX = null;
      this.snapGuideY = null;
      if (commit && (dx !== 0 || dy !== 0)) {
        this.callbacks.onMoveNodes([...positions].map(([id, position]) => ({ id, x: position.x + dx, y: position.y + dy })));
      }
    }
    if (this.regionDrag) {
      const { id, positions, dx, dy } = this.regionDrag;
      this.regionDrag = null;
      const position = positions.get(id);
      if (commit && position && (dx !== 0 || dy !== 0)) {
        this.callbacks.onMoveRegion(id, { x: position.x + dx, y: position.y + dy });
      }
    }
    if (this.selection) {
      const selection = this.selection;
      this.selection = null;
      if (commit) {
        const bounds = this.normalizedBounds(selection.start, selection.end);
        if (bounds.width > 4 / this.camera.scale || bounds.height > 4 / this.camera.scale) {
          const ids = this.nodeIndex.search(bounds).map((node) => node.id);
          this.callbacks.onSelectNodes(ids, selection.additive);
        }
      }
    }
    this.isPanning = false;
    this.canvas.classList.remove("is-panning");
    this.render();
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const cursor = this.eventPoint(event);
    const before = this.screenToWorld(cursor);
    const factor = Math.exp(-event.deltaY * 0.0012);
    const nextScale = clampScale(this.camera.scale * factor);
    this.camera.scale = nextScale;
    this.camera.x = cursor.x - before.x * nextScale;
    this.camera.y = cursor.y - before.y * nextScale;
    this.render();
    this.callbacks.onCameraChange(this.getCamera());
  };

  private onDoubleClick = (event: MouseEvent): void => {
    const screen = this.eventPoint(event);
    const world = this.screenToWorld(screen);
    const hit = this.hitNode(world);
    if (hit) {
      this.callbacks.onEditNode(hit.id, this.nodeScreenBounds(hit));
      return;
    }
    this.callbacks.onCreateNode({ x: world.x - 120, y: world.y - 40 }, screen);
  };

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    const screen = this.eventPoint(event);
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

  // ---- geometry & hit testing -------------------------------------------------

  private groupMembersOf(node: CanvasNode): string[] | null {
    if (!node.groupId || !this.state) return null;
    const members = this.state.nodes.filter((candidate) => candidate.groupId === node.groupId).map((candidate) => candidate.id);
    return members.length > 1 ? members : null;
  }

  /** Snaps the in-progress drag so the dragged selection's edges/centers
   * align with any other node's edges/centers within a small screen-space
   * threshold, and records which guide lines to draw. */
  private computeDragSnap(dx: number, dy: number, positions: Map<string, WorldPoint>): { dx: number; dy: number } {
    this.snapGuideX = null;
    this.snapGuideY = null;
    if (!this.state) return { dx, dy };
    const draggedIds = new Set(positions.keys());
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [id, position] of positions) {
      const node = this.nodeById.get(id);
      if (!node) continue;
      minX = Math.min(minX, position.x + dx);
      maxX = Math.max(maxX, position.x + dx + node.width);
      minY = Math.min(minY, position.y + dy);
      maxY = Math.max(maxY, position.y + dy + node.height);
    }
    if (!Number.isFinite(minX)) return { dx, dy };
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const threshold = 8 / Math.max(this.camera.scale, 0.1);
    let bestDx = 0;
    let bestDxDist = threshold;
    let bestDy = 0;
    let bestDyDist = threshold;
    for (const node of this.state.nodes) {
      if (draggedIds.has(node.id)) continue;
      for (const target of [node.x, node.x + node.width / 2, node.x + node.width]) {
        for (const source of [minX, centerX, maxX]) {
          const dist = Math.abs(source - target);
          if (dist < bestDxDist) {
            bestDxDist = dist;
            bestDx = target - source;
            this.snapGuideX = target;
          }
        }
      }
      for (const target of [node.y, node.y + node.height / 2, node.y + node.height]) {
        for (const source of [minY, centerY, maxY]) {
          const dist = Math.abs(source - target);
          if (dist < bestDyDist) {
            bestDyDist = dist;
            bestDy = target - source;
            this.snapGuideY = target;
          }
        }
      }
    }
    return { dx: dx + bestDx, dy: dy + bestDy };
  }

  private effectiveNodeBounds(node: CanvasNode): WorldBounds {
    if (this.resize && this.resize.id === node.id) {
      return { x: this.resize.bounds.x, y: this.resize.bounds.y, width: this.resize.width, height: this.resize.height };
    }
    if (this.drag) {
      const position = this.drag.positions.get(node.id);
      if (position) return { x: position.x + this.drag.dx, y: position.y + this.drag.dy, width: node.width, height: node.height };
    }
    if (this.regionDrag) {
      const position = this.regionDrag.nodePositions.get(node.id);
      if (position) return { x: position.x + this.regionDrag.dx, y: position.y + this.regionDrag.dy, width: node.width, height: node.height };
    }
    return { x: node.x, y: node.y, width: node.width, height: node.height };
  }

  private effectiveRegionBounds(region: CanvasRegion): WorldBounds {
    if (this.regionResize && this.regionResize.id === region.id) {
      return { x: this.regionResize.bounds.x, y: this.regionResize.bounds.y, width: this.regionResize.width, height: this.regionResize.height };
    }
    if (this.regionDrag) {
      const position = this.regionDrag.positions.get(region.id);
      if (position) return { x: position.x + this.regionDrag.dx, y: position.y + this.regionDrag.dy, width: region.width, height: region.height };
    }
    return { x: region.x, y: region.y, width: region.width, height: region.height };
  }

  private hitNode(point: WorldPoint): CanvasNode | null {
    if (!this.state) return null;
    for (let index = this.state.nodes.length - 1; index >= 0; index -= 1) {
      const node = this.state.nodes[index];
      const bounds = this.effectiveNodeBounds(node);
      if (this.pointInRect(point, bounds)) return node;
    }
    return null;
  }

  private hitRegion(point: WorldPoint): CanvasRegion | null {
    if (!this.state) return null;
    return this.state.regions
      .filter((region) => this.pointInRect(point, this.effectiveRegionBounds(region)))
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
  }

  private hitRegionHeader(point: WorldPoint): CanvasRegion | null {
    if (!this.state) return null;
    return this.state.regions
      .filter((region) => {
        const bounds = this.effectiveRegionBounds(region);
        return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + REGION_HEADER_HEIGHT;
      })
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
  }

  private hitEdge(point: WorldPoint): CanvasConnection | null {
    if (!this.state) return null;
    const tolerance = 10 / Math.max(this.camera.scale, 0.2);
    let closest: CanvasConnection | null = null;
    let closestDistance = tolerance;
    for (const edge of this.state.connections) {
      const from = this.nodeById.get(edge.fromNodeId);
      const to = this.nodeById.get(edge.toNodeId);
      if (!from || !to) continue;
      const start = this.edgePoint(from, to);
      const end = this.edgePoint(to, from);
      const distance = this.distanceToBezier(point, start, end);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = edge;
      }
    }
    return closest;
  }

  private distanceToBezier(point: WorldPoint, start: WorldPoint, end: WorldPoint): number {
    const dx = end.x - start.x;
    const direction = Math.sign(dx || 1);
    const control = Math.max(60, Math.abs(dx) * 0.42);
    const c1 = { x: start.x + direction * control, y: start.y };
    const c2 = { x: end.x - direction * control, y: end.y };
    let minDistance = Infinity;
    const steps = 24;
    let previous = start;
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const point2 = this.cubicBezierPoint(start, c1, c2, end, t);
      minDistance = Math.min(minDistance, this.distanceToSegment(point, previous, point2));
      previous = point2;
    }
    return minDistance;
  }

  private cubicBezierPoint(p0: WorldPoint, p1: WorldPoint, p2: WorldPoint, p3: WorldPoint, t: number): WorldPoint {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    };
  }

  private distanceToSegment(point: WorldPoint, a: WorldPoint, b: WorldPoint): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(point.x - projX, point.y - projY);
  }

  private pointInRect(point: WorldPoint, rect: WorldBounds): boolean {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  }

  private pointInCircle(point: WorldPoint, center: WorldPoint, radius: number): boolean {
    return Math.hypot(point.x - center.x, point.y - center.y) <= radius;
  }

  private nodeResizeHandleWorld(node: CanvasNode): WorldBounds {
    const bounds = this.effectiveNodeBounds(node);
    const size = 17 / Math.max(this.camera.scale, 0.25);
    return { x: bounds.x + bounds.width - size / 2, y: bounds.y + bounds.height - size / 2, width: size, height: size };
  }

  private outputPortWorld(node: CanvasNode): { center: WorldPoint; radius: number } {
    const bounds = this.effectiveNodeBounds(node);
    const radius = (13 / Math.max(this.camera.scale, 0.25)) * 1.4;
    return { center: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, radius };
  }

  private regionResizeHandleWorld(region: CanvasRegion): WorldBounds {
    const bounds = this.effectiveRegionBounds(region);
    const size = 18 / Math.max(this.camera.scale, 0.25);
    return { x: bounds.x + bounds.width - size / 2, y: bounds.y + bounds.height - size / 2, width: size, height: size };
  }

  private nodeScreenBounds(node: CanvasNode): WorldBounds {
    const bounds = this.effectiveNodeBounds(node);
    const point = this.worldToScreen({ x: bounds.x, y: bounds.y });
    return { x: point.x, y: point.y, width: bounds.width * this.camera.scale, height: bounds.height * this.camera.scale };
  }

  private normalizedBounds(start: WorldPoint, end: WorldPoint): WorldBounds {
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
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

  private getImage(src: string): HTMLImageElement | null {
    let image = this.imageCache.get(src);
    if (!image) {
      image = new Image();
      image.src = src;
      image.onload = () => this.render();
      this.imageCache.set(src, image);
    }
    return image.complete && image.naturalWidth > 0 ? image : null;
  }

  private resolvedNode(node: CanvasNode): CanvasNode {
    if (!node.sourceNodeId || !this.state) return node;
    const original = this.nodeById.get(node.sourceNodeId);
    return original ? { ...node, title: original.title, imageSrc: original.imageSrc, tags: original.tags, color: original.color } : node;
  }

  private isConnectedToSelection(nodeId: string): boolean {
    if (!this.state) return false;
    const selected = this.state.selectedNodeIds;
    return selected.some((selectedId) =>
      (this.edgesByNodeId.get(selectedId) ?? []).some(
        (edge) => (edge.fromNodeId === selectedId && edge.toNodeId === nodeId) || (edge.toNodeId === selectedId && edge.fromNodeId === nodeId),
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

  private edgePoint(node: CanvasNode, other: CanvasNode): WorldPoint {
    const bounds = this.effectiveNodeBounds(node);
    const otherBounds = this.effectiveNodeBounds(other);
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const otherCenter = { x: otherBounds.x + otherBounds.width / 2, y: otherBounds.y + otherBounds.height / 2 };
    const dx = otherCenter.x - center.x;
    const dy = otherCenter.y - center.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      return { x: dx > 0 ? bounds.x + bounds.width : bounds.x, y: center.y };
    }
    return { x: center.x, y: dy > 0 ? bounds.y + bounds.height : bounds.y };
  }

  // ---- rendering ----------------------------------------------------------------

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
    this.render();
  }

  setSessionMode(active: boolean, sessionId: string | null = null): void {
    this.sessionMode = active;
    this.activeSessionId = sessionId;
    this.render();
  }

  setFocusMode(active: boolean): void {
    this.focusMode = active;
    this.render();
  }

  private computeFocusReachable(): Set<string> | null {
    if (!this.state) return null;
    const seeds = new Set<string>(this.state.selectedNodeIds);
    if (this.state.selectedConnectionId) {
      const edge = this.state.connections.find((candidate) => candidate.id === this.state!.selectedConnectionId);
      if (edge) {
        seeds.add(edge.fromNodeId);
        seeds.add(edge.toNodeId);
      }
    }
    if (!seeds.size) return null;
    const visited = new Set(seeds);
    const queue = [...seeds];
    while (queue.length) {
      const id = queue.shift()!;
      for (const edge of this.edgesByNodeId.get(id) ?? []) {
        const otherId = edge.fromNodeId === id ? edge.toNodeId : edge.fromNodeId;
        if (!visited.has(otherId)) {
          visited.add(otherId);
          queue.push(otherId);
        }
      }
    }
    return visited;
  }

  private updateFocusReachability(): void {
    this.focusReachable = this.focusMode ? this.computeFocusReachable() : null;
    this.focusRelatedRegions = null;
    if (!this.focusReachable || !this.state) return;
    const related = new Set<string>();
    for (const nodeId of this.focusReachable) {
      let regionId = this.nodeById.get(nodeId)?.regionId ?? null;
      while (regionId) {
        related.add(regionId);
        regionId = this.state.regions.find((region) => region.id === regionId)?.parentRegionId ?? null;
      }
    }
    this.focusRelatedRegions = related;
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx || !this.state) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(ratio * this.camera.scale, 0, 0, ratio * this.camera.scale, ratio * this.camera.x, ratio * this.camera.y);

    const viewport = cameraWorldBounds(this.camera, 420);
    const lod = semanticLod(this.camera.scale);
    this.updateFocusReachability();
    this.paintScene(ctx, viewport, lod);
    this.drawInteractionOverlay(ctx);
  }

  /** The static map itself — grid, regions, edges, nodes — with no selection
   * or in-progress-gesture overlay. Shared between the live render loop and
   * `exportImage`, which paints the same scene onto an offscreen canvas
   * under a temporary camera. */
  private paintScene(ctx: CanvasRenderingContext2D, viewport: WorldBounds, lod: string): void {
    if (!this.state) return;
    this.drawGrid(ctx, viewport);

    const visibleRegions = this.state.regions.filter((region) => intersects(viewport, this.effectiveRegionBounds(region)));
    for (const region of visibleRegions) this.drawRegion(ctx, region, lod);

    const candidates = this.nodeIndex.search(viewport);
    const visibleNodes = applyNodeRenderBudget(candidates, { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 });
    const visibleIds = new Set(visibleNodes.map((node) => node.id));

    if (lod !== "overview") {
      const edges = new Map<string, CanvasConnection>();
      for (const id of visibleIds) {
        for (const edge of this.edgesByNodeId.get(id) ?? []) edges.set(edge.id, edge);
      }
      for (const edge of edges.values()) this.drawEdge(ctx, edge, lod);
    }

    if (lod !== "overview") this.drawGroups(ctx);

    // Every node stays visible at every zoom level — LOD only changes how
    // much detail is drawn inside the box, never whether it exists on screen.
    for (const node of visibleNodes) this.drawNode(ctx, node, lod);
  }

  /**
   * Renders the map to a PNG data URL. "viewport" reuses exactly what is on
   * screen right now (no redraw needed); "all" fits the entire content into
   * an offscreen canvas under a temporary camera, then restores the live
   * camera — the visible canvas itself is never touched.
   */
  exportImage(scope: "viewport" | "all"): string | null {
    if (!this.state) return null;
    if (scope === "viewport") return this.canvas.toDataURL("image/png");

    const bounds = collectBounds(this.state.nodes, this.state.regions);
    const padding = 120;
    const safeWidth = Math.max(1, bounds.width + padding * 2);
    const safeHeight = Math.max(1, bounds.height + padding * 2);
    const maxEdge = 4000;
    const scale = Math.min(maxEdge / safeWidth, maxEdge / safeHeight, 2);
    const outputWidth = Math.max(1, Math.round(safeWidth * scale));
    const outputHeight = Math.max(1, Math.round(safeHeight * scale));

    const offscreen = document.createElement("canvas");
    offscreen.width = outputWidth;
    offscreen.height = outputHeight;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;

    const exportCamera: CameraState = {
      scale,
      x: -bounds.x * scale + padding * scale,
      y: -bounds.y * scale + padding * scale,
      viewportWidth: outputWidth,
      viewportHeight: outputHeight,
    };

    ctx.fillStyle = "#0a0d14";
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.setTransform(exportCamera.scale, 0, 0, exportCamera.scale, exportCamera.x, exportCamera.y);

    const previousCamera = this.camera;
    this.camera = exportCamera;
    this.paintScene(ctx, cameraWorldBounds(exportCamera, 50), semanticLod(exportCamera.scale));
    this.camera = previousCamera;

    return offscreen.toDataURL("image/png");
  }

  private drawGrid(ctx: CanvasRenderingContext2D, viewport: WorldBounds): void {
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
  }

  private drawRegion(ctx: CanvasRenderingContext2D, region: CanvasRegion, lod: string): void {
    const bounds = this.effectiveRegionBounds(region);
    const selected = this.state?.selectedRegionId === region.id;
    const dim = this.focusRelatedRegions && !this.focusRelatedRegions.has(region.id) ? 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = (region.kind === "session" ? 0.08 : 0.055) * dim;
    ctx.fillStyle = region.color;
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 24);
    ctx.fill();
    ctx.globalAlpha = (selected ? 0.95 : 0.58) * dim;
    ctx.strokeStyle = selected ? "#ffffff" : region.color;
    ctx.lineWidth = (selected ? 5 : 3) / this.camera.scale;
    ctx.stroke();
    ctx.globalAlpha = 0.82 * dim;
    ctx.fillStyle = region.color;
    ctx.font = `700 ${lod === "overview" ? Math.max(56, 22 / this.camera.scale) : 28}px Inter, system-ui, sans-serif`;
    ctx.fillText(region.title, bounds.x + 22, bounds.y + 46);
    ctx.restore();

    if (selected && !this.sessionMode) {
      const handle = this.regionResizeHandleWorld(region);
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.96;
      ctx.beginPath();
      ctx.roundRect(handle.x, handle.y, handle.width, handle.height, handle.width * 0.2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = region.color;
      ctx.lineWidth = 2 / Math.max(this.camera.scale, 0.25);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawEdge(ctx: CanvasRenderingContext2D, edge: CanvasConnection, lod: string): void {
    if (!this.state) return;
    const from = this.nodeById.get(edge.fromNodeId);
    const to = this.nodeById.get(edge.toNodeId);
    if (!from || !to) return;

    const selectedNodes = this.state.selectedNodeIds;
    const edgeSelected = this.state.selectedConnectionId === edge.id;
    const focused = selectedNodes.length > 0 || Boolean(this.state.selectedConnectionId);
    const related = this.focusReachable
      ? this.focusReachable.has(from.id) && this.focusReachable.has(to.id)
      : edgeSelected || selectedNodes.includes(from.id) || selectedNodes.includes(to.id);
    const alpha = this.focusReachable
      ? (related ? 0.95 : 0.05)
      : focused
        ? (related ? 0.95 : 0.08)
        : edge.relation === "reference" ? 0.45 : 0.7;
    const start = this.edgePoint(from, to);
    const end = this.edgePoint(to, from);
    const dx = end.x - start.x;
    const direction = Math.sign(dx || 1);
    const control = Math.max(60, Math.abs(dx) * 0.42);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = edgeSelected ? "#ffffff" : edge.color;
    ctx.lineWidth = (edgeSelected ? 5 : related ? 3.5 : 2.2) / Math.max(this.camera.scale, 0.2);
    // Each connection type reads differently at a glance, independent of
    // color: flow is a solid line with a solid arrow, condition is dashed
    // with a diamond tip (a branch, not a straight path), reference is
    // finely dotted with a hollow dot (a soft pointer, not a direction).
    if (edge.relation === "condition") ctx.setLineDash([10 / this.camera.scale, 6 / this.camera.scale]);
    else if (edge.relation === "reference") ctx.setLineDash([2 / this.camera.scale, 5 / this.camera.scale]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(start.x + direction * control, start.y, end.x - direction * control, end.y, end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const size = 11 / Math.max(this.camera.scale, 0.25);
    ctx.fillStyle = edgeSelected ? "#ffffff" : edge.color;
    if (edge.relation === "condition") {
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - Math.cos(angle - Math.PI / 4) * size, end.y - Math.sin(angle - Math.PI / 4) * size);
      ctx.lineTo(end.x - Math.cos(angle) * size * 1.7, end.y - Math.sin(angle) * size * 1.7);
      ctx.lineTo(end.x - Math.cos(angle + Math.PI / 4) * size, end.y - Math.sin(angle + Math.PI / 4) * size);
      ctx.closePath();
      ctx.fill();
    } else if (edge.relation === "reference") {
      const cx = end.x - Math.cos(angle) * size * 0.7;
      const cy = end.y - Math.sin(angle) * size * 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#0a0d14";
      ctx.fill();
      ctx.lineWidth = 1.6 / Math.max(this.camera.scale, 0.25);
      ctx.strokeStyle = edgeSelected ? "#ffffff" : edge.color;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - Math.cos(angle - Math.PI / 6) * size, end.y - Math.sin(angle - Math.PI / 6) * size);
      ctx.lineTo(end.x - Math.cos(angle + Math.PI / 6) * size, end.y - Math.sin(angle + Math.PI / 6) * size);
      ctx.closePath();
      ctx.fill();
    }

    if (edge.label && lod === "detail") {
      ctx.fillStyle = "#b7c0d5";
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(edge.label, (start.x + end.x) / 2, (start.y + end.y) / 2 - 10);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  private drawNode(ctx: CanvasRenderingContext2D, sourceNode: CanvasNode, lod: string): void {
    const node = this.resolvedNode(sourceNode);
    const bounds = this.effectiveNodeBounds(sourceNode);
    const selected = this.state?.selectedNodeIds.includes(node.id) ?? false;
    const hasFocusedSelection = Boolean(this.state?.selectedNodeIds.length);
    const related = this.focusReachable
      ? this.focusReachable.has(node.id)
      : !hasFocusedSelection || selected || this.isConnectedToSelection(node.id);
    const dimAlpha = this.focusReachable ? 0.06 : 0.22;
    const progress = this.state?.sessionProgress[node.id] ?? "pending";
    const inActiveSession = !this.sessionMode || this.nodeIsInActiveSession(node);
    const accent = progress === "completed" ? "#34d399" : progress === "active" ? "#fbbf24" : TYPE_COLORS[node.kind];

    ctx.save();
    ctx.globalAlpha = inActiveSession ? (related ? 1 : dimAlpha) : 0.1;

    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 15);
    ctx.fill();
    ctx.strokeStyle = selected ? "#ffffff" : accent;
    ctx.lineWidth = selected ? 4 : 2;
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, 7, bounds.height, 4);
    ctx.fill();

    if (node.sourceNodeId) {
      ctx.fillStyle = "#38bdf8";
      ctx.globalAlpha = (inActiveSession ? (related ? 1 : dimAlpha) : 0.1) * 0.95;
      ctx.beginPath();
      ctx.arc(bounds.x + bounds.width - 20, bounds.y + 20, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = inActiveSession ? (related ? 1 : dimAlpha) : 0.1;
    }

    if (lod !== "overview") {
      const iconX = bounds.x + bounds.width - (node.sourceNodeId ? 42 : 20);
      const iconY = bounds.y + 20;
      ctx.fillStyle = "#0009";
      ctx.beginPath();
      ctx.arc(iconX, iconY, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "12px 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif";
      ctx.fillText(TYPE_ICONS[node.kind], iconX, iconY + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    const image = node.imageSrc && lod === "detail" ? this.getImage(node.imageSrc) : null;
    const hasImage = Boolean(image);
    ctx.fillStyle = "#f7f8ff";
    ctx.font = `600 ${lod === "region" ? 22 : 19}px Inter, system-ui, sans-serif`;
    this.fillWrappedText(ctx, node.title || "Sem título", bounds.x + 22, bounds.y + 39, bounds.width - (hasImage ? 112 : 42), 24, 2);

    if (image) {
      const availableHeight = clamp(bounds.height - 28, 44, 84);
      ctx.save();
      ctx.globalAlpha = (inActiveSession ? (related ? 1 : dimAlpha) : 0.1) * 0.92;
      ctx.beginPath();
      ctx.roundRect(bounds.x + bounds.width - availableHeight - 14, bounds.y + 14, availableHeight, availableHeight, 8);
      ctx.clip();
      ctx.drawImage(image, bounds.x + bounds.width - availableHeight - 14, bounds.y + 14, availableHeight, availableHeight);
      ctx.restore();
    }

    if (lod === "detail" && node.body) {
      ctx.fillStyle = "#aeb8ce";
      ctx.font = "13px Inter, system-ui, sans-serif";
      this.fillWrappedText(ctx, node.body, bounds.x + 22, bounds.y + 76, bounds.width - 42, 18, 3);
    }

    if (progress !== "pending") {
      ctx.fillStyle = progress === "completed" ? "#34d399" : "#fbbf24";
      ctx.font = "800 22px Inter, system-ui, sans-serif";
      ctx.fillText(progress === "completed" ? "✓" : "▶", bounds.x + bounds.width - 34, bounds.y + bounds.height - 14);
    }
    ctx.restore();

    if (selected && !this.sessionMode) {
      const controlSize = 13 / Math.max(this.camera.scale, 0.25);
      ctx.save();
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(bounds.x, bounds.y + bounds.height / 2, controlSize * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#c4b5fd";
      ctx.lineWidth = 2 / Math.max(this.camera.scale, 0.25);
      ctx.stroke();

      ctx.fillStyle = "#c4b5fd";
      ctx.beginPath();
      ctx.arc(bounds.x + bounds.width, bounds.y + bounds.height / 2, controlSize * 0.62, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111827";
      ctx.stroke();
      ctx.restore();

      if (this.state?.selectedNodeIds.length === 1) {
        const handle = this.nodeResizeHandleWorld(sourceNode);
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.96;
        ctx.beginPath();
        ctx.roundRect(handle.x, handle.y, handle.width, handle.height, handle.width * 0.2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2 / Math.max(this.camera.scale, 0.25);
        ctx.stroke();
        ctx.restore();
      }
    }
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

  private drawInteractionOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.selection) {
      const bounds = this.normalizedBounds(this.selection.start, this.selection.end);
      ctx.save();
      ctx.fillStyle = "#a78bfa";
      ctx.globalAlpha = 0.1;
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "#c4b5fd";
      ctx.lineWidth = 1.5 / this.camera.scale;
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      ctx.restore();
    }
    if (this.connectionDraft) {
      const { start, end } = this.connectionDraft;
      const dx = end.x - start.x;
      const direction = Math.sign(dx || 1);
      const control = Math.max(60, Math.abs(dx) * 0.42);
      ctx.save();
      ctx.strokeStyle = "#c4b5fd";
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 3 / Math.max(this.camera.scale, 0.2);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.bezierCurveTo(start.x + direction * control, start.y, end.x - direction * control, end.y, end.x, end.y);
      ctx.stroke();
      ctx.restore();
    }
    if (this.snapGuideX !== null || this.snapGuideY !== null) {
      const viewport = cameraWorldBounds(this.camera, 200);
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1 / this.camera.scale;
      if (this.snapGuideX !== null) {
        ctx.beginPath();
        ctx.moveTo(this.snapGuideX, viewport.y);
        ctx.lineTo(this.snapGuideX, viewport.y + viewport.height);
        ctx.stroke();
      }
      if (this.snapGuideY !== null) {
        ctx.beginPath();
        ctx.moveTo(viewport.x, this.snapGuideY);
        ctx.lineTo(viewport.x + viewport.width, this.snapGuideY);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Subtle dashed bounding box behind every node group with 2+ members —
   * enough to show they move together, without the visual weight of a
   * region (no fill, no title, no header). */
  private drawGroups(ctx: CanvasRenderingContext2D): void {
    if (!this.state || this.sessionMode) return;
    const byGroup = new Map<string, CanvasNode[]>();
    for (const node of this.state.nodes) {
      if (!node.groupId) continue;
      const list = byGroup.get(node.groupId);
      if (list) list.push(node);
      else byGroup.set(node.groupId, [node]);
    }
    for (const members of byGroup.values()) {
      if (members.length < 2) continue;
      const bounds = members.map((member) => this.effectiveNodeBounds(member));
      const x = Math.min(...bounds.map((b) => b.x)) - 14;
      const y = Math.min(...bounds.map((b) => b.y)) - 14;
      const right = Math.max(...bounds.map((b) => b.x + b.width)) + 14;
      const bottom = Math.max(...bounds.map((b) => b.y + b.height)) + 14;
      ctx.save();
      ctx.strokeStyle = "#a78bfa";
      ctx.globalAlpha = 0.4;
      ctx.setLineDash([8 / this.camera.scale, 6 / this.camera.scale]);
      ctx.lineWidth = 1.5 / this.camera.scale;
      ctx.beginPath();
      ctx.roundRect(x, y, right - x, bottom - y, 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- camera & coordinates ------------------------------------------------------

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
    // size. Fitting against a near-zero viewport would permanently send the
    // camera to the minimum zoom, so wait for a real size instead.
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
      // Only x/y/scale are interpolated — viewport width/height always come
      // from the latest ResizeObserver reading via the object spread below,
      // never from the (possibly stale) animation target.
      this.camera = {
        ...this.camera,
        x: start.x + (target.x - start.x) * eased,
        y: start.y + (target.y - start.y) * eased,
        scale: start.scale + (target.scale - start.scale) * eased,
      };
      this.render();
      this.callbacks.onCameraChange(this.getCamera());
      if (raw < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  destroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    if (this.initialized) {
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("wheel", this.onWheel);
      this.canvas.removeEventListener("dblclick", this.onDoubleClick);
      this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    }
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.remove();
  }
}
