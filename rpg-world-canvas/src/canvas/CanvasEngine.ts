import { cameraForBounds, cameraWorldBounds, clampScale, collectBounds, intersects, selectionBounds, semanticLod } from "../domain/spatial";
import { SpatialIndex } from "../domain/SpatialIndex";
import { applyEntityRenderBudget } from "../domain/renderBudget";
import { kindConfig } from "../domain/entityKindRegistry";
import { relationConfig } from "../domain/relationTypeRegistry";
import type { CameraState, Entity, Relation, WorldBounds, WorldPoint } from "../domain/types";

/** Everything the engine needs to draw and hit-test one frame. Deliberately
 * narrower than the full CampaignState — the engine doesn't know about
 * views, sessions or undo history, only "these entities/relations, this
 * selection". CanvasSurface is responsible for filtering by the active view
 * before handing data in here. */
export interface CanvasRenderState {
  entities: Entity[];
  relations: Relation[];
  selectedEntityIds: string[];
  selectedRelationId: string | null;
  /** Focus Mode: when set, only entities/relations inside this set render
   * at full opacity — everything else dims, regardless of selection. */
  focusSet?: Set<string> | null;
}

export interface CanvasEngineCallbacks {
  onCameraChange: (camera: CameraState) => void;
  onCreateEntity: (point: WorldPoint, screen: WorldPoint) => void;
  onSelectEntity: (id: string, additive: boolean) => void;
  onSelectEntities: (ids: string[], additive: boolean) => void;
  onSelectRelation: (id: string) => void;
  onContextMenu: (target: CanvasContextTarget) => void;
  onClearSelection: () => void;
  onMoveEntities: (moves: Array<{ id: string; x: number; y: number }>) => void;
  onResizeEntity: (id: string, bounds: WorldBounds) => void;
  onMoveGroup: (id: string, point: WorldPoint) => void;
  onCreateRelation: (fromId: string, toId: string) => void;
  onEditEntity: (id: string, screenBounds: WorldBounds) => void;
  onDuplicateEntitiesInPlace: (ids: string[]) => Array<{ id: string; x: number; y: number }>;
}

export interface CanvasContextTarget {
  kind: "canvas" | "entity" | "group";
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

interface GroupDragState extends DragState {
  id: string;
  groupIds: Set<string>;
  childPositions: Map<string, WorldPoint>;
}

interface SelectionState {
  start: WorldPoint;
  end: WorldPoint;
  additive: boolean;
}

interface RelationDraft {
  fromId: string;
  start: WorldPoint;
  end: WorldPoint;
}

const NODE_MIN_WIDTH = 80;
const NODE_MAX_WIDTH = 1600;
const NODE_MIN_HEIGHT = 60;
const NODE_MAX_HEIGHT = 1600;
const GROUP_MIN_WIDTH = 300;
const GROUP_MAX_WIDTH = 8000;
const GROUP_MIN_HEIGHT = 220;
const GROUP_MAX_HEIGHT = 8000;
const GROUP_HEADER_HEIGHT = 56;
const SNAP_TOLERANCE_PX = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * CanvasEngine is the single source of truth for rendering, coordinates,
 * hit-testing, camera and every visual interaction on the canvas. It draws
 * directly onto one visible <canvas> and reads pointer events from that
 * same element — the lesson learned the hard way in RPG Canvas Studio,
 * where three separate layers (a visible-but-inert canvas, a visible SVG,
 * and an invisible interactive layer) drifted out of sync mid-gesture.
 * There is exactly one canvas here from day one.
 */
export class CanvasEngine {
  private host: HTMLElement;
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D | null = null;
  private callbacks: CanvasEngineCallbacks;
  private state: CanvasRenderState | null = null;
  private camera: CameraState = { x: 0, y: 0, scale: 0.75, viewportWidth: 1, viewportHeight: 1 };
  private isPanning = false;
  private panOrigin = { x: 0, y: 0, cameraX: 0, cameraY: 0 };
  private drag: DragState | null = null;
  private resize: ResizeState | null = null;
  private groupDrag: GroupDragState | null = null;
  private groupResize: ResizeState | null = null;
  private selection: SelectionState | null = null;
  private relationDraft: RelationDraft | null = null;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private spacePressed = false;
  private initialized = false;
  private cardIndex = new SpatialIndex<Entity>();
  private entityById = new Map<string, Entity>();
  private relationsByEntityId = new Map<string, Relation[]>();
  /** Alignment guide lines currently matched while dragging — world-space
   * X/Y of whichever edge/center is aligned, or null on that axis. */
  private snapGuides: { x: number | null; y: number | null } = { x: null, y: null };
  private initialFitDone = false;
  private cameraAnimationId = 0;
  private imageCache = new Map<string, HTMLImageElement>();

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
        this.relationDraft || this.resize || this.groupResize || this.drag || this.groupDrag || this.selection,
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

