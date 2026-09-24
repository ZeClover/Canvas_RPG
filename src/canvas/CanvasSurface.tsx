import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { CameraState, WorldBounds, WorldPoint } from "../domain/types";
import type { WorkspaceStore } from "../state/workspaceStore";
import { CanvasEngine, type CanvasContextTarget } from "./CanvasEngine";

export interface CanvasSurfaceHandle {
  fitAll: () => void;
  focusNode: (id: string) => void;
  focusRegion: (id: string) => void;
  centerOn: (point: WorldPoint) => void;
  viewportCenter: () => WorldPoint;
  exportImage: (scope: "viewport" | "all") => string | null;
}

interface CanvasSurfaceProps {
  store: WorkspaceStore;
  sessionMode: boolean;
  activeSessionId: string | null;
  focusMode: boolean;
  onCameraChange: (camera: CameraState) => void;
  onEditNode: (id: string, bounds: WorldBounds) => void;
  onCreateNode: (id: string, screen: WorldPoint) => void;
  onContextMenu: (target: CanvasContextTarget) => void;
}

/**
 * CanvasSurface only owns the DOM host element. Every pixel the user sees —
 * grid, regions, connections, nodes, selection and drag previews — is drawn
 * and hit-tested by CanvasEngine on a single visible canvas, so there is no
 * separate React-rendered layer that can drift out of sync during a gesture.
 */
export const CanvasSurface = forwardRef<CanvasSurfaceHandle, CanvasSurfaceProps>(function CanvasSurface(
  { store, sessionMode, activeSessionId, focusMode, onCameraChange, onEditNode, onCreateNode, onContextMenu },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);

  useImperativeHandle(ref, () => ({
    fitAll: () => engineRef.current?.fitAll(),
    focusNode: (id) => engineRef.current?.focusNode(id),
    focusRegion: (id) => engineRef.current?.focusRegion(id),
    centerOn: (point) => engineRef.current?.centerOn(point),
    viewportCenter: () => engineRef.current?.getViewportCenter() ?? { x: 0, y: 0 },
    exportImage: (scope) => engineRef.current?.exportImage(scope) ?? null,
  }), []);

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new CanvasEngine(hostRef.current, {
      onCameraChange,
      onCreateNode: (point, screen) => {
        const created = store.createNode(point);
        onCreateNode(created.id, screen);
      },
      onSelectNode: (id, additive) => store.selectNode(id, additive),
      onSelectNodes: (ids, additive) => store.selectNodes(ids, additive),
      onSelectRegion: (id) => store.selectRegion(id),
      onSelectConnection: (id) => store.selectConnection(id),
      onContextMenu,
      onClearSelection: () => store.clearSelection(),
      onMoveNodes: (moves) => store.moveNodes(moves),
      onResizeNode: (id, bounds) => store.resizeNode(id, bounds),
      onMoveRegion: (id, point) => store.moveRegion(id, point),
      onResizeRegion: (id, bounds) => store.resizeRegion(id, bounds),
      onCreateConnection: (fromId, toId) => store.createConnection(fromId, toId),
      onEditNode,
      onSessionAdvance: (id) => store.advanceSession(id),
      onDuplicateNodesInPlace: (ids) => store.duplicateNodesInPlace(ids).map((node) => ({ id: node.id, x: node.x, y: node.y })),
    });
    engineRef.current = engine;
    void engine.init().then(() => {
      engine.setState(store.getSnapshot());
      // fitAll safely waits for ResizeObserver when WebView2 has not laid out
      // the workspace yet.
      engine.fitAll();
    });
    // Exposes the engine's coordinate transforms for the Playwright e2e
    // suite, which needs exact screen coordinates for a node to simulate a
    // real drag gesture. Harmless in production: it is only ever read, and
    // only by tests.
    if (typeof window !== "undefined") {
      (window as unknown as { __rpgCanvasEngine?: CanvasEngine }).__rpgCanvasEngine = engine;
    }
    const unsubscribe = store.subscribe(() => {
      engine.setState(store.getSnapshot());
    });
    return () => {
      unsubscribe();
      engine.destroy();
      engineRef.current = null;
    };
  }, [onCameraChange, onContextMenu, onCreateNode, onEditNode, store]);

  useEffect(() => {
    engineRef.current?.setSessionMode(sessionMode, activeSessionId);
  }, [activeSessionId, sessionMode]);

  useEffect(() => {
    engineRef.current?.setFocusMode(focusMode);
  }, [focusMode]);

  return <div ref={hostRef} className="canvas-surface" aria-label="Canvas visual da campanha" />;
});
