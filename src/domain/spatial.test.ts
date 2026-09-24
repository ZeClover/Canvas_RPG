import { describe, expect, it } from "vitest";
import { cameraForBounds, clampScale, collectBounds, semanticLod } from "./spatial";

describe("spatial helpers", () => {
  it("classifica os níveis semânticos", () => {
    expect(semanticLod(0.05)).toBe("overview");
    expect(semanticLod(0.2)).toBe("region");
    expect(semanticLod(0.5)).toBe("node");
    expect(semanticLod(1)).toBe("detail");
  });

  it("limita o zoom", () => {
    expect(clampScale(0)).toBe(0.035);
    expect(clampScale(99)).toBe(3.5);
  });

  it("calcula limites e câmera para ver tudo", () => {
    const nodes = [
      { x: -100, y: 20, width: 80, height: 40 },
      { x: 300, y: 200, width: 100, height: 70 },
    ];
    const bounds = collectBounds(nodes as never, []);
    expect(bounds).toEqual({ x: -100, y: 20, width: 500, height: 250 });
    const camera = cameraForBounds(bounds, 1000, 600, 50);
    expect(camera.scale).toBeGreaterThan(0);
    expect(camera.viewportWidth).toBe(1000);
  });
});