  private capture(pointerId: number): void {
    try {
      this.canvas.setPointerCapture(pointerId);
    } catch {
      // Best-effort; ignore when unsupported (e.g. tests).
    }
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

    if (this.state.selectedEntityIds.length === 1) {
      const entity = this.entityById.get(this.state.selectedEntityIds[0]);
      if (entity && entity.kind !== "group") {
        const port = this.outputPortWorld(entity);
        if (this.pointInCircle(world, port.center, port.radius)) {
          this.capture(event.pointerId);
          const start = { x: entity.x + entity.width, y: entity.y + entity.height / 2 };
          this.relationDraft = { fromId: entity.id, start, end: world };
          this.render();
          return;
        }
        const handle = this.entityResizeHandleWorld(entity);
        if (this.pointInRect(world, handle)) {
          this.capture(event.pointerId);
          this.resize = { id: entity.id, pointerStart: world, bounds: { x: entity.x, y: entity.y, width: entity.width, height: entity.height }, width: entity.width, height: entity.height };
          return;
        }
      }
    }

    if (this.state.selectedEntityIds.length === 1) {
      const group = this.entityById.get(this.state.selectedEntityIds[0]);
      if (group && group.kind === "group") {
        const handle = this.entityResizeHandleWorld(group);
        if (this.pointInRect(world, handle)) {
          this.capture(event.pointerId);
          this.groupResize = { id: group.id, pointerStart: world, bounds: { x: group.x, y: group.y, width: group.width, height: group.height }, width: group.width, height: group.height };
          return;
        }
      }
    }

    const hitCard = this.hitCard(world);
    if (hitCard) {
      this.capture(event.pointerId);
      if (event.altKey) {
        const sourceIds = this.state.selectedEntityIds.includes(hitCard.id) ? this.state.selectedEntityIds : [hitCard.id];
        const copies = this.callbacks.onDuplicateEntitiesInPlace(sourceIds);
        if (copies.length) {
          const positions = new Map(copies.map((copy) => [copy.id, { x: copy.x, y: copy.y }]));
          this.drag = { pointerStart: world, positions, dx: 0, dy: 0 };
        }
        return;
      }
      this.callbacks.onSelectEntity(hitCard.id, Boolean(event.shiftKey));
      if (!this.state.selectedEntityIds.includes(hitCard.id)) return;
      const positions = new Map(
        this.state.entities.filter((candidate) => this.state?.selectedEntityIds.includes(candidate.id)).map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]),
      );
      this.drag = { pointerStart: world, positions, dx: 0, dy: 0 };
      return;
    }

    const relation = this.hitRelation(world);
    if (relation) {
      this.callbacks.onSelectRelation(relation.id);
      this.render();
      return;
    }

