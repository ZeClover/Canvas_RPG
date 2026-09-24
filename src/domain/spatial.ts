import type { CameraState, CanvasNode, CanvasRegion, WorldBounds } from "./types";

const MIN_SCALE = 0.035;
const MAX_SCALE = 3.5;

export type SemanticLod = "overview" | "region" | "node" | "detail";

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function semanticLod(scale: number): SemanticLod {
  if (scale < 0.12) return "overview";
  if (scale < 0.32) return "region";
  if (scale < 0.7) return "node";
  return "detail";
}

export function cameraWorldBounds(camera: CameraState, margin = 200): WorldBounds {
  return {
    x: -camera.x / camera.scale - margin,
    y: -camera.y / camera.scale - margin,
    width: camera.viewportWidth / camera.scale + margin * 2,
    height: camera.viewportHeight / camera.scale + margin * 2,
  };
}

export function intersects(a: WorldBounds, b: WorldBounds): boolean {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  );
}

export function collectBounds(
  nodes: readonly CanvasNode[],
  regions: readonly CanvasRegion[],
): WorldBounds {
  const items = [...nodes, ...regions];
  if (!items.length) return { x: -400, y: -250, width: 800, height: 500 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function cameraForBounds(
  bounds: WorldBounds,
  viewportWidth: number,
  viewportHeight: number,
  padding = 100,
): CameraState {
  const safeWidth = Math.max(1, bounds.width + padding * 2);
  const safeHeight = Math.max(1, bounds.height + padding * 2);
  const scale = clampScale(Math.min(viewportWidth / safeWidth, viewportHeight / safeHeight));
  return {
    x: viewportWidth / 2 - (bounds.x + bounds.width / 2) * scale,
    y: viewportHeight / 2 - (bounds.y + bounds.height / 2) * scale,
    scale,
    viewportWidth,
    viewportHeight,
  };
}

