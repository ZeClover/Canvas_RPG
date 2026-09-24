import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fixturePath = fileURLToPath(new URL("../examples/Academia-Magica.rpgcanvas", import.meta.url));

interface WorldPoint {
  x: number;
  y: number;
}

declare global {
  interface Window {
    __rpgCanvasEngine?: {
      worldToScreen(point: WorldPoint): WorldPoint;
      getCamera(): { x: number; y: number; scale: number; viewportWidth: number; viewportHeight: number };
    };
  }
}

test.describe("Academia Mágica — fluxo visual completo", () => {
  test("importa, arrasta uma caixa, salva e mantém a posição após reabrir", async ({ page }) => {
    // Skip the first-run help modal so it doesn't cover the canvas.
    await page.addInitScript(() => localStorage.setItem("rpg-canvas:onboarding-v1", "done"));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Seus mundos/i })).toBeVisible();

    // Import the Academia Mágica example (.rpgcanvas) through the same file
    // input the desktop build uses, since we're running the browser-storage
    // fallback here.
    await page.locator('input[type="file"]').setInputFiles(fixturePath);

    await expect(page.locator(".canvas-surface")).toBeVisible();
    await expect(page.locator("canvas.canvas-view")).toBeVisible();
    // Give the engine's ResizeObserver + fitAll animation a moment to settle.
    await page.waitForTimeout(600);

    // The imported project's title must appear in the top bar.
    await expect(page.locator(".project-identity strong")).toHaveText("Academia Mágica");

    const canvasLocator = page.locator("canvas.canvas-view");
    const canvasBox = await canvasLocator.boundingBox();
    if (!canvasBox) throw new Error("Canvas não tem uma caixa delimitadora visível.");

    const nodeWorld = { x: -140 + 120, y: -100 + 63 }; // center of "Chegada à escola" (n_gate)
    // worldToScreen returns coordinates local to the canvas element; Playwright's
    // mouse works in viewport coordinates, so the canvas's own offset (below the
    // top bar) must be added back in.
    const localBefore = await page.evaluate((point) => window.__rpgCanvasEngine!.worldToScreen(point), nodeWorld);
    const before = { x: canvasBox.x + localBefore.x, y: canvasBox.y + localBefore.y };

    await page.screenshot({ path: "test-results/academia-magica-before-drag.png" });

    // Real pointer drag on the live canvas, exercising the actual browser
    // pointer-event pipeline (not a synthetic dispatch from a unit test).
    await page.mouse.move(before.x, before.y);
    await page.mouse.down();
    await page.mouse.move(before.x + 160, before.y + 90, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    await page.screenshot({ path: "test-results/academia-magica-after-drag.png" });

    const afterCamera = await page.evaluate(() => window.__rpgCanvasEngine!.getCamera());
    const expectedWorldAfter = {
      x: (localBefore.x + 160 - afterCamera.x) / afterCamera.scale,
      y: (localBefore.y + 90 - afterCamera.y) / afterCamera.scale,
    };

    // Wait for autosave (650ms debounce) then read the persisted workspace
    // straight from the browser-storage fallback to confirm the box really
    // moved and was written to disk (localStorage in this environment).
    await page.waitForTimeout(900);
    const projectId = await page.evaluate(() => {
      const raw = localStorage.getItem("rpg-canvas-studio:projects");
      const projects = raw ? (JSON.parse(raw) as Array<{ id: string; title: string }>) : [];
      return projects.find((project) => project.title === "Academia Mágica")?.id ?? null;
    });
    expect(projectId).not.toBeNull();

    const savedNode = await page.evaluate((id) => {
      const raw = localStorage.getItem(`rpg-canvas-studio:workspace:${id}`);
      const workspace = raw ? JSON.parse(raw) : null;
      return workspace?.nodes.find((node: { id: string }) => node.id === "n_gate") ?? null;
    }, projectId);

    expect(savedNode).not.toBeNull();
    expect(savedNode.x).not.toBeCloseTo(-140, 0);
    // A generous tolerance here: the canvas snaps a drag to nearby
    // alignment guides (edges/centers of other boxes), so the persisted
    // position can land a little off the raw pointer delta by design —
    // this assertion is about "the box really moved and was saved", not
    // pixel-exact arithmetic.
    expect(Math.abs(savedNode.x - (expectedWorldAfter.x - 120))).toBeLessThan(60);
    expect(Math.abs(savedNode.y - (expectedWorldAfter.y - 63))).toBeLessThan(60);

    const movedX = savedNode.x;
    const movedY = savedNode.y;

    // Reopen the project from scratch (fresh navigation) and confirm the
    // new position survived the round trip through storage.
    await page.reload();
    await expect(page.getByRole("heading", { name: /Seus mundos/i })).toBeVisible();
    // The built-in demo project is also titled "Academia Mágica"; disambiguate
    // using the imported fixture's distinct description.
    await page.getByRole("button", { name: /facções/i }).click();
    await expect(page.locator("canvas.canvas-view")).toBeVisible();
    await page.waitForTimeout(600);

    const reopenedNode = await page.evaluate((id) => {
      const raw = localStorage.getItem(`rpg-canvas-studio:workspace:${id}`);
      const workspace = raw ? JSON.parse(raw) : null;
      return workspace?.nodes.find((node: { id: string }) => node.id === "n_gate") ?? null;
    }, projectId);

    expect(reopenedNode.x).toBeCloseTo(movedX, 3);
    expect(reopenedNode.y).toBeCloseTo(movedY, 3);
  });
});