    const group = this.hitGroupHeader(world);
    if (group) {
      this.capture(event.pointerId);
      this.callbacks.onSelectEntity(group.id, false);
      const groupIds = this.descendantGroupIds(group.id);
      const positions = new Map(this.state.entities.filter((candidate) => candidate.kind === "group" && groupIds.has(candidate.id)).map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]));
      const childPositions = new Map(this.state.entities.filter((candidate) => candidate.groupId && groupIds.has(candidate.groupId)).map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]));
      this.groupDrag = { id: group.id, pointerStart: world, positions, childPositions, groupIds, dx: 0, dy: 0 };
      return;
    }

    this.capture(event.pointerId);
    this.selection = { start: world, end: world, additive: Boolean(event.shiftKey) };
    if (!event.shiftKey) this.callbacks.onClearSelection();
    this.render();
  };

  private onPointerMove = (event: PointerEvent): void => {
    const screen = this.eventPoint(event);
    const world = this.screenToWorld(screen);

    if (this.relationDraft) {
      this.relationDraft.end = world;
      this.render();
      return;
    }
    if (this.resize) {
      this.resize.width = clamp(this.resize.bounds.width + world.x - this.resize.pointerStart.x, NODE_MIN_WIDTH, NODE_MAX_WIDTH);
      this.resize.height = clamp(this.resize.bounds.height + world.y - this.resize.pointerStart.y, NODE_MIN_HEIGHT, NODE_MAX_HEIGHT);
      this.render();
      return;
    }
    if (this.groupResize) {
      this.groupResize.width = clamp(this.groupResize.bounds.width + world.x - this.groupResize.pointerStart.x, GROUP_MIN_WIDTH, GROUP_MAX_WIDTH);
      this.groupResize.height = clamp(this.groupResize.bounds.height + world.y - this.groupResize.pointerStart.y, GROUP_MIN_HEIGHT, GROUP_MAX_HEIGHT);
      this.render();
      return;
    }
    if (this.drag) {
      this.drag.dx = world.x - this.drag.pointerStart.x;
      this.drag.dy = world.y - this.drag.pointerStart.y;
      this.applyDragSnap();
      this.render();
      return;
    }
    if (this.groupDrag) {
      this.groupDrag.dx = world.x - this.groupDrag.pointerStart.x;
      this.groupDrag.dy = world.y - this.groupDrag.pointerStart.y;
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
    if (this.state.selectedEntityIds.length === 1) {
      const entity = this.entityById.get(this.state.selectedEntityIds[0]);
      if (entity) {
        if (entity.kind !== "group") {
          const port = this.outputPortWorld(entity);
          if (this.pointInCircle(world, port.center, port.radius)) {
            this.canvas.style.cursor = "crosshair";
            return;
          }
        }
        if (this.pointInRect(world, this.entityResizeHandleWorld(entity))) {
          this.canvas.style.cursor = "nwse-resize";
          return;
        }
      }
    }
    if (this.hitCard(world)) {
      this.canvas.style.cursor = "grab";
      return;
    }
    if (this.hitRelation(world)) {
      this.canvas.style.cursor = "pointer";
      return;
    }
    if (this.hitGroupHeader(world)) {
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
        // Already released by the browser.
      }
    }
    this.finalizeGesture(true);
  };

  private finalizeGesture(commit: boolean): void {
    if (this.relationDraft) {
      const draft = this.relationDraft;
      this.relationDraft = null;
      if (commit) {
        const target = this.hitCard(draft.end);
        if (target && target.id !== draft.fromId) this.callbacks.onCreateRelation(draft.fromId, target.id);
      }
    }
    if (this.resize) {
      const { id, bounds, width, height } = this.resize;
      this.resize = null;
      if (commit && (width !== bounds.width || height !== bounds.height)) this.callbacks.onResizeEntity(id, { ...bounds, width, height });
    }
    if (this.groupResize) {
      const { id, bounds, width, height } = this.groupResize;
      this.groupResize = null;
      if (commit && (width !== bounds.width || height !== bounds.height)) this.callbacks.onResizeEntity(id, { ...bounds, width, height });
    }
    if (this.drag) {
      const { positions, dx, dy } = this.drag;
      this.drag = null;
      this.snapGuides = { x: null, y: null };
      if (commit && (dx !== 0 || dy !== 0)) this.callbacks.onMoveEntities([...positions].map(([id, position]) => ({ id, x: position.x + dx, y: position.y + dy })));
    }
    if (this.groupDrag) {
      const { id, positions, dx, dy } = this.groupDrag;
      this.groupDrag = null;
      const position = positions.get(id);
      if (commit && position && (dx !== 0 || dy !== 0)) this.callbacks.onMoveGroup(id, { x: position.x + dx, y: position.y + dy });
    }
    if (this.selection) {
      const selection = this.selection;
      this.selection = null;
      if (commit) {
        const bounds = this.normalizedBounds(selection.start, selection.end);
        if (bounds.width > 4 / this.camera.scale || bounds.height > 4 / this.camera.scale) {
          const ids = this.cardIndex.search(bounds).map((entity) => entity.id);
          this.callbacks.onSelectEntities(ids, selection.additive);
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
    const hit = this.hitCard(world);
    if (hit) {
      this.callbacks.onEditEntity(hit.id, this.entityScreenBounds(hit));
      return;
    }
    this.callbacks.onCreateEntity({ x: world.x - 120, y: world.y - 40 }, screen);
  };

  private onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    const screen = this.eventPoint(event);
    const world = this.screenToWorld(screen);
    const card = this.hitCard(world);
    if (card) {
      this.callbacks.onSelectEntity(card.id, false);
      this.callbacks.onContextMenu({ kind: "entity", id: card.id, world, screen });
      return;
    }
    const group = this.hitGroup(world);
    if (group) {
      this.callbacks.onSelectEntity(group.id, false);
      this.callbacks.onContextMenu({ kind: "group", id: group.id, world, screen });
      return;
    }
    this.callbacks.onClearSelection();
    this.callbacks.onContextMenu({ kind: "canvas", id: null, world, screen });
  };

  // ---- geometry & hit testing -------------------------------------------------

  private effectiveBounds(entity: Entity): WorldBounds {
    if (entity.kind === "group") {
      if (this.groupResize && this.groupResize.id === entity.id) {
        return { x: this.groupResize.bounds.x, y: this.groupResize.bounds.y, width: this.groupResize.width, height: this.groupResize.height };
      }
      if (this.groupDrag) {
        const position = this.groupDrag.positions.get(entity.id);
        if (position) return { x: position.x + this.groupDrag.dx, y: position.y + this.groupDrag.dy, width: entity.width, height: entity.height };
      }
      return { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
    }
    if (this.resize && this.resize.id === entity.id) {
      return { x: this.resize.bounds.x, y: this.resize.bounds.y, width: this.resize.width, height: this.resize.height };
    }
    if (this.drag) {
      const position = this.drag.positions.get(entity.id);
      if (position) return { x: position.x + this.drag.dx, y: position.y + this.drag.dy, width: entity.width, height: entity.height };
    }
    if (this.groupDrag) {
      const position = this.groupDrag.childPositions.get(entity.id);
      if (position) return { x: position.x + this.groupDrag.dx, y: position.y + this.groupDrag.dy, width: entity.width, height: entity.height };
    }
    return { x: entity.x, y: entity.y, width: entity.width, height: entity.height };
  }

  /** Snap-to-align while dragging: nudges `this.drag.dx/dy` so the dragged
   * entity/entities' edges or centers line up with any other visible card
   * within a small screen-space tolerance, and records where to draw the
   * guide line. Independent per axis — X and Y can each snap or not. */
  private applyDragSnap(): void {
    if (!this.drag || !this.state) return;
    const draggedIds = new Set(this.drag.positions.keys());
    const bbox = this.draggedUnionBounds(draggedIds);
    if (!bbox) {
      this.snapGuides = { x: null, y: null };
      return;
    }
    const tolerance = SNAP_TOLERANCE_PX / Math.max(this.camera.scale, 0.05);
    const draggedX = [bbox.x, bbox.x + bbox.width / 2, bbox.x + bbox.width];
    const draggedY = [bbox.y, bbox.y + bbox.height / 2, bbox.y + bbox.height];
    let bestX: { delta: number; guide: number } | null = null;
    let bestY: { delta: number; guide: number } | null = null;

    for (const entity of this.state.entities) {
      if (entity.kind === "group" || draggedIds.has(entity.id)) continue;
      const bounds = this.effectiveBounds(entity);
      const candidatesX = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
      const candidatesY = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];
      for (const dx of draggedX) {
        for (const cx of candidatesX) {
          const delta = cx - dx;
          if (Math.abs(delta) <= tolerance && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) bestX = { delta, guide: cx };
        }
      }
      for (const dy of draggedY) {
        for (const cy of candidatesY) {
          const delta = cy - dy;
          if (Math.abs(delta) <= tolerance && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) bestY = { delta, guide: cy };
        }
      }
    }

    if (bestX) this.drag.dx += bestX.delta;
    if (bestY) this.drag.dy += bestY.delta;
    this.snapGuides = { x: bestX ? bestX.guide : null, y: bestY ? bestY.guide : null };
  }

  private draggedUnionBounds(ids: Set<string>): WorldBounds | null {
    let box: WorldBounds | null = null;
    for (const id of ids) {
      const entity = this.entityById.get(id);
      if (!entity) continue;
      const bounds = this.effectiveBounds(entity);
      if (!box) {
        box = { ...bounds };
      } else {
        const right = Math.max(box.x + box.width, bounds.x + bounds.width);
        const bottom = Math.max(box.y + box.height, bounds.y + bounds.height);
        box.x = Math.min(box.x, bounds.x);
        box.y = Math.min(box.y, bounds.y);
        box.width = right - box.x;
        box.height = bottom - box.y;
      }
    }
    return box;
  }

  private hitCard(point: WorldPoint): Entity | null {
    if (!this.state) return null;
    for (let index = this.state.entities.length - 1; index >= 0; index -= 1) {
      const entity = this.state.entities[index];
      if (entity.kind === "group") continue;
      if (this.pointInRect(point, this.effectiveBounds(entity))) return entity;
    }
    return null;
  }

  private hitGroup(point: WorldPoint): Entity | null {
    if (!this.state) return null;
    return this.state.entities
      .filter((entity) => entity.kind === "group" && this.pointInRect(point, this.effectiveBounds(entity)))
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
  }

  private hitGroupHeader(point: WorldPoint): Entity | null {
    if (!this.state) return null;
    return this.state.entities
      .filter((entity) => {
        if (entity.kind !== "group") return false;
        const bounds = this.effectiveBounds(entity);
        return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + GROUP_HEADER_HEIGHT;
      })
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
  }

  private hitRelation(point: WorldPoint): Relation | null {
    if (!this.state) return null;
    const tolerance = 10 / Math.max(this.camera.scale, 0.2);
    let closest: Relation | null = null;
    let closestDistance = tolerance;
    for (const relation of this.state.relations) {
      const from = this.entityById.get(relation.fromEntityId);
      const to = this.entityById.get(relation.toEntityId);
      if (!from || !to || from.kind === "group" || to.kind === "group") continue;
      const start = this.edgePoint(from, to);
      const end = this.edgePoint(to, from);
      const distance = this.distanceToBezier(point, start, end);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = relation;
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
    return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
  }

  private distanceToSegment(point: WorldPoint, a: WorldPoint, b: WorldPoint): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
  }

  private pointInRect(point: WorldPoint, rect: WorldBounds): boolean {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  }

  private pointInCircle(point: WorldPoint, center: WorldPoint, radius: number): boolean {
    return Math.hypot(point.x - center.x, point.y - center.y) <= radius;
  }

  private entityResizeHandleWorld(entity: Entity): WorldBounds {
    const bounds = this.effectiveBounds(entity);
    const size = (entity.kind === "group" ? 18 : 17) / Math.max(this.camera.scale, 0.25);
    return { x: bounds.x + bounds.width - size / 2, y: bounds.y + bounds.height - size / 2, width: size, height: size };
  }

  private outputPortWorld(entity: Entity): { center: WorldPoint; radius: number } {
    const bounds = this.effectiveBounds(entity);
    const radius = (13 / Math.max(this.camera.scale, 0.25)) * 1.4;
    return { center: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, radius };
  }

  private entityScreenBounds(entity: Entity): WorldBounds {
    const bounds = this.effectiveBounds(entity);
    const point = this.worldToScreen({ x: bounds.x, y: bounds.y });
    return { x: point.x, y: point.y, width: bounds.width * this.camera.scale, height: bounds.height * this.camera.scale };
  }

  private normalizedBounds(start: WorldPoint, end: WorldPoint): WorldBounds {
    return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
  }

  private descendantGroupIds(id: string): Set<string> {
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const entity of this.state?.entities ?? []) {
        if (entity.kind === "group" && entity.groupId && ids.has(entity.groupId) && !ids.has(entity.id)) {
          ids.add(entity.id);
          changed = true;
        }
      }
    }
    return ids;
  }

  private isConnectedToSelection(entityId: string): boolean {
    if (!this.state) return false;
    const selected = this.state.selectedEntityIds;
    return selected.some((selectedId) =>
      (this.relationsByEntityId.get(selectedId) ?? []).some((relation) => (relation.fromEntityId === selectedId && relation.toEntityId === entityId) || (relation.toEntityId === selectedId && relation.fromEntityId === entityId)),
    );
  }

  private edgePoint(entity: Entity, other: Entity): WorldPoint {
    const bounds = this.effectiveBounds(entity);
    const otherBounds = this.effectiveBounds(other);
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const otherCenter = { x: otherBounds.x + otherBounds.width / 2, y: otherBounds.y + otherBounds.height / 2 };
    const dx = otherCenter.x - center.x;
    const dy = otherCenter.y - center.y;
    if (Math.abs(dx) > Math.abs(dy)) return { x: dx > 0 ? bounds.x + bounds.width : bounds.x, y: center.y };
    return { x: center.x, y: dy > 0 ? bounds.y + bounds.height : bounds.y };
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

  // ---- rendering ----------------------------------------------------------------

  setState(state: CanvasRenderState): void {
    const entitiesChanged = state.entities !== this.state?.entities;
    const relationsChanged = state.relations !== this.state?.relations;
    this.state = state;
    if (entitiesChanged) {
      this.cardIndex.rebuild(state.entities.filter((entity) => entity.kind !== "group"));
      this.entityById = new Map(state.entities.map((entity) => [entity.id, entity]));
    }
    if (relationsChanged) {
      this.relationsByEntityId.clear();
      for (const relation of state.relations) {
        this.relationsByEntityId.set(relation.fromEntityId, [...(this.relationsByEntityId.get(relation.fromEntityId) ?? []), relation]);
        this.relationsByEntityId.set(relation.toEntityId, [...(this.relationsByEntityId.get(relation.toEntityId) ?? []), relation]);
      }
    }
    this.render();
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
    this.paintScene(ctx, viewport, lod);
    this.drawInteractionOverlay(ctx);
  }

  private paintScene(ctx: CanvasRenderingContext2D, viewport: WorldBounds, lod: string): void {
    if (!this.state) return;
    this.drawGrid(ctx, viewport);

    const groups = this.state.entities.filter((entity) => entity.kind === "group" && intersects(viewport, this.effectiveBounds(entity)));
    for (const group of groups) this.drawGroup(ctx, group, lod);

    const candidateCards = this.cardIndex.search(viewport);
    const visibleCards = applyEntityRenderBudget(candidateCards, { x: viewport.x + viewport.width / 2, y: viewport.y + viewport.height / 2 });
    const visibleIds = new Set(visibleCards.map((entity) => entity.id));

    if (lod !== "overview") {
      const relations = new Map<string, Relation>();
      for (const id of visibleIds) {
        for (const relation of this.relationsByEntityId.get(id) ?? []) relations.set(relation.id, relation);
      }
      for (const relation of relations.values()) this.drawRelation(ctx, relation, lod);
    }

    for (const entity of visibleCards) this.drawCard(ctx, entity, lod);
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

  private drawGroup(ctx: CanvasRenderingContext2D, group: Entity, lod: string): void {
    const bounds = this.effectiveBounds(group);
    const selected = this.state?.selectedEntityIds.includes(group.id) ?? false;
    const color = group.color ?? kindConfig("group").color;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 24);
    ctx.fill();
    ctx.globalAlpha = selected ? 0.95 : 0.55;
    ctx.strokeStyle = selected ? "#ffffff" : color;
    ctx.lineWidth = (selected ? 5 : 3) / this.camera.scale;
    ctx.stroke();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.font = `700 ${lod === "overview" ? Math.max(56, 22 / this.camera.scale) : 26}px Inter, system-ui, sans-serif`;
    ctx.fillText(group.title, bounds.x + 22, bounds.y + 42);
    ctx.restore();

    if (selected) {
      const handle = this.entityResizeHandleWorld(group);
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.96;
      ctx.beginPath();
      ctx.roundRect(handle.x, handle.y, handle.width, handle.height, handle.width * 0.2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / Math.max(this.camera.scale, 0.25);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawRelation(ctx: CanvasRenderingContext2D, relation: Relation, lod: string): void {
    if (!this.state) return;
    const from = this.entityById.get(relation.fromEntityId);
    const to = this.entityById.get(relation.toEntityId);
    if (!from || !to || from.kind === "group" || to.kind === "group") return;

    const config = relationConfig(relation.type);
    const selectedEntities = this.state.selectedEntityIds;
    const relationSelected = this.state.selectedRelationId === relation.id;
    const focusSet = this.state.focusSet;
    let related: boolean;
    let alpha: number;
    if (focusSet) {
      related = focusSet.has(from.id) && focusSet.has(to.id);
      alpha = related ? 0.95 : 0.06;
    } else {
      const focused = selectedEntities.length > 0 || Boolean(this.state.selectedRelationId);
      related = relationSelected || selectedEntities.includes(from.id) || selectedEntities.includes(to.id);
      alpha = focused ? (related ? 0.95 : 0.08) : 0.68;
    }
    const start = this.edgePoint(from, to);
    const end = this.edgePoint(to, from);
    const dx = end.x - start.x;
    const direction = Math.sign(dx || 1);
    const control = Math.max(60, Math.abs(dx) * 0.42);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = relationSelected ? "#ffffff" : config.color;
    ctx.lineWidth = (relationSelected ? 5 : related ? 3.5 : 2.2) / Math.max(this.camera.scale, 0.2);
    if (config.style === "dashed") ctx.setLineDash([10 / this.camera.scale, 6 / this.camera.scale]);
    else if (config.style === "dotted") ctx.setLineDash([2 / this.camera.scale, 5 / this.camera.scale]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(start.x + direction * control, start.y, end.x - direction * control, end.y, end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const size = 11 / Math.max(this.camera.scale, 0.25);
    ctx.fillStyle = relationSelected ? "#ffffff" : config.color;
    if (config.arrow === "diamond") {
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - Math.cos(angle - Math.PI / 4) * size, end.y - Math.sin(angle - Math.PI / 4) * size);
      ctx.lineTo(end.x - Math.cos(angle) * size * 1.7, end.y - Math.sin(angle) * size * 1.7);
      ctx.lineTo(end.x - Math.cos(angle + Math.PI / 4) * size, end.y - Math.sin(angle + Math.PI / 4) * size);
      ctx.closePath();
      ctx.fill();
    } else if (config.arrow === "circle") {
      const cx = end.x - Math.cos(angle) * size * 0.7;
      const cy = end.y - Math.sin(angle) * size * 0.7;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = "#0a0d14";
      ctx.fill();
      ctx.lineWidth = 1.6 / Math.max(this.camera.scale, 0.25);
      ctx.strokeStyle = relationSelected ? "#ffffff" : config.color;
      ctx.stroke();
    } else if (config.arrow === "triangle") {
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - Math.cos(angle - Math.PI / 6) * size, end.y - Math.sin(angle - Math.PI / 6) * size);
      ctx.lineTo(end.x - Math.cos(angle + Math.PI / 6) * size, end.y - Math.sin(angle + Math.PI / 6) * size);
      ctx.closePath();
      ctx.fill();
    }

    if (lod === "detail") {
      const text = relation.label || config.label;
      ctx.fillStyle = "#b7c0d5";
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(text, (start.x + end.x) / 2, (start.y + end.y) / 2 - 10);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }

  private drawCard(ctx: CanvasRenderingContext2D, entity: Entity, lod: string): void {
    const bounds = this.effectiveBounds(entity);
    const config = kindConfig(entity.kind);
    const accent = entity.color ?? config.color;
    const selected = this.state?.selectedEntityIds.includes(entity.id) ?? false;
    const focusSet = this.state?.focusSet;
    const hasFocusedSelection = Boolean(this.state?.selectedEntityIds.length);
    const related = focusSet ? focusSet.has(entity.id) : !hasFocusedSelection || selected || this.isConnectedToSelection(entity.id);

    ctx.save();
    ctx.globalAlpha = related ? 1 : (focusSet ? 0.1 : 0.22);

    ctx.fillStyle = "#171b28";
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

    if (lod !== "overview") {
      const iconX = bounds.x + bounds.width - 20;
      const iconY = bounds.y + 20;
      ctx.fillStyle = "#0009";
      ctx.beginPath();
      ctx.arc(iconX, iconY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "13px 'Segoe UI Emoji', 'Noto Color Emoji', system-ui, sans-serif";
      ctx.fillText(entity.icon ?? config.icon, iconX, iconY + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }

    const image = entity.imageSrc && lod === "detail" ? this.getImage(entity.imageSrc) : null;
    ctx.fillStyle = "#f7f8ff";
    ctx.font = `600 ${lod === "region" ? 22 : 19}px Inter, system-ui, sans-serif`;
    this.fillWrappedText(ctx, entity.title || "Sem título", bounds.x + 22, bounds.y + 39, bounds.width - (image ? 112 : 42), 24, 2);

    if (image) {
      const availableHeight = clamp(bounds.height - 28, 44, 84);
      ctx.save();
      ctx.globalAlpha *= 0.92;
      ctx.beginPath();
      ctx.roundRect(bounds.x + bounds.width - availableHeight - 14, bounds.y + 14, availableHeight, availableHeight, 8);
      ctx.clip();
      ctx.drawImage(image, bounds.x + bounds.width - availableHeight - 14, bounds.y + 14, availableHeight, availableHeight);
      ctx.restore();
    }

    if (lod === "detail" && entity.summary) {
      ctx.fillStyle = "#aeb8ce";
      ctx.font = "13px Inter, system-ui, sans-serif";
      this.fillWrappedText(ctx, entity.summary, bounds.x + 22, bounds.y + 76, bounds.width - 42, 18, 3);
    }

    if (lod === "detail" && entity.status) {
      ctx.fillStyle = accent;
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      ctx.fillText(entity.status.toUpperCase(), bounds.x + 22, bounds.y + bounds.height - 12);
    }
    ctx.restore();

    if (selected) {
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

      if (this.state?.selectedEntityIds.length === 1) {
        const handle = this.entityResizeHandleWorld(entity);
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

  private fillWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number): void {
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
    if (this.drag && (this.snapGuides.x !== null || this.snapGuides.y !== null)) {
      const viewport = cameraWorldBounds(this.camera, 420);
      ctx.save();
      ctx.strokeStyle = "#38bdf8";
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.5 / this.camera.scale;
      ctx.setLineDash([6 / this.camera.scale, 5 / this.camera.scale]);
      if (this.snapGuides.x !== null) {
        ctx.beginPath();
        ctx.moveTo(this.snapGuides.x, viewport.y);
        ctx.lineTo(this.snapGuides.x, viewport.y + viewport.height);
        ctx.stroke();
      }
      if (this.snapGuides.y !== null) {
        ctx.beginPath();
        ctx.moveTo(viewport.x, this.snapGuides.y);
        ctx.lineTo(viewport.x + viewport.width, this.snapGuides.y);
        ctx.stroke();
      }
      ctx.restore();
    }
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
    if (this.relationDraft) {
      const { start, end } = this.relationDraft;
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
  }

  // ---- camera & coordinates ------------------------------------------------------

  getCamera(): CameraState {
    return { ...this.camera };
  }

  getViewportCenter(): WorldPoint {
    return this.screenToWorld({ x: this.camera.viewportWidth / 2, y: this.camera.viewportHeight / 2 });
  }

  screenToWorld(point: WorldPoint): WorldPoint {
    return { x: (point.x - this.camera.x) / this.camera.scale, y: (point.y - this.camera.y) / this.camera.scale };
  }

  worldToScreen(point: WorldPoint): WorldPoint {
    return { x: point.x * this.camera.scale + this.camera.x, y: point.y * this.camera.scale + this.camera.y };
  }

  fitAll(): void {
    if (!this.state) return;
    const viewportWidth = this.host.clientWidth;
    const viewportHeight = this.host.clientHeight;
    if (viewportWidth < 100 || viewportHeight < 100) return;
    this.initialFitDone = true;
    this.camera.viewportWidth = viewportWidth;
    this.camera.viewportHeight = viewportHeight;
    const bounds = collectBounds(this.state.entities);
    this.animateCamera(cameraForBounds(bounds, viewportWidth, viewportHeight, 90));
  }

  /** Zoom/center on just the current selection instead of the whole
   * campaign — falls back to fitAll() when nothing (or only groups with no
   * other selection) is selected, since fitting an empty bounds box would
   * otherwise just re-center on the world origin. */
  fitSelection(): void {
    if (!this.state) return;
    const withBounds = this.state.entities.map((entity) => ({ id: entity.id, ...this.effectiveBounds(entity) }));
    const bounds = selectionBounds(withBounds, this.state.selectedEntityIds);
    if (!bounds) {
      this.fitAll();
      return;
    }
    const viewportWidth = this.host.clientWidth;
    const viewportHeight = this.host.clientHeight;
    if (viewportWidth < 100 || viewportHeight < 100) return;
    this.animateCamera(cameraForBounds(bounds, viewportWidth, viewportHeight, 120));
  }

  /** Renders the current selection (or every entity in the active view, if
   * nothing is selected) to a standalone PNG — reusing the exact same
   * paintScene()/drawCard()/drawRelation() the live Canvas uses, just onto
   * an offscreen canvas sized to fit the content instead of the viewport,
   * so exported cards look identical to what's on screen. Groups are
   * always included when any of their contents are, since a group with no
   * frame drawn around its children would look broken. */
  async exportPNG(): Promise<Blob | null> {
    if (!this.state) return null;
    const selected = this.state.selectedEntityIds;
    const baseTargets = selected.length ? this.state.entities.filter((entity) => selected.includes(entity.id)) : this.state.entities;
    if (!baseTargets.length) return null;
    const groupIds = new Set(baseTargets.filter((entity) => entity.kind === "group").map((entity) => entity.id));
    for (const entity of baseTargets) if (entity.groupId) groupIds.add(entity.groupId);
    const targets = groupIds.size
      ? this.state.entities.filter((entity) => baseTargets.includes(entity) || groupIds.has(entity.id))
      : baseTargets;

    const bounds = collectBounds(targets.map((entity) => this.effectiveBounds(entity)));
    const padding = 90;
    const exportScale = 2;
    const maxDimension = 6000;
    const width = Math.min(maxDimension, Math.round((bounds.width + padding * 2) * exportScale));
    const height = Math.min(maxDimension, Math.round((bounds.height + padding * 2) * exportScale));
    const scale = Math.min(exportScale, width / (bounds.width + padding * 2), height / (bounds.height + padding * 2));

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return null;

    exportCtx.fillStyle = "#090b12";
    exportCtx.fillRect(0, 0, width, height);

    // Rebuild the derived caches (cardIndex/entityById/relationsByEntityId)
    // for just the export subset, paint, then restore every one of them —
    // deliberately NOT calling setState()/render(), since either would
    // flash the live visible canvas with the export camera/content for a
    // frame before flashing back.
    const originalState = this.state;
    const originalCardIndex = this.cardIndex;
    const originalEntityById = this.entityById;
    const originalRelationsByEntityId = this.relationsByEntityId;
    const savedCamera = this.camera;

    const targetIds = new Set(targets.map((entity) => entity.id));
    const targetRelations = originalState.relations.filter((relation) => targetIds.has(relation.fromEntityId) && targetIds.has(relation.toEntityId));

    this.state = { entities: targets, relations: targetRelations, selectedEntityIds: [], selectedRelationId: null, focusSet: null };
    this.cardIndex = new SpatialIndex<Entity>();
    this.cardIndex.rebuild(targets.filter((entity) => entity.kind !== "group"));
    this.entityById = new Map(targets.map((entity) => [entity.id, entity]));
    this.relationsByEntityId = new Map();
    for (const relation of targetRelations) {
      this.relationsByEntityId.set(relation.fromEntityId, [...(this.relationsByEntityId.get(relation.fromEntityId) ?? []), relation]);
      this.relationsByEntityId.set(relation.toEntityId, [...(this.relationsByEntityId.get(relation.toEntityId) ?? []), relation]);
    }
    this.camera = { x: -bounds.x * scale + padding * scale, y: -bounds.y * scale + padding * scale, scale, viewportWidth: width, viewportHeight: height };
    exportCtx.setTransform(this.camera.scale, 0, 0, this.camera.scale, this.camera.x, this.camera.y);
    try {
      this.paintScene(exportCtx, { x: bounds.x - padding, y: bounds.y - padding, width: bounds.width + padding * 2, height: bounds.height + padding * 2 }, "detail");
    } finally {
      this.state = originalState;
      this.cardIndex = originalCardIndex;
      this.entityById = originalEntityById;
      this.relationsByEntityId = originalRelationsByEntityId;
      this.camera = savedCamera;
    }

    return new Promise((resolve) => exportCanvas.toBlob((blob) => resolve(blob), "image/png"));
  }

  focusEntity(id: string): void {
    const entity = this.state?.entities.find((candidate) => candidate.id === id);
    if (!entity) return;
    if (entity.kind === "group") {
      this.animateCamera(cameraForBounds(entity, this.camera.viewportWidth, this.camera.viewportHeight, 70));
      return;
    }
    const scale = Math.max(this.camera.scale, 0.85);
    this.animateCamera({ ...this.camera, scale, x: this.camera.viewportWidth / 2 - (entity.x + entity.width / 2) * scale, y: this.camera.viewportHeight / 2 - (entity.y + entity.height / 2) * scale });
  }

  centerOn(point: WorldPoint): void {
    this.animateCamera({ ...this.camera, x: this.camera.viewportWidth / 2 - point.x * this.camera.scale, y: this.camera.viewportHeight / 2 - point.y * this.camera.scale });
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
      this.camera = { ...this.camera, x: start.x + (target.x - start.x) * eased, y: start.y + (target.y - start.y) * eased, scale: start.scale + (target.scale - start.scale) * eased };
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
