import { createId } from "../domain/id";
import type {
  CanvasConnection,
  CanvasNode,
  CanvasRegion,
  NodeKind,
  ProgressState,
  WorkspaceData,
  WorldPoint,
} from "../domain/types";
import { saveWorkspace } from "../data/repository";
import type { CanvasTemplate } from "../data/templateLibrary";

export interface WorkspaceState extends WorkspaceData {
  selectedNodeIds: string[];
  selectedRegionId: string | null;
  selectedConnectionId: string | null;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
}

type Listener = () => void;
type Snapshot = Pick<WorkspaceData, "nodes" | "regions" | "connections" | "sessionProgress">;

function cloneSnapshot(state: WorkspaceState): Snapshot {
  return structuredClone({
    nodes: state.nodes,
    regions: state.regions,
    connections: state.connections,
    sessionProgress: state.sessionProgress,
  });
}

export class WorkspaceStore {
  private state: WorkspaceState;
  private listeners = new Set<Listener>();
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private autosaveTimer: number | null = null;
  private clipboard: CanvasNode[] = [];
  private mutationVersion = 0;

  constructor(workspace: WorkspaceData) {
    this.state = {
      ...structuredClone(workspace),
      selectedNodeIds: [],
      selectedRegionId: null,
      selectedConnectionId: null,
      dirty: false,
      saving: false,
      lastSavedAt: null,
    };
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): WorkspaceState => this.state;

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private commit(mutator: (draft: WorkspaceState) => WorkspaceState): void {
    this.undoStack.push(cloneSnapshot(this.state));
    if (this.undoStack.length > 120) this.undoStack.shift();
    this.redoStack = [];
    this.mutationVersion += 1;
    this.state = { ...mutator(this.state), dirty: true };
    this.emit();
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.autosaveTimer) window.clearTimeout(this.autosaveTimer);
    this.autosaveTimer = window.setTimeout(() => void this.saveNow(), 650);
  }

  async saveNow(): Promise<void> {
    if (!this.state.dirty || this.state.saving) return;
    this.state = { ...this.state, saving: true };
    this.emit();
    const savingVersion = this.mutationVersion;
    const payload: WorkspaceData = {
      project: { ...this.state.project, updatedAt: Date.now() },
      nodes: this.state.nodes,
      regions: this.state.regions,
      connections: this.state.connections,
      sessionProgress: this.state.sessionProgress,
    };
    try {
      await saveWorkspace(payload);
      const changedWhileSaving = this.mutationVersion !== savingVersion;
      this.state = {
        ...this.state,
        project: payload.project,
        dirty: changedWhileSaving,
        saving: false,
        lastSavedAt: Date.now(),
      };
      if (changedWhileSaving) this.scheduleSave();
    } catch (error) {
      console.error("Falha ao salvar workspace", error);
      this.state = { ...this.state, saving: false };
    }
    this.emit();
  }

  selectNode(id: string, additive = false): void {
    const alreadySelected = this.state.selectedNodeIds.includes(id);
    const selectedNodeIds = additive
      ? alreadySelected
        ? this.state.selectedNodeIds.filter((nodeId) => nodeId !== id)
        : [...this.state.selectedNodeIds, id]
      : alreadySelected
        ? this.state.selectedNodeIds
        : [id];
    this.state = { ...this.state, selectedNodeIds, selectedRegionId: null, selectedConnectionId: null };
    this.emit();
  }

  selectNodes(ids: string[], additive = false): void {
    const available = new Set(this.state.nodes.map((node) => node.id));
    const next = ids.filter((id) => available.has(id));
    const selectedNodeIds = additive
      ? [...new Set([...this.state.selectedNodeIds, ...next])]
      : next;
    this.state = { ...this.state, selectedNodeIds, selectedRegionId: null, selectedConnectionId: null };
    this.emit();
  }

  selectRegion(id: string): void {
    if (!this.state.regions.some((region) => region.id === id)) return;
    this.state = { ...this.state, selectedNodeIds: [], selectedRegionId: id, selectedConnectionId: null };
    this.emit();
  }

  selectConnection(id: string): void {
    if (!this.state.connections.some((connection) => connection.id === id)) return;
    this.state = { ...this.state, selectedNodeIds: [], selectedRegionId: null, selectedConnectionId: id };
    this.emit();
  }

  clearSelection(): void {
    if (!this.state.selectedNodeIds.length && !this.state.selectedRegionId && !this.state.selectedConnectionId) return;
    this.state = { ...this.state, selectedNodeIds: [], selectedRegionId: null, selectedConnectionId: null };
    this.emit();
  }

  createNode(point: WorldPoint, regionId?: string | null, title = "Nova caixa"): CanvasNode {
    const now = Date.now();
    const resolvedRegionId = regionId === undefined ? this.regionAt(point)?.id ?? null : regionId;
    const created: CanvasNode = {
      id: createId("node"),
      projectId: this.state.project.id,
      regionId: resolvedRegionId,
      sourceNodeId: null,
      groupId: null,
      title,
      body: "",
      instanceNotes: "",
      kind: "free",
      x: point.x,
      y: point.y,
      width: 240,
      height: 126,
      color: "#20283a",
      imageSrc: null,
      tags: [],
      important: false,
      createdAt: now,
      updatedAt: now,
    };
    this.commit((state) => ({
      ...state,
      nodes: [...state.nodes, created],
      selectedNodeIds: [created.id],
      selectedRegionId: null,
      selectedConnectionId: null,
    }));
    return created;
  }

  createRegion(point: WorldPoint, kind: CanvasRegion["kind"] = "region"): CanvasRegion {
    const parent = this.regionAt(point);
    const created: CanvasRegion = {
      id: createId("region"),
      projectId: this.state.project.id,
      parentRegionId: parent?.id ?? null,
      title: kind === "session" ? "NOVA SESSÃO" : "NOVA REGIÃO",
      kind,
      x: point.x,
      y: point.y,
      width: 920,
      height: 620,
      color: kind === "session" ? "#a78bfa" : "#38bdf8",
      minDetailScale: 0.08,
    };
    this.commit((state) => ({
      ...state,
      regions: [...state.regions, created],
      selectedNodeIds: [],
      selectedRegionId: created.id,
      selectedConnectionId: null,
    }));
    return created;
  }

  createFromTemplate(template: CanvasTemplate, center: WorldPoint): void {
    const regionIds = new Map(template.regions.map((region) => [region.key, createId("region")]));
    const nodeIds = new Map(template.nodes.map((node) => [node.key, createId("node")]));
    const allBounds = [
      ...template.regions.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height })),
      ...template.nodes.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height })),
    ];
    const minX = Math.min(...allBounds.map((item) => item.x));
    const minY = Math.min(...allBounds.map((item) => item.y));
    const maxX = Math.max(...allBounds.map((item) => item.x + item.width));
    const maxY = Math.max(...allBounds.map((item) => item.y + item.height));
    const offsetX = center.x - (minX + maxX) / 2;
    const offsetY = center.y - (minY + maxY) / 2;
    const now = Date.now();
    const regions: CanvasRegion[] = template.regions.map((region) => ({
      id: regionIds.get(region.key)!, projectId: this.state.project.id,
      parentRegionId: region.parentKey ? regionIds.get(region.parentKey) ?? null : null,
      title: region.title, kind: region.kind, x: region.x + offsetX, y: region.y + offsetY,
      width: region.width, height: region.height, color: region.color, minDetailScale: region.minDetailScale,
    }));
    const nodes: CanvasNode[] = template.nodes.map((node) => ({
      id: nodeIds.get(node.key)!, projectId: this.state.project.id,
      regionId: node.regionKey ? regionIds.get(node.regionKey) ?? null : null, sourceNodeId: null, groupId: null,
      title: node.title, body: node.body, instanceNotes: node.instanceNotes, kind: node.kind,
      x: node.x + offsetX, y: node.y + offsetY, width: node.width, height: node.height,
      color: node.color, imageSrc: node.imageSrc, tags: [...(node.tags ?? [])], important: node.important, createdAt: now, updatedAt: now,
    }));
    const connections: CanvasConnection[] = template.connections.map((edge) => ({
      id: createId("edge"), projectId: this.state.project.id, fromNodeId: nodeIds.get(edge.fromKey)!, toNodeId: nodeIds.get(edge.toKey)!, label: edge.label, relation: edge.relation, color: edge.color,
    }));
    this.commit((state) => ({ ...state, regions: [...state.regions, ...regions], nodes: [...state.nodes, ...nodes], connections: [...state.connections, ...connections], selectedNodeIds: regions.length ? [] : nodes.map((node) => node.id), selectedRegionId: regions[0]?.id ?? null, selectedConnectionId: null }));
  }

  createReference(sourceId: string, point: WorldPoint): CanvasNode | null {
    const source = this.state.nodes.find((node) => node.id === sourceId);
    if (!source) return null;
    const reference = this.createNode(point, undefined, source.title);
    this.updateNode(reference.id, {
      sourceNodeId: source.sourceNodeId ?? source.id,
      kind: source.kind,
      color: source.color,
      imageSrc: source.imageSrc,
      tags: [...source.tags],
      body: "",
      instanceNotes: "Anotação específica desta aparição.",
    });
    return reference;
  }

  private regionAt(point: WorldPoint, regions = this.state.regions): CanvasRegion | null {
    return regions
      .filter((region) =>
        point.x >= region.x && point.x <= region.x + region.width &&
        point.y >= region.y && point.y <= region.y + region.height,
      )
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
  }

  updateNode(id: string, updates: Partial<CanvasNode>): void {
    this.commit((state) => ({
      ...state,
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...updates, updatedAt: Date.now() } : node,
      ),
    }));
  }

  updateSelectedNodes(updates: Partial<Pick<CanvasNode, "kind" | "color" | "important" | "tags">>): void {
    const selected = new Set(this.state.selectedNodeIds);
    if (!selected.size) return;
    const now = Date.now();
    this.commit((state) => ({
      ...state,
      nodes: state.nodes.map((node) => selected.has(node.id) ? { ...node, ...updates, updatedAt: now } : node),
    }));
  }

  updateNodePosition(id: string, point: WorldPoint): void {
    this.moveNodes([{ id, x: point.x, y: point.y }]);
  }

  moveNodes(moves: Array<{ id: string; x: number; y: number }>): void {
    if (!moves.length) return;
    const byId = new Map(moves.map((move) => [move.id, move]));
    const now = Date.now();
    this.commit((state) => ({
      ...state,
      nodes: state.nodes.map((node) => {
        const move = byId.get(node.id);
        if (!move) return node;
        const center = { x: move.x + node.width / 2, y: move.y + node.height / 2 };
        return {
          ...node,
          x: move.x,
          y: move.y,
          regionId: this.regionAt(center, state.regions)?.id ?? null,
          updatedAt: now,
        };
      }),
    }));
  }

  resizeNode(id: string, bounds: WorldPoint & { width: number; height: number }): void {
    this.updateNode(id, {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(140, Math.min(900, bounds.width)),
      height: Math.max(76, Math.min(700, bounds.height)),
    });
  }

  updateRegion(id: string, updates: Partial<CanvasRegion>): void {
    this.commit((state) => ({
      ...state,
      regions: state.regions.map((region) => region.id === id ? { ...region, ...updates } : region),
    }));
  }

  moveRegion(id: string, point: WorldPoint): void {
    const region = this.state.regions.find((candidate) => candidate.id === id);
    if (!region) return;
    const dx = point.x - region.x;
    const dy = point.y - region.y;
    if (dx === 0 && dy === 0) return;
    const affected = this.descendantRegionIds(id);
    const now = Date.now();
    this.commit((state) => ({
      ...state,
      regions: state.regions.map((candidate) =>
        affected.has(candidate.id)
          ? { ...candidate, x: candidate.x + dx, y: candidate.y + dy }
          : candidate,
      ),
      nodes: state.nodes.map((node) =>
        node.regionId && affected.has(node.regionId)
          ? { ...node, x: node.x + dx, y: node.y + dy, updatedAt: now }
          : node,
      ),
    }));
  }

  resizeRegion(id: string, bounds: WorldPoint & { width: number; height: number }): void {
    this.updateRegion(id, {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(360, Math.min(6000, bounds.width)),
      height: Math.max(260, Math.min(5000, bounds.height)),
    });
  }

  private descendantRegionIds(id: string): Set<string> {
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const region of this.state.regions) {
        if (region.parentRegionId && ids.has(region.parentRegionId) && !ids.has(region.id)) {
          ids.add(region.id);
          changed = true;
        }
      }
    }
    return ids;
  }

  setNodeKind(id: string, kind: NodeKind): void {
    this.updateNode(id, { kind });
  }

  connectSelected(): void {
    const [fromNodeId, toNodeId] = this.state.selectedNodeIds;
    if (!fromNodeId || !toNodeId) return;
    this.createConnection(fromNodeId, toNodeId);
  }

  createConnection(fromNodeId: string, toNodeId: string): void {
    if (fromNodeId === toNodeId) return;
    if (!this.nodeById(fromNodeId) || !this.nodeById(toNodeId)) return;
    const exists = this.state.connections.some(
      (connection) => connection.fromNodeId === fromNodeId && connection.toNodeId === toNodeId,
    );
    if (exists) return;
    const connection: CanvasConnection = {
      id: createId("edge"),
      projectId: this.state.project.id,
      fromNodeId,
      toNodeId,
      label: "",
      relation: "flow",
      color: "#8290ad",
    };
    this.commit((state) => ({ ...state, connections: [...state.connections, connection] }));
  }

  updateConnection(id: string, updates: Partial<CanvasConnection>): void {
    this.commit((state) => ({
      ...state,
      connections: state.connections.map((connection) => connection.id === id ? { ...connection, ...updates } : connection),
    }));
  }

  reverseConnection(id: string): void {
    const connection = this.state.connections.find((candidate) => candidate.id === id);
    if (!connection) return;
    this.updateConnection(id, { fromNodeId: connection.toNodeId, toNodeId: connection.fromNodeId });
  }

  deleteConnection(id: string): void {
    this.commit((state) => ({
      ...state,
      connections: state.connections.filter((connection) => connection.id !== id),
      selectedConnectionId: state.selectedConnectionId === id ? null : state.selectedConnectionId,
    }));
  }

  private nodeById(id: string): CanvasNode | undefined {
    return this.state.nodes.find((node) => node.id === id);
  }

  deleteSelected(): void {
    const ids = new Set(this.state.selectedNodeIds);
    const regionId = this.state.selectedRegionId;
    const connectionId = this.state.selectedConnectionId;
    if (!ids.size && !regionId && !connectionId) return;
    this.commit((state) => {
      const parentRegionId = regionId
        ? state.regions.find((region) => region.id === regionId)?.parentRegionId ?? null
        : null;
      const nodes = state.nodes
        .filter((node) => !ids.has(node.id))
        .map((node) => regionId && node.regionId === regionId ? { ...node, regionId: parentRegionId } : node);
      const regions = regionId
        ? state.regions
            .filter((region) => region.id !== regionId)
            .map((region) => region.parentRegionId === regionId ? { ...region, parentRegionId } : region)
        : state.regions;
      return {
        ...state,
        nodes,
        regions,
        connections: state.connections.filter(
          (connection) => connection.id !== connectionId && !ids.has(connection.fromNodeId) && !ids.has(connection.toNodeId),
        ),
        selectedNodeIds: [],
        selectedRegionId: null,
        selectedConnectionId: null,
      };
    });
  }

  copySelected(): void {
    const ids = new Set(this.state.selectedNodeIds);
    this.clipboard = structuredClone(this.state.nodes.filter((node) => ids.has(node.id)));
  }

  pasteClipboard(offset = 36): void {
    if (!this.clipboard.length) return;
    const idMap = new Map<string, string>();
    const now = Date.now();
    const pasted = this.clipboard.map((node) => {
      const id = createId("node");
      idMap.set(node.id, id);
      return { ...node, id, groupId: null, x: node.x + offset, y: node.y + offset, createdAt: now, updatedAt: now };
    });
    this.clipboard = structuredClone(pasted);
    this.commit((state) => ({
      ...state,
      nodes: [...state.nodes, ...pasted],
      selectedNodeIds: pasted.map((node) => node.id),
    }));
  }

  duplicateSelected(): void {
    this.copySelected();
    this.pasteClipboard();
  }

  groupSelected(): void {
    const ids = new Set(this.state.selectedNodeIds);
    if (ids.size < 2) return;
    const groupId = createId("group");
    const now = Date.now();
    this.commit((state) => ({
      ...state,
      nodes: state.nodes.map((node) => (ids.has(node.id) ? { ...node, groupId, updatedAt: now } : node)),
    }));
  }

  ungroupSelected(): void {
    const ids = this.state.selectedNodeIds;
    const groupIds = new Set(this.state.nodes.filter((node) => ids.includes(node.id) && node.groupId).map((node) => node.groupId));
    if (!groupIds.size) return;
    const now = Date.now();
    this.commit((state) => ({
      ...state,
      nodes: state.nodes.map((node) => (node.groupId && groupIds.has(node.groupId) ? { ...node, groupId: null, updatedAt: now } : node)),
    }));
  }

  /**
   * Duplicates the given nodes at their exact current position (no offset)
   * and returns the copies, so the caller (the canvas engine's Alt+drag
   * gesture) can immediately continue the same pointer gesture moving the
   * new copies instead of the originals. The copies share a fresh group id
   * among themselves when two or more are duplicated together.
   */
  duplicateNodesInPlace(ids: string[]): CanvasNode[] {
    const sourceNodes = this.state.nodes.filter((node) => ids.includes(node.id));
    if (!sourceNodes.length) return [];
    const now = Date.now();
    const groupId = sourceNodes.length > 1 ? createId("group") : null;
    const copies: CanvasNode[] = sourceNodes.map((node) => ({
      ...node,
      id: createId("node"),
      groupId,
      createdAt: now,
      updatedAt: now,
    }));
    this.commit((state) => ({
      ...state,
      nodes: [...state.nodes, ...copies],
      selectedNodeIds: copies.map((node) => node.id),
      selectedRegionId: null,
      selectedConnectionId: null,
    }));
    return copies;
  }

  advanceSession(nodeId: string): void {
    const next: Record<string, ProgressState> = { ...this.state.sessionProgress };
    for (const [id, progress] of Object.entries(next)) {
      if (progress === "active") next[id] = "completed";
    }
    next[nodeId] = "active";
    this.commit((state) => ({ ...state, sessionProgress: next }));
  }

  resetSession(regionId: string): void {
    const regionIds = this.descendantRegionIds(regionId);
    const nodeIds = new Set(
      this.state.nodes.filter((node) => node.regionId && regionIds.has(node.regionId)).map((node) => node.id),
    );
    if (![...nodeIds].some((id) => id in this.state.sessionProgress)) return;
    const sessionProgress = Object.fromEntries(
      Object.entries(this.state.sessionProgress).filter(([nodeId]) => !nodeIds.has(nodeId)),
    );
    this.commit((state) => ({ ...state, sessionProgress }));
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(cloneSnapshot(this.state));
    this.mutationVersion += 1;
    this.state = { ...this.state, ...previous, dirty: true };
    this.emit();
    this.scheduleSave();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneSnapshot(this.state));
    this.mutationVersion += 1;
    this.state = { ...this.state, ...next, dirty: true };
    this.emit();
    this.scheduleSave();
  }
}
