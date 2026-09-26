import { type AlignMode, computeAlignment, computeDistribution, type DistributeAxis } from "../domain/alignment";
import type { CalendarConfig } from "../domain/calendarFields";
import { kindConfig } from "../domain/entityKindRegistry";
import type { SafetyToolsConfig } from "../domain/safetyToolsFields";
import { createId } from "../domain/id";
import type { ModuleKey } from "../domain/modules";
import { evaluateRulesOnce } from "../domain/rulesEngine";
import type {
  Campaign,
  CampaignData,
  Entity,
  EntityKind,
  Relation,
  RelationType,
  View,
  ViewFilter,
  WorldPoint,
} from "../domain/types";
import { saveCampaignDiff, type CampaignSaveDiff } from "../data/repository";

export interface CampaignState {
  campaign: Campaign;
  entities: Entity[];
  relations: Relation[];
  views: View[];
  activeViewId: string;
  selectedEntityIds: string[];
  selectedRelationId: string | null;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: number | null;
}

type Listener = () => void;
interface Snapshot {
  entities: Entity[];
  relations: Relation[];
  views: View[];
}

function cloneSnapshot(state: CampaignState): Snapshot {
  return structuredClone({ entities: state.entities, relations: state.relations, views: state.views });
}

/** The single reactive store behind the whole campaign. Every tool (canvas,
 * NPC panel, quest list, search...) reads the same `entities`/`relations`
 * arrays and writes through the same methods here — there is no per-tool
 * copy of the data to keep in sync. */
export class CampaignStore {
  private state: CampaignState;
  private listeners = new Set<Listener>();
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private autosaveTimer: number | null = null;
  private mutationVersion = 0;

  private dirtyEntityIds = new Set<string>();
  private deletedEntityIds = new Set<string>();
  private dirtyRelationIds = new Set<string>();
  private deletedRelationIds = new Set<string>();
  private dirtyViewIds = new Set<string>();
  private deletedViewIds = new Set<string>();

  constructor(data: CampaignData) {
    const defaultView = data.views.find((view) => view.isDefault) ?? data.views[0];
    this.state = {
      ...structuredClone(data),
      activeViewId: defaultView?.id ?? "",
      selectedEntityIds: [],
      selectedRelationId: null,
      dirty: false,
      saving: false,
      lastSavedAt: null,
    };
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): CampaignState => this.state;

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private diffArray<T extends { id: string }>(previous: T[], next: T[], dirty: Set<string>, deleted: Set<string>): void {
    const previousById = new Map(previous.map((item) => [item.id, item]));
    const nextIds = new Set<string>();
    for (const item of next) {
      nextIds.add(item.id);
      if (previousById.get(item.id) !== item) dirty.add(item.id);
    }
    for (const item of previous) {
      if (!nextIds.has(item.id)) {
        deleted.add(item.id);
        dirty.delete(item.id);
      }
    }
  }

  private trackChanges(previous: Snapshot, next: Snapshot): void {
    this.diffArray(previous.entities, next.entities, this.dirtyEntityIds, this.deletedEntityIds);
    this.diffArray(previous.relations, next.relations, this.dirtyRelationIds, this.deletedRelationIds);
    this.diffArray(previous.views, next.views, this.dirtyViewIds, this.deletedViewIds);
  }

  private commit(mutator: (state: CampaignState) => CampaignState): void {
    const before = cloneSnapshot(this.state);
    this.undoStack.push(before);
    if (this.undoStack.length > 150) this.undoStack.shift();
    this.redoStack = [];
    this.mutationVersion += 1;
    const mutated = { ...mutator(this.state), dirty: true };
    const next = this.applyRules(before, mutated);
    this.trackChanges(before, { entities: next.entities, relations: next.relations, views: next.views });
    this.state = next;
    this.emit();
    this.scheduleSave();
  }

