import type { WorldBounds } from "./types";

type SpatialItem = WorldBounds & { id: string };

export class SpatialIndex<T extends SpatialItem> {
  private buckets = new Map<string, T[]>();
  private readonly cellSize: number;

  constructor(items: readonly T[] = [], cellSize = 1600) {
    this.cellSize = cellSize;
    this.rebuild(items);
  }

  rebuild(items: readonly T[]): void {
    this.buckets.clear();
    for (const item of items) {
      for (const key of this.keysFor(item)) {
        const bucket = this.buckets.get(key);
        if (bucket) bucket.push(item);
        else this.buckets.set(key, [item]);
      }
    }
  }

  search(bounds: WorldBounds): T[] {
    const found = new Map<string, T>();
    for (const key of this.keysFor(bounds)) {
      for (const item of this.buckets.get(key) ?? []) {
        if (!found.has(item.id) && this.intersects(bounds, item)) found.set(item.id, item);
      }
    }
    return [...found.values()];
  }

  private keysFor(bounds: WorldBounds): string[] {
    const startX = Math.floor(bounds.x / this.cellSize);
    const startY = Math.floor(bounds.y / this.cellSize);
    const endX = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const endY = Math.floor((bounds.y + bounds.height) / this.cellSize);
    const keys: string[] = [];
    for (let x = startX; x <= endX; x += 1) {
      for (let y = startY; y <= endY; y += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  }

  private intersects(a: WorldBounds, b: WorldBounds): boolean {
    return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
  }
}

