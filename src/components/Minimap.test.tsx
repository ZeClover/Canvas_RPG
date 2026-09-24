import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../test/canvasTestEnv";
import { createDemoWorkspace } from "../data/seed";
import { WorkspaceStore } from "../state/workspaceStore";
import { Minimap } from "./Minimap";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Minimap", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("clicar no minimapa navega para o ponto correspondente do mundo", () => {
    const workspace = createDemoWorkspace();
    const store = new WorkspaceStore(workspace);
    const state = store.getSnapshot();
    const camera = { x: 0, y: 0, scale: 1, viewportWidth: 1200, viewportHeight: 800 };
    const onNavigate = vi.fn();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Minimap state={state} camera={camera} onNavigate={onNavigate} />);
    });

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    Object.defineProperty(canvas, "clientWidth", { configurable: true, value: 220 });
    Object.defineProperty(canvas, "clientHeight", { configurable: true, value: 160 });
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 220, height: 160, right: 220, bottom: 160, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    // The effect that computes scale/offset ran on mount; simulate a click
    // roughly at the middle of the minimap.
    const event = new MouseEvent("click", { clientX: 110, clientY: 80, bubbles: true, cancelable: true });
    act(() => {
      canvas.dispatchEvent(event);
    });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    const point = onNavigate.mock.calls[0][0];
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);

    act(() => {
      root.unmount();
    });
  });
});
