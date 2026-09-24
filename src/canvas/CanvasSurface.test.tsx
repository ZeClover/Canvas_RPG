import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDemoWorkspace } from "../data/seed";
import { WorkspaceStore } from "../state/workspaceStore";
import { CanvasSurface } from "./CanvasSurface";

describe("CanvasSurface visual fallback", () => {
  it("renders regions, nodes and connections as SVG before Pixi initializes", () => {
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

    expect(markup).toContain('class="canvas-svg"');
    expect(markup).toContain(workspace.nodes[0].title);
    expect(markup).toContain(workspace.regions[0].title);
    expect(markup).toContain(`<path`);
  });
});
