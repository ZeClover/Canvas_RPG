// Pure geometry for "Alinhar/Distribuir seleção" — no store, no canvas, just
// bounds in → moves out, so CampaignStore can commit it as a single
// moveEntities() call (one undo entry) and the math is unit-testable on
// its own.

export interface AlignableBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AlignMode = "left" | "centerX" | "right" | "top" | "centerY" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";

export interface Move {
  id: string;
  x: number;
  y: number;
}

/** Requires at least two entities — aligning a single one is a no-op. */
export function computeAlignment(entities: AlignableBounds[], mode: AlignMode): Move[] {
  if (entities.length < 2) return [];
  switch (mode) {
    case "left": {
      const x = Math.min(...entities.map((entity) => entity.x));
      return entities.map((entity) => ({ id: entity.id, x, y: entity.y }));
    }
    case "right": {
      const right = Math.max(...entities.map((entity) => entity.x + entity.width));
      return entities.map((entity) => ({ id: entity.id, x: right - entity.width, y: entity.y }));
    }
    case "centerX": {
      const center = entities.reduce((sum, entity) => sum + entity.x + entity.width / 2, 0) / entities.length;
      return entities.map((entity) => ({ id: entity.id, x: center - entity.width / 2, y: entity.y }));
    }
    case "top": {
      const y = Math.min(...entities.map((entity) => entity.y));
      return entities.map((entity) => ({ id: entity.id, x: entity.x, y }));
    }
    case "bottom": {
      const bottom = Math.max(...entities.map((entity) => entity.y + entity.height));
      return entities.map((entity) => ({ id: entity.id, x: entity.x, y: bottom - entity.height }));
    }
    case "centerY": {
      const center = entities.reduce((sum, entity) => sum + entity.y + entity.height / 2, 0) / entities.length;
      return entities.map((entity) => ({ id: entity.id, x: entity.x, y: center - entity.height / 2 }));
    }
  }
}

/** Requires at least three entities — with two, there is no "middle" to
 * redistribute, only the two fixed outer ones. The two outermost entities
 * (by position along the axis) anchor the span; everyone else, including
 * those two, gets an equal gap between edges. */
export function computeDistribution(entities: AlignableBounds[], axis: DistributeAxis): Move[] {
  if (entities.length < 3) return [];
  const key = axis === "horizontal" ? "x" : "y";
  const sizeKey = axis === "horizontal" ? "width" : "height";
  const sorted = [...entities].sort((a, b) => a[key] - b[key]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSize = sorted.reduce((sum, entity) => sum + entity[sizeKey], 0);
  const span = last[key] + last[sizeKey] - first[key];
  const gap = (span - totalSize) / (sorted.length - 1);
  let cursor = first[key];
  const moves: Move[] = [];
  for (const entity of sorted) {
    moves.push(axis === "horizontal" ? { id: entity.id, x: cursor, y: entity.y } : { id: entity.id, x: entity.x, y: cursor });
    cursor += entity[sizeKey] + gap;
  }
  return moves;
}
