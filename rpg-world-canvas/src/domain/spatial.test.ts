import { describe, expect, it } from "vitest";
import { cameraForBounds, collectBounds, selectionBounds } from "./spatial";

const near = { id: "near", x: 0, y: 0, width: 240, height: 126 };
const far = { id: "far", x: 9000, y: 9000, width: 240, height: 126 };

describe("spatial: selectionBounds (Fit Selection)", () => {
  it("retorna null quando não há seleção — quem chama deve cair para fitAll", () => {
    expect(selectionBounds([near, far], [])).toBeNull();
  });

  it("retorna null quando os IDs selecionados não batem com nenhuma entidade", () => {
    expect(selectionBounds([near, far], ["nope"])).toBeNull();
  });

  it("considera só as entidades selecionadas, ignorando as demais", () => {
    const bounds = selectionBounds([near, far], [near.id]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 240, height: 126 });
  });

  it("com múltiplas entidades selecionadas, é a união das bounds — igual collectBounds", () => {
    const bounds = selectionBounds([near, far], [near.id, far.id]);
    expect(bounds).toEqual(collectBounds([near, far]));
  });
});

describe("spatial: cameraForBounds", () => {
  it("centraliza o centro das bounds exatamente no centro do viewport", () => {
    const bounds = { x: 0, y: 0, width: 240, height: 126 };
    const camera = cameraForBounds(bounds, 1200, 800, 120);
    const worldCenterOnScreenX = (bounds.x + bounds.width / 2) * camera.scale + camera.x;
    const worldCenterOnScreenY = (bounds.y + bounds.height / 2) * camera.scale + camera.y;
    expect(worldCenterOnScreenX).toBeCloseTo(600, 5);
    expect(worldCenterOnScreenY).toBeCloseTo(400, 5);
  });
});
