import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { CameraState, WorldBounds, WorldPoint } from "../domain/types";
import { applyViewFilter } from "../domain/viewFilter";
import type { CampaignStore } from "../state/campaignStore";
import { CanvasEngine, type CanvasContextTarget, type CanvasRenderState } from "./CanvasEngine";

export interface CanvasSurfaceHandle {
  fitAll: () => void;
  focusEntity: (id: string) => void;
  centerOn: (point: WorldPoint) => void;
  viewportCenter: () => WorldPoint;
}

interface CanvasSurfaceProps {
  store: CampaignStore;
  onCameraChange: (camera: CameraState) => void;
  onEditEntity: (id: string, bounds: WorldBounds) => void;
  onCreateEntity: (id: string, screen: WorldPoint) => void;
  onContextMenu: (target: CanvasContextTarget) => void;
}

/** CanvasSurface owns only the DOM host and the view filter. Every pixel —
 * grid, groups, relations, cards, selection and drag previews — is drawn
 * and hit-tested by CanvasEngine on a single visible canvas. */
export const CanvasSurface = forwardRef<CanvasSurfaceHandle, CanvasSurfaceProps>(function CanvasSurface(
  { store, onCameraChange, onEditEntity, onCreateEntity, onContextMenu },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);

  useImperativeHandle(ref, () => ({
    fitAll: () => engineRef.current?.fitAll(),
    focusEntity: (id) => engineRef.current?.focusEntity(id),
    centerOn: (point) => engineRef.current?.centerOn(point),
    viewportCenter: () => engineRef.current?.getViewportCenter() ?? { x: 0, y: 0 },
  }), []);

  const computeRenderState = useMemo(() => {
    return (): CanvasRenderState => {
      const snapshot = store.getSnapshot();
      const activeView = snapshot.views.find((view) => view.id === snapshot.activeViewId);
      const entities = activeView ? applyViewFilter(snapshot.entities, activeView.filter) : snapshot.entities;
      const visibleIds = new Set(entities.map((entity) => entity.id));
      const relations = snapshot.relations.filter((relation) => visibleIds.has(relation.fromEntityId) && visibleIds.has(relation.toEntityId));
      return { entities, relations, selectedEntityIds: snapshot.selectedEntityIds, selectedRelationId: snapshot.selectedRelationId };
    };
  }, [store]);

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new CanvasEngine(hostRef.current, {
      onCameraChange,
      onCreateEntity: (point, screen) => {
        const created = store.createEntity("npc", point);
        onCreateEntity(created.id, screen);
      },
      onSelectEntity: (id, additive) => store.selectEntity(id, additive),
      onSelectEntities: (ids, additive) => store.selectEntities(ids, additive),
      onSelectRelation: (id) => store.selectRelation(id),
      onContextMenu,
      onClearSelection: () => store.clearSelection(),
      onMoveEntities: (moves) => store.moveEntities(moves),
      onResizeEntity: (id, bounds) => store.resizeEntity(id, bounds),
      onMoveGroup: (id, point) => store.moveGroup(id, point),
      onCreateRelation: (fromId, toId) => store.createRelation(fromId, toId, "custom"),
      onEditEntity,
      onDuplicateEntitiesInPlace: (ids) => store.duplicateEntitiesInPlace(ids).map((entity) => ({ id: entity.id, x: entity.x, y: entity.y })),
    });
    engineRef.current = engine;
    void engine.init().then(() => {
      engine.setState(computeRenderState());
      engine.fitAll();
    });
    if (typeof window !== "undefined") {
      (window as unknown as { __rpgWorldCanvasEngine?: CanvasEngine }).__rpgWorldCanvasEngine = engine;
    }
    const unsubscribe = store.subscribe(() => {
      engine.setState(computeRenderState());
    });
    return () => {
      unsubscribe();
      engine.destroy();
      engineRef.current = null;
    };
  }, [computeRenderState, onCameraChange, onContextMenu, onCreateEntity, onEditEntity, store]);

  return <div ref={hostRef} className="canvas-surface" aria-label="Canvas visual da campanha" />;
});
