import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDemoWorkspace } from "../data/seed";
import { WorkspaceStore } from "../state/workspaceStore";
import { CanvasSurface } from "./CanvasSurface";

describe("CanvasSurface", () => {
  it("hospeda um único elemento de canvas visível — CanvasEngine é a única fonte de verdade visual", () => {
    const workspace = createDemoWorkspace();
    const store = new WorkspaceStore(workspace);
    const markup = renderToStaticMarkup(
      <CanvasSurface
        store={store}
        sessionMode={false}
        activeSessionId={null}
        onCameraChange={() => undefined}
        onEditNode={() => undefined}
        onCreateNode={() => undefined}
        onContextMenu={() => undefined}
      />,
    );

    // No server-rendered SVG/text duplicate of the map: only the host div
    // that CanvasEngine will mount its single visible+interactive canvas
    // into on the client.
    expect(markup).toBe('<div class="canvas-surface" aria-label="Canvas visual da campanha"></div>');
  });
});
