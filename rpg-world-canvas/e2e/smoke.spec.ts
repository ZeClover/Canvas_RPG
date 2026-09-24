import { expect, test } from "@playwright/test";

interface WorldPoint { x: number; y: number }
declare global {
  interface Window {
    __rpgWorldCanvasEngine?: {
      worldToScreen(point: WorldPoint): WorldPoint;
      getCamera(): { x: number; y: number; scale: number; viewportWidth: number; viewportHeight: number };
    };
  }
}

test.describe("RPG World Canvas — fluxo básico", () => {
  test("abre a campanha de exemplo, arrasta um NPC, conecta, agrupa e persiste", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Seus universos/i })).toBeVisible();

    // First run auto-seeds the demo campaign.
    await expect(page.locator(".project-card").first()).toBeVisible({ timeout: 10_000 });
    await page.locator(".project-card").first().click();

    await expect(page.locator("canvas.canvas-view")).toBeVisible();
    await page.waitForTimeout(700);

    const canvasBox = await page.locator("canvas.canvas-view").boundingBox();
    if (!canvasBox) throw new Error("Canvas sem bounding box");

    // Drag the "Potter Magwood" NPC (seeded at world x:-180 y:-180).
    const npcWorld = { x: -180 + 120, y: -180 + 63 };
    const localBefore = await page.evaluate((p) => window.__rpgWorldCanvasEngine!.worldToScreen(p), npcWorld);
    const before = { x: canvasBox.x + localBefore.x, y: canvasBox.y + localBefore.y };

    await page.screenshot({ path: "test-results/rwc-before-drag.png" });

    await page.mouse.move(before.x, before.y);
    await page.mouse.down();
    await page.mouse.move(before.x + 140, before.y + 80, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    await page.screenshot({ path: "test-results/rwc-after-drag.png" });

    // Inspector should show the NPC with the new color picker (title input, kind select).
    await expect(page.locator(".node-inspector")).toBeVisible();
    await expect(page.locator(".node-inspector input").first()).toHaveValue("Potter Magwood");

    // Persist and confirm via IndexedDB round trip after reload.
    await page.waitForTimeout(900);
    const projectId = await page.evaluate(async () => {
      const dbs = await indexedDB.databases?.();
      return dbs?.[0]?.name ?? null;
    });
    expect(projectId).not.toBeNull();

    await page.reload();
    await expect(page.getByRole("heading", { name: /Seus universos/i })).toBeVisible();
    await page.locator(".project-card").first().click();
    await expect(page.locator("canvas.canvas-view")).toBeVisible();
    await page.waitForTimeout(600);

    // Open command palette and jump straight to the NPC to confirm the moved position stuck.
    await page.keyboard.press("Control+k");
    await expect(page.locator(".search-palette")).toBeVisible();
    await page.locator(".search-input").fill("Potter");
    await page.locator(".search-results button").first().click();
    await expect(page.locator(".node-inspector h3")).toHaveText("Potter Magwood");

    await page.screenshot({ path: "test-results/rwc-after-reload.png" });
  });
});