  /** Rules Engine: after a normal mutation, check whether any watched
   * entity just transitioned into a rule's trigger status, and apply that
   * rule's action — deterministically, no AI involved. Runs in bounded
   * passes (never more than 5) so one rule's action can trigger another
   * ("butterfly effect" chains) without any risk of looping forever. Each
   * pass compares against the entities from *before that pass*, so a rule
   * only fires once per actual transition. */
  private applyRules(before: Snapshot, next: CampaignState): CampaignState {
    if (!next.campaign.enabledModules.includes("rules_engine")) return next;
    let entities = next.entities;
    let relations = next.relations;
    let previousById = new Map(before.entities.map((entity) => [entity.id, entity]));
    let changed = false;

    for (let pass = 0; pass < 5; pass += 1) {
      const rules = entities.filter((entity) => entity.kind === "rule");
      if (!rules.length) break;
      const result = evaluateRulesOnce(rules, previousById, entities, relations);
      if (!result.entityUpdates.size && !result.newRelations.length && !result.ruleFieldUpdates.size) break;

      changed = true;
      previousById = new Map(entities.map((entity) => [entity.id, entity]));
      const now = Date.now();
      entities = entities.map((entity) => {
        const update = result.entityUpdates.get(entity.id);
        const ruleFields = result.ruleFieldUpdates.get(entity.id);
        if (!update && !ruleFields) return entity;
        return { ...entity, ...update, fields: ruleFields ?? entity.fields, updatedAt: now };
      });
      relations = [...relations, ...result.newRelations];
    }

    return changed ? { ...next, entities, relations } : next;
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

    const entityById = new Map(this.state.entities.map((entity) => [entity.id, entity]));
    const relationById = new Map(this.state.relations.map((relation) => [relation.id, relation]));
    const viewById = new Map(this.state.views.map((view) => [view.id, view]));

    const upsertEntityIds = [...this.dirtyEntityIds];
    const deleteEntityIds = [...this.deletedEntityIds];
    const upsertRelationIds = [...this.dirtyRelationIds];
    const deleteRelationIds = [...this.deletedRelationIds];
    const upsertViewIds = [...this.dirtyViewIds];
    const deleteViewIds = [...this.deletedViewIds];

    const diff: CampaignSaveDiff = {
      campaign: { ...this.state.campaign, updatedAt: Date.now() },
      upsertEntities: upsertEntityIds.map((id) => entityById.get(id)).filter((entity): entity is Entity => Boolean(entity)),
      deleteEntityIds,
      upsertRelations: upsertRelationIds.map((id) => relationById.get(id)).filter((relation): relation is Relation => Boolean(relation)),
      deleteRelationIds,
      upsertViews: upsertViewIds.map((id) => viewById.get(id)).filter((view): view is View => Boolean(view)),
      deleteViewIds,
    };

    try {
      await saveCampaignDiff(diff);
      for (const id of upsertEntityIds) this.dirtyEntityIds.delete(id);
      for (const id of deleteEntityIds) this.deletedEntityIds.delete(id);
      for (const id of upsertRelationIds) this.dirtyRelationIds.delete(id);
      for (const id of deleteRelationIds) this.deletedRelationIds.delete(id);
      for (const id of upsertViewIds) this.dirtyViewIds.delete(id);
      for (const id of deleteViewIds) this.deletedViewIds.delete(id);

      const stillDirty =
        this.dirtyEntityIds.size > 0 || this.deletedEntityIds.size > 0 ||
        this.dirtyRelationIds.size > 0 || this.deletedRelationIds.size > 0 ||
        this.dirtyViewIds.size > 0 || this.deletedViewIds.size > 0;
      const changedWhileSaving = this.mutationVersion !== savingVersion;
      this.state = {
        ...this.state,
        campaign: diff.campaign,
        dirty: stillDirty || changedWhileSaving,
        saving: false,
        lastSavedAt: Date.now(),
      };
      if (this.state.dirty) this.scheduleSave();
    } catch (error) {
      console.error("Falha ao salvar campanha", error);
      this.state = { ...this.state, saving: false };
    }
    this.emit();
  }

  // ---- selection --------------------------------------------------------

  selectEntity(id: string, additive = false): void {
    const already = this.state.selectedEntityIds.includes(id);
    const selectedEntityIds = additive
      ? already ? this.state.selectedEntityIds.filter((entityId) => entityId !== id) : [...this.state.selectedEntityIds, id]
      : already ? this.state.selectedEntityIds : [id];
    this.state = { ...this.state, selectedEntityIds, selectedRelationId: null };
    this.emit();
  }

  selectEntities(ids: string[], additive = false): void {
    const available = new Set(this.state.entities.map((entity) => entity.id));
    const next = ids.filter((id) => available.has(id));
    const selectedEntityIds = additive ? [...new Set([...this.state.selectedEntityIds, ...next])] : next;
    this.state = { ...this.state, selectedEntityIds, selectedRelationId: null };
    this.emit();
  }

  selectRelation(id: string): void {
    if (!this.state.relations.some((relation) => relation.id === id)) return;
    this.state = { ...this.state, selectedEntityIds: [], selectedRelationId: id };
    this.emit();
  }

