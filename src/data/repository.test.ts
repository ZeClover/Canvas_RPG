import { beforeEach, describe, expect, it } from "vitest";
import { createDemoWorkspace } from "./seed";
import { listBackups, loadWorkspace, restoreBackup, saveWorkspace } from "./repository";

describe("backups no navegador", () => {
  beforeEach(() => localStorage.clear());

  it("mantém uma cópia recente e uma cópia histórica", async () => {
    const workspace = createDemoWorkspace();
    await saveWorkspace(workspace);
    const backups = await listBackups();
    expect(backups.filter((backup) => backup.projectId === workspace.project.id)).toHaveLength(2);
    expect(backups.some((backup) => backup.latest)).toBe(true);
  });

  it("atualiza o backup recente sem criar históricos a cada salvamento", async () => {
    const workspace = createDemoWorkspace();
    await saveWorkspace(workspace);
    workspace.project = { ...workspace.project, title: "Título recuperável", updatedAt: Date.now() };
    await saveWorkspace(workspace);
    const backups = await listBackups();
    expect(backups.filter((backup) => backup.projectId === workspace.project.id)).toHaveLength(2);
    const latest = backups.find((backup) => backup.latest)!;
    expect((await restoreBackup(latest.id)).project.title).toBe("Título recuperável");
  });

  it("recupera o projeto automaticamente quando os dados principais estão corrompidos", async () => {
    const workspace = createDemoWorkspace();
    await saveWorkspace(workspace);
    localStorage.setItem(`rpg-canvas-studio:workspace:${workspace.project.id}`, "{quebrado");
    const recovered = await loadWorkspace(workspace.project);
    expect(recovered.nodes).toHaveLength(workspace.nodes.length);
    expect(recovered.project.id).toBe(workspace.project.id);
  });
});
