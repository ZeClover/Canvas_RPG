import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CameraState, WorldBounds, WorldPoint } from "../domain/types";
import type { WorkspaceState, WorkspaceStore } from "../state/workspaceStore";
import { CanvasEngine, type CanvasContextTarget } from "./CanvasEngine";

export interface CanvasSurfaceHandle {
  fitAll: () => void;
  focusNode: (id: string) => void;
  focusRegion: (id: string) => void;
  centerOn: (point: WorldPoint) => void;
  viewportCenter: () => WorldPoint;
}

interface CanvasSurfaceProps {
  store: WorkspaceStore;
  sessionMode: boolean;
  activeSessionId: string | null;
  onCameraChange: (camera: CameraState) => void;
  onEditNode: (id: string, bounds: WorldBounds) => void;
  onCreateNode: (id: string, screen: WorldPoint) => void;
  onContextMenu: (target: CanvasContextTarget) => void;
}

function isNodeInSession(state: WorkspaceState, regionId: string | null, sessionId: string | null): boolean {
  if (!sessionId) return true;
  const regions = new Map(state.regions.map((region) => [region.id, region]));
  let current = regionId ? regions.get(regionId) : undefined;
  while (current) {
    if (current.id === sessionId) return true;
    current = current.parentRegionId ? regions.get(current.parentRegionId) : undefined;
  }
  return false;
}

export const CanvasSurface = forwardRef<CanvasSurfaceHandle, CanvasSurfaceProps>(function CanvasSurface(
  { store, sessionMode, activeSessionId, onCameraChange, onEditNode, onCreateNode, onContextMenu },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [visualState, setVisualState] = useState<WorkspaceState>(() => store.getSnapshot());
  const [visualCamera, setVisualCamera] = useState<CameraState>({
    x: 0,
    y: 0,
    scale: 0.75,
    viewportWidth: 1,
    viewportHeight: 1,
  });

  useImperativeHandle(ref, () => ({
    fitAll: () => engineRef.current?.fitAll(),
    focusNode: (id) => engineRef.current?.focusNode(id),
    focusRegion: (id) => engineRef.current?.focusRegion(id),
    centerOn: (point) => engineRef.current?.centerOn(point),
    viewportCenter: () => engineRef.current?.getViewportCenter() ?? { x: 0, y: 0 },
  }), []);

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new CanvasEngine(hostRef.current, {
      onCameraChange: (camera) => {
        setVisualCamera(camera);
        onCameraChange(camera);
      },
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
    });
    engineRef.current = engine;
    void engine.init().then(() => {
      const snapshot = store.getSnapshot();
      engine.setState(snapshot);
      setVisualState(snapshot);
      // fitAll safely waits for ResizeObserver when WebView2 has not laid out
      // the workspace yet.
      engine.fitAll();
    });
    const unsubscribe = store.subscribe(() => {
      const snapshot = store.getSnapshot();
      engine.setState(snapshot);
      setVisualState(snapshot);
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

  const nodesById = new Map(visualState.nodes.map((node) => [node.id, node]));

  return (
    <div ref={hostRef} className="canvas-surface" aria-label="Canvas visual da campanha">
      <svg className="canvas-svg" aria-hidden="true">
        <defs>
          <pattern id="canvas-grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#536078" strokeOpacity="0.13" strokeWidth="1" />
          </pattern>
        </defs>
        <g transform={`translate(${visualCamera.x} ${visualCamera.y}) scale(${visualCamera.scale})`}>
          <rect x={-50000} y={-50000} width={100000} height={100000} fill="url(#canvas-grid)" />
          {visualState.regions.map((region) => (
            <g key={region.id}>
              <rect
                x={region.x}
                y={region.y}
                width={region.width}
                height={region.height}
                rx={24}
                fill={region.color}
                fillOpacity={region.kind === "session" ? 0.08 : 0.055}
                stroke={visualState.selectedRegionId === region.id ? "#ffffff" : region.color}
                strokeOpacity={visualState.selectedRegionId === region.id ? 0.95 : 0.58}
                strokeWidth={visualState.selectedRegionId === region.id ? 5 : 3}
                vectorEffect="non-scaling-stroke"
              />
              <text x={region.x + 22} y={region.y + 46} fill={region.color} fontSize={28} fontWeight={700}>
                {region.title}
              </text>
            </g>
          ))}
          {visualState.connections.map((connection) => {
            const from = nodesById.get(connection.fromNodeId);
            const to = nodesById.get(connection.toNodeId);
            if (!from || !to) return null;
            const x1 = from.x + from.width;
            const y1 = from.y + from.height / 2;
            const x2 = to.x;
            const y2 = to.y + to.height / 2;
            const direction = Math.sign(x2 - x1 || 1);
            const control = Math.max(60, Math.abs(x2 - x1) * 0.42);
            return (
              <path
                key={connection.id}
                d={`M ${x1} ${y1} C ${x1 + direction * control} ${y1}, ${x2 - direction * control} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={connection.color}
                strokeOpacity={visualState.selectedConnectionId === connection.id ? 1 : 0.72}
                strokeWidth={visualState.selectedConnectionId === connection.id ? 5 : 3}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {visualState.nodes.map((node) => {
            const selected = visualState.selectedNodeIds.includes(node.id);
            const active = !sessionMode || isNodeInSession(visualState, node.regionId, activeSessionId);
            const progress = visualState.sessionProgress[node.id] ?? "pending";
            const accent = progress === "completed" ? "#34d399" : progress === "active" ? "#fbbf24" : visualState.project.color;
            return (
              <g key={node.id} opacity={active ? 1 : 0.15}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={15}
                  fill={node.color}
                  stroke={selected ? "#ffffff" : accent}
                  strokeWidth={selected ? 4 : 2}
                  vectorEffect="non-scaling-stroke"
                />
                <rect x={node.x} y={node.y} width={7} height={node.height} rx={4} fill={accent} />
                <text x={node.x + 22} y={node.y + 39} fill="#f7f8ff" fontSize={19} fontWeight={650}>
                  {(node.title || "Sem título").length > 34 ? `${(node.title || "Sem título").slice(0, 34)}…` : node.title || "Sem título"}
                </text>
                {visualCamera.scale >= 0.7 && node.body ? (
                  <text x={node.x + 22} y={node.y + 75} fill="#aeb8ce" fontSize={13}>
                    {node.body.length > 48 ? `${node.body.slice(0, 48)}…` : node.body}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
});