  clearSelection(): void {
    if (!this.state.selectedEntityIds.length && !this.state.selectedRelationId) return;
    this.state = { ...this.state, selectedEntityIds: [], selectedRelationId: null };
    this.emit();
  }

  // ---- entities -----------------------------------------------------------

  groupAt(point: WorldPoint, excludeIds: Set<string> = new Set()): Entity | null {
    return this.state.entities
      .filter((entity) => entity.kind === "group" && !excludeIds.has(entity.id))
      .filter((entity) => point.x >= entity.x && point.x <= entity.x + entity.width && point.y >= entity.y && point.y <= entity.y + entity.height)
      .sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
  }

  descendantGroupIds(id: string): Set<string> {
    const ids = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const entity of this.state.entities) {
        if (entity.kind === "group" && entity.groupId && ids.has(entity.groupId) && !ids.has(entity.id)) {
          ids.add(entity.id);
          changed = true;
        }
      }
    }
    return ids;
  }

  createEntity(kind: EntityKind, point: WorldPoint, overrides: Partial<Entity> = {}): Entity {
    const config = kindConfig(kind);
    const now = Date.now();
    const groupId = overrides.groupId !== undefined ? overrides.groupId : this.groupAt(point)?.id ?? null;
    const created: Entity = {
      id: createId("entity"),
      campaignId: this.state.campaign.id,
      kind,
      title: overrides.title ?? `Novo(a) ${config.label}`,
      summary: overrides.summary ?? "",
      color: overrides.color ?? null,
      icon: overrides.icon ?? null,
      imageSrc: overrides.imageSrc ?? null,
      tags: overrides.tags ?? [],
      status: overrides.status ?? null,
      fields: overrides.fields ?? {},
      x: point.x,
      y: point.y,
      width: overrides.width ?? config.width,
      height: overrides.height ?? config.height,
      groupId,
      visibility: overrides.visibility ?? "gm_only",
      important: overrides.important ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.commit((state) => ({ ...state, entities: [...state.entities, created], selectedEntityIds: [created.id], selectedRelationId: null }));
    return created;
  }

  updateEntity(id: string, updates: Partial<Entity>): void {
    this.commit((state) => ({
      ...state,
      entities: state.entities.map((entity) => (entity.id === id ? { ...entity, ...updates, updatedAt: Date.now() } : entity)),
    }));
  }

  updateSelectedEntities(updates: Partial<Pick<Entity, "kind" | "color" | "important" | "tags" | "status" | "visibility">>): void {
    const selected = new Set(this.state.selectedEntityIds);
    if (!selected.size) return;
    const now = Date.now();
    this.commit((state) => ({
      ...state,
      entities: state.entities.map((entity) => (selected.has(entity.id) ? { ...entity, ...updates, updatedAt: now } : entity)),
    }));
  }

  moveEntities(moves: Array<{ id: string; x: number; y: number }>): void {
    if (!moves.length) return;
    const byId = new Map(moves.map((move) => [move.id, move]));
    const now = Date.now();
    this.commit((state) => ({
      ...state,
      entities: state.entities.map((entity) => {
        const move = byId.get(entity.id);
        if (!move) return entity;
        const center = { x: move.x + entity.width / 2, y: move.y + entity.height / 2 };
        const groupId = entity.kind === "group" ? entity.groupId : this.groupAt(center, new Set([entity.id]))?.id ?? null;
        return { ...entity, x: move.x, y: move.y, groupId, updatedAt: now };
      }),
    }));
  }

  /** Alinha os elementos selecionados (não-grupo) por uma borda/centro comum
   * — uma única entrada de undo, igual a moveEntities, já que é isso que
   * ela chama por baixo. Menos de duas entidades não faz nada. */
  alignSelected(mode: AlignMode): void {
    const entities = this.state.entities.filter((entity) => this.state.selectedEntityIds.includes(entity.id) && entity.kind !== "group");
    const moves = computeAlignment(entities, mode);
    if (moves.length) this.moveEntities(moves);
  }

  /** Distribui espaçamento uniforme entre os elementos selecionados
   * (não-grupo), mantendo as duas pontas fixas. Precisa de pelo menos três
   * elementos — com dois não há "meio" para redistribuir. */
  distributeSelected(axis: DistributeAxis): void {
    const entities = this.state.entities.filter((entity) => this.state.selectedEntityIds.includes(entity.id) && entity.kind !== "group");
    const moves = computeDistribution(entities, axis);
    if (moves.length) this.moveEntities(moves);
  }

  /** Moving a group carries every descendant group and every entity whose
   * groupId chain leads to it — the same "drag the area, everything inside
   * comes along" behavior as RPG Canvas Studio's regions. */
  moveGroup(id: string, point: WorldPoint): void {
    const group = this.state.entities.find((entity) => entity.id === id);
    if (!group) return;
    const dx = point.x - group.x;
    const dy = point.y - group.y;
    if (dx === 0 && dy === 0) return;
    const affected = this.descendantGroupIds(id);
    const now = Date.now();
    this.commit((state) => ({
      ...state,
      entities: state.entities.map((entity) => {
        if (entity.kind === "group" && affected.has(entity.id)) return { ...entity, x: entity.x + dx, y: entity.y + dy, updatedAt: now };
        if (entity.groupId && affected.has(entity.groupId)) return { ...entity, x: entity.x + dx, y: entity.y + dy, updatedAt: now };
        return entity;
      }),
    }));
  }

  resizeEntity(id: string, bounds: WorldPoint & { width: number; height: number }): void {
    this.updateEntity(id, {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(80, Math.min(4000, bounds.width)),
      height: Math.max(60, Math.min(4000, bounds.height)),
    });
  }

  duplicateEntitiesInPlace(ids: string[]): Entity[] {
    const sources = this.state.entities.filter((entity) => ids.includes(entity.id));
    if (!sources.length) return [];
    const now = Date.now();
    const idMap = new Map(sources.map((entity) => [entity.id, createId("entity")]));
    const copies = sources.map((entity) => ({ ...entity, id: idMap.get(entity.id)!, createdAt: now, updatedAt: now }));
    this.commit((state) => ({
      ...state,
      entities: [...state.entities, ...copies],
      selectedEntityIds: copies.map((entity) => entity.id),
      selectedRelationId: null,
    }));
    return copies;
  }

  deleteSelected(): void {
    const entityIds = new Set(this.state.selectedEntityIds);
    const relationId = this.state.selectedRelationId;
    if (!entityIds.size && !relationId) return;
    this.commit((state) => {
      // Deleting a group reparents its children to the group's own parent,
      // never silently orphaning or cascading a mass-delete.
      const reparent = new Map<string, string | null>();
      for (const entity of state.entities) {
        if (entity.kind === "group" && entityIds.has(entity.id)) reparent.set(entity.id, entity.groupId);
      }
      const entities = state.entities
        .filter((entity) => !entityIds.has(entity.id))
        .map((entity) => (entity.groupId && reparent.has(entity.groupId) ? { ...entity, groupId: reparent.get(entity.groupId)! } : entity));
      const relations = state.relations.filter(
        (relation) => relation.id !== relationId && !entityIds.has(relation.fromEntityId) && !entityIds.has(relation.toEntityId),
      );
      return { ...state, entities, relations, selectedEntityIds: [], selectedRelationId: null };
    });
  }

  // ---- relations ----------------------------------------------------------

  createRelation(fromEntityId: string, toEntityId: string, type: RelationType = "knows"): Relation | null {
    if (fromEntityId === toEntityId) return null;
    const ids = new Set(this.state.entities.map((entity) => entity.id));
    if (!ids.has(fromEntityId) || !ids.has(toEntityId)) return null;
    const exists = this.state.relations.some((relation) => relation.fromEntityId === fromEntityId && relation.toEntityId === toEntityId && relation.type === type);
    if (exists) return null;
    const now = Date.now();
    const relation: Relation = {
      id: createId("relation"),
      campaignId: this.state.campaign.id,
      fromEntityId,
      toEntityId,
      type,
      label: "",
      description: "",
      date: null,
      sessionId: null,
      importance: null,
      state: null,
      fields: {},
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    this.commit((state) => ({ ...state, relations: [...state.relations, relation] }));
    return relation;
  }

  updateRelation(id: string, updates: Partial<Relation>): void {
    this.commit((state) => ({
      ...state,
      relations: state.relations.map((relation) => (relation.id === id ? { ...relation, ...updates, updatedAt: Date.now() } : relation)),
    }));
  }

  addRelationHistoryEntry(id: string, note: string, sessionId: string | null = null): void {
    const entry = { id: createId("history"), at: Date.now(), note, sessionId };
    this.commit((state) => ({
      ...state,
      relations: state.relations.map((relation) => (relation.id === id ? { ...relation, history: [...relation.history, entry], updatedAt: Date.now() } : relation)),
    }));
  }

  reverseRelation(id: string): void {
    const relation = this.state.relations.find((candidate) => candidate.id === id);
    if (!relation) return;
    this.updateRelation(id, { fromEntityId: relation.toEntityId, toEntityId: relation.fromEntityId });
  }

  deleteRelation(id: string): void {
    this.commit((state) => ({
      ...state,
      relations: state.relations.filter((relation) => relation.id !== id),
      selectedRelationId: state.selectedRelationId === id ? null : state.selectedRelationId,
    }));
  }

  // ---- campaign settings ------------------------------------------------------

  /** Campaign-level settings (title, color, which modules are enabled...)
   * are not canvas content, so — like setActiveView — this bypasses
   * commit()/undo entirely and just marks the campaign dirty for the next
   * autosave. */
  updateCampaign(updates: Partial<Campaign>): void {
    this.state = { ...this.state, campaign: { ...this.state.campaign, ...updates, updatedAt: Date.now() }, dirty: true };
    this.emit();
    this.scheduleSave();
  }

  setEnabledModules(modules: ModuleKey[]): void {
    this.updateCampaign({ enabledModules: modules });
  }

  /** Favorites are a navigation convenience (Command Palette quick access),
   * not campaign canon — same reasoning as setEnabledModules for staying
   * outside undo/redo: toggling a star while browsing shouldn't consume an
   * undo slot meant for actual campaign edits. */
  toggleFavoriteEntity(id: string): void {
    const current = this.state.campaign.favoriteEntityIds;
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    this.updateCampaign({ favoriteEntityIds: next });
  }

  toggleFavoriteView(id: string): void {
    const current = this.state.campaign.favoriteViewIds;
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    this.updateCampaign({ favoriteViewIds: next });
  }

  /** Calendar Engine: outside undo, same reasoning as everything else
   * updateCampaign touches — this is campaign config/clock state, not an
   * edit a GM would want to Ctrl+Z mid-session. */
  updateCalendarConfig(partial: Partial<CalendarConfig>): void {
    this.updateCampaign({ calendar: { ...this.state.campaign.calendar, ...partial } });
  }

  advanceCalendar(days: number, note: string): void {
    const config = this.state.campaign.calendar;
    const nextDay = Math.max(0, config.currentDay + days);
    const entry = { id: createId("calendarlog"), at: Date.now(), daysAdvanced: days, note };
    this.updateCampaign({ calendar: { ...config, currentDay: nextDay, log: [...config.log, entry] } });
  }

  /** Safety Tools: same outside-undo reasoning as the calendar — this is
   * agreed-upon table config, not a campaign edit to Ctrl+Z. */
  updateSafetyTools(partial: Partial<SafetyToolsConfig>): void {
    this.updateCampaign({ safetyTools: { ...this.state.campaign.safetyTools, ...partial } });
  }

  // ---- views ----------------------------------------------------------------

  setActiveView(id: string): void {
    if (!this.state.views.some((view) => view.id === id)) return;
    this.state = { ...this.state, activeViewId: id };
    this.emit();
  }

  createView(title: string, filter: ViewFilter, icon: string | null = null): View {
    const now = Date.now();
    const view: View = { id: createId("view"), campaignId: this.state.campaign.id, title, icon, filter, isDefault: false, createdAt: now, updatedAt: now };
    this.commit((state) => ({ ...state, views: [...state.views, view] }));
    return view;
  }

  updateView(id: string, updates: Partial<View>): void {
    this.commit((state) => ({
      ...state,
      views: state.views.map((view) => (view.id === id ? { ...view, ...updates, updatedAt: Date.now() } : view)),
    }));
  }

  deleteView(id: string): void {
    const view = this.state.views.find((candidate) => candidate.id === id);
    if (!view || view.isDefault) return;
    this.commit((state) => ({
      ...state,
      views: state.views.filter((candidate) => candidate.id !== id),
      activeViewId: state.activeViewId === id ? (state.views.find((candidate) => candidate.isDefault)?.id ?? state.views[0]?.id ?? "") : state.activeViewId,
    }));
  }

  // ---- history ----------------------------------------------------------------

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    const before = cloneSnapshot(this.state);
    this.redoStack.push(before);
    this.mutationVersion += 1;
    this.trackChanges(before, previous);
    this.state = { ...this.state, ...previous, dirty: true };
    this.emit();
    this.scheduleSave();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    const before = cloneSnapshot(this.state);
    this.undoStack.push(before);
    this.mutationVersion += 1;
    this.trackChanges(before, next);
    this.state = { ...this.state, ...next, dirty: true };
    this.emit();
    this.scheduleSave();
  }
}
