import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasSurfaceHandle } from "./canvas/CanvasSurface";
import type { CanvasContextTarget } from "./canvas/CanvasEngine";
import { CanvasContextMenu } from "./components/CanvasContextMenu";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { BulkInspector } from "./components/BulkInspector";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { ConnectionInspector } from "./components/ConnectionInspector";
import { Minimap } from "./components/Minimap";
import { MusicPlayer } from "./components/MusicPlayer";
import { HelpPanel } from "./components/HelpPanel";
import { NodeEditor } from "./components/NodeEditor";
import { NodeInspector } from "./components/NodeInspector";
import { OutlinePanel } from "./components/OutlinePanel";
import { ProjectHome } from "./components/ProjectHome";
import { RegionInspector } from "./components/RegionInspector";
import { SearchPalette } from "./components/SearchPalette";
import { SessionPanel } from "./components/SessionPanel";
import { TemplatePanel } from "./components/TemplatePanel";
import { Topbar } from "./components/Topbar";
import {
  chooseProjectArchive,
  createProject,
  exportProject,
  importWorkspaceFromArchive,
  listBackups,
  listProjects,
  loadWorkspace,
  readProjectFile,
  restoreBackup,
  saveWorkspace,
  type BackupInfo,
} from "./data/repository";
import type { CameraState, CanvasRegion, Project, WorldBounds, WorldPoint, WorkspaceData } from "./domain/types";
import { useMusicPlayer } from "./music/useMusicPlayer";
import { useWorkspace } from "./state/useWorkspace";
import { WorkspaceStore } from "./state/workspaceStore";
import { BUILT_IN_TEMPLATES, loadCustomTemplates, saveCustomTemplates, templateFromSelection, type CanvasTemplate } from "./data/templateLibrary";

const initialCamera: CameraState = { x: 0, y: 0, scale: 1, viewportWidth: 1200, viewportHeight: 700 };
const CanvasSurface = lazy(() => import("./canvas/CanvasSurface").then((module) => ({ default: module.CanvasSurface })));

function sessionRegionIds(regions: CanvasRegion[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const region of regions) {
      if (region.parentRegionId && ids.has(region.parentRegionId) && !ids.has(region.id)) {
        ids.add(region.id);
        changed = true;
      }
    }
  }
  return ids;
}

function exportSessionSummary(state: WorkspaceData, sessionId: string): void {
  const session = state.regions.find((region) => region.id === sessionId);
  if (!session) return;
  const ids = sessionRegionIds(state.regions, sessionId);
  const nodes = state.nodes.filter((node) => node.regionId && ids.has(node.regionId));
  const sections = (["completed", "active", "pending"] as const).map((status) => {
    const labels = { completed: "Concluídos", active: "Em andamento", pending: "Pendentes" };
    const items = nodes.filter((node) => (state.sessionProgress[node.id] ?? "pending") === status);
    return `## ${labels[status]}\n\n${items.length ? items.map((node) => `- ${node.title}`).join("\n") : "- Nenhum"}`;
  });
  const content = `# ${session.title}\n\nProjeto: ${state.project.title}\nExportado em: ${new Date().toLocaleString("pt-BR")}\n\n${sections.join("\n\n")}`;
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sessao-${session.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resumo"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [store, setStore] = useState<WorkspaceStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeError, setHomeError] = useState("");
  const music = useMusicPlayer();

  useEffect(() => {
    void Promise.allSettled([listProjects(), listBackups()])
      .then(([projectResult, backupResult]) => {
        const availableBackups = backupResult.status === "fulfilled" ? backupResult.value : [];
        setBackups(availableBackups);
        if (projectResult.status === "fulfilled") {
          setProjects(projectResult.value);
        } else {
          const recoveredProjects = new Map<string, Project>();
          for (const backup of availableBackups) {
            if (!recoveredProjects.has(backup.projectId)) {
              recoveredProjects.set(backup.projectId, {
                id: backup.projectId,
                title: backup.title,
                description: "Disponível para recuperação pelo backup",
                color: "#a78bfa",
                updatedAt: backup.createdAt,
              });
            }
          }
          setProjects([...recoveredProjects.values()]);
          setHomeError("O banco principal não pôde ser lido. Você ainda pode recuperar seus projetos pelos backups.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function openProject(project: Project) {
    setLoading(true);
    setHomeError("");
    try {
      const workspace = await loadWorkspace(project);
      setStore(new WorkspaceStore(workspace));
    } catch (cause) {
      setHomeError(cause instanceof Error ? cause.message : "Não foi possível abrir o projeto. Tente recuperar um backup.");
    } finally {
      setLoading(false);
    }
  }

  async function addProject(project: Project) {
    await createProject(project);
    setProjects((items) => [project, ...items]);
    await openProject(project);
  }

  async function importProject(file?: File) {
    setHomeError("");
    const text = file ? await readProjectFile(file) : await chooseProjectArchive();
    if (!text) return;
    const workspace = importWorkspaceFromArchive(text, projects);
    await saveWorkspace(workspace);
    setProjects((items) => [workspace.project, ...items]);
    setBackups(await listBackups());
    setStore(new WorkspaceStore(workspace));
  }

  async function recoverProject(backup: BackupInfo) {
    setHomeError("");
    const workspace = await restoreBackup(backup.id);
    const [items, availableBackups] = await Promise.all([listProjects(), listBackups()]);
    setProjects(items);
    setBackups(availableBackups);
    setStore(new WorkspaceStore(workspace));
  }

  async function leaveWorkspace() {
    if (!store) return;
    await store.saveNow();
    const [projectResult, backupResult] = await Promise.allSettled([listProjects(), listBackups()]);
    if (projectResult.status === "fulfilled") setProjects(projectResult.value);
    if (backupResult.status === "fulfilled") setBackups(backupResult.value);
    setStore(null);
  }

  return (
    <AppErrorBoundary><div className="app-shell">
      {loading ? (
        <div className="app-loading"><span className="loading-orbit" /><strong>Montando seu universo…</strong></div>
      ) : store ? (
        <Workspace key={store.getSnapshot().project.id} store={store} onBack={() => void leaveWorkspace()} />
      ) : (
        <ProjectHome
          projects={projects}
          backups={backups}
          onOpen={openProject}
          onCreate={addProject}
          onImport={importProject}
          onRestore={recoverProject}
          externalError={homeError}
        />
      )}
      <MusicPlayer player={music} />
    </div></AppErrorBoundary>
  );
}

function Workspace({ store, onBack }: { store: WorkspaceStore; onBack: () => void }) {
  const state = useWorkspace(store);
  const canvasRef = useRef<CanvasSurfaceHandle>(null);
  const [camera, setCamera] = useState(initialCamera);
  const [sessionMode, setSessionMode] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false);
  const [outlineSessionId, setOutlineSessionId] = useState<string | null>(null);
  const [templatePanelOpen, setTemplatePanelOpen] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CanvasTemplate[]>(() => loadCustomTemplates());
  const [helpOpen, setHelpOpen] = useState(() => localStorage.getItem("rpg-canvas:onboarding-v1") !== "done");
  const [searchOpen, setSearchOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; bounds: WorldBounds } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const [contextMenu, setContextMenu] = useState<CanvasContextTarget | null>(null);

  const selectedNode = useMemo(
    () => state.selectedNodeIds.length === 1 ? state.nodes.find((node) => node.id === state.selectedNodeIds[0]) ?? null : null,
    [state.nodes, state.selectedNodeIds],
  );
  const selectedRegion = useMemo(
    () => state.selectedRegionId ? state.regions.find((region) => region.id === state.selectedRegionId) ?? null : null,
    [state.regions, state.selectedRegionId],
  );
  const selectedConnection = useMemo(
    () => state.selectedConnectionId ? state.connections.find((connection) => connection.id === state.selectedConnectionId) ?? null : null,
    [state.connections, state.selectedConnectionId],
  );

  const onCameraChange = useCallback((next: CameraState) => setCamera(next), []);
  const onEditNode = useCallback((id: string, bounds: WorldBounds) => setEditing({ id, bounds }), []);
  const onCreateNode = useCallback((id: string, screen: WorldPoint) => {
    setEditing({ id, bounds: { x: screen.x - 120, y: screen.y - 50, width: 240, height: 126 } });
  }, []);
  const onContextMenu = useCallback((target: CanvasContextTarget) => setContextMenu(target), []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (typing) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void store.saveNow();
      } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault(); store.redo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault(); store.undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault(); store.duplicateSelected();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        store.copySelected();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        store.pasteClipboard();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        store.deleteSelected();
      } else if (event.key.toLowerCase() === "f" && state.selectedNodeIds[0]) {
        canvasRef.current?.focusNode(state.selectedNodeIds[0]);
      } else if (event.key === "Home") {
        event.preventDefault(); canvasRef.current?.fitAll();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.selectedNodeIds, store]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!state.dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [state.dirty]);

  function closeHelp() {
    localStorage.setItem("rpg-canvas:onboarding-v1", "done");
    setHelpOpen(false);
  }

  function createAtCenter(kind: "node" | "region" | "session") {
    const center = canvasRef.current?.viewportCenter() ?? { x: 0, y: 0 };
    if (kind === "node") {
      const created = store.createNode({ x: center.x - 120, y: center.y - 60 });
      canvasRef.current?.focusNode(created.id);
      setEditing({ id: created.id, bounds: { x: camera.viewportWidth / 2 - 120, y: camera.viewportHeight / 2 - 60, width: 240, height: 126 } });
    } else {
      store.createRegion({ x: center.x - 460, y: center.y - 310 }, kind === "session" ? "session" : "region");
    }
  }

  async function exportCurrentProject() {
    setExporting(true);
    setTransferMessage("");
    try {
      await store.saveNow();
      const exported = await exportProject(store.getSnapshot());
      if (exported) setTransferMessage("Projeto exportado com sucesso.");
    } catch (cause) {
      setTransferMessage(cause instanceof Error ? cause.message : "Não foi possível exportar o projeto.");
    } finally {
      setExporting(false);
    }
  }

  const saveLabel = state.saving ? "Salvando…" : state.dirty ? "Alterações locais" : state.lastSavedAt ? "Salvo agora" : "Salvo localmente";
  const editNode = editing ? state.nodes.find((node) => node.id === editing.id) : null;

  return (
    <div className="workspace-screen">
      <Topbar
        project={state.project}
        sessionMode={sessionMode}
        saveLabel={saveLabel}
        zoom={camera.scale}
        onBack={onBack}
        onSearch={() => setSearchOpen(true)}
        onFitAll={() => canvasRef.current?.fitAll()}
        onToggleSession={() => setSessionPanelOpen(true)}
        onSave={() => void store.saveNow()}
        onExport={() => void exportCurrentProject()}
        onHelp={() => setHelpOpen(true)}
        exporting={exporting}
      />
      <main className="workspace-main">
        <Suspense fallback={<div className="canvas-loading"><span className="loading-orbit" />Preparando o mapa…</div>}>
          <CanvasSurface
            ref={canvasRef}
            store={store}
            sessionMode={sessionMode}
            activeSessionId={activeSessionId}
            onCameraChange={onCameraChange}
            onEditNode={onEditNode}
            onCreateNode={onCreateNode}
            onContextMenu={onContextMenu}
          />
        </Suspense>
        <CanvasToolbar
          selectedCount={state.selectedNodeIds.length}
          hasSelection={state.selectedNodeIds.length > 0 || Boolean(state.selectedRegionId) || Boolean(state.selectedConnectionId)}
          onAddNode={() => createAtCenter("node")}
          onAddRegion={() => createAtCenter("region")}
          onAddSession={() => createAtCenter("session")}
          onConnect={() => store.connectSelected()}
          onCreateReference={() => {
            const sourceId = state.selectedNodeIds[0];
            const center = canvasRef.current?.viewportCenter() ?? { x: 0, y: 0 };
            const reference = sourceId ? store.createReference(sourceId, { x: center.x - 120, y: center.y - 60 }) : null;
            if (reference) canvasRef.current?.focusNode(reference.id);
          }}
          onOpenTemplates={() => setTemplatePanelOpen(true)}
          onDelete={() => store.deleteSelected()}
        />
        <Minimap state={state} camera={camera} onNavigate={(point) => canvasRef.current?.centerOn(point)} />
        <div className="canvas-hint">Arraste o fundo para selecionar · Espaço + arrastar move o mapa · Puxe o ponto lateral para conectar</div>
        {state.selectedNodeIds.length > 1 && <div className="multi-selection-badge">{state.selectedNodeIds.length} caixas selecionadas · arraste uma para mover o conjunto</div>}
        {state.selectedNodeIds.length > 1 && (
          <BulkInspector count={state.selectedNodeIds.length} onUpdate={(updates) => store.updateSelectedNodes(updates)} onClose={() => store.clearSelection()} />
        )}
        {transferMessage && <button className="transfer-toast" onClick={() => setTransferMessage("")}>{transferMessage}</button>}
        {sessionMode && <div className="session-toast"><span className="live-dot" /> Sessão ativa · clique nos acontecimentos conforme eles ocorrem</div>}
        {editNode && editing && (
          <NodeEditor
            initialValue={editNode.title}
            bounds={editing.bounds}
            onCommit={(title) => { store.updateNode(editNode.id, { title }); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        )}
        {selectedNode && !editing && (
          <NodeInspector node={selectedNode} onUpdate={(updates) => store.updateNode(selectedNode.id, updates)} onClose={() => store.clearSelection()} />
        )}
        {selectedRegion && !editing && (
          <RegionInspector region={selectedRegion} onUpdate={(updates) => store.updateRegion(selectedRegion.id, updates)} onClose={() => store.clearSelection()} />
        )}
        {selectedConnection && !editing && (
          <ConnectionInspector
            connection={selectedConnection}
            onUpdate={(updates) => store.updateConnection(selectedConnection.id, updates)}
            onReverse={() => store.reverseConnection(selectedConnection.id)}
            onDelete={() => store.deleteConnection(selectedConnection.id)}
            onClose={() => store.clearSelection()}
          />
        )}
        {contextMenu && (
          <CanvasContextMenu
            target={contextMenu}
            onClose={() => setContextMenu(null)}
            onAction={(action) => {
              if (action === "node") store.createNode({ x: contextMenu.world.x - 120, y: contextMenu.world.y - 60 });
              else if (action === "region" || action === "session") store.createRegion(contextMenu.world, action === "session" ? "session" : "region");
              else if (action === "duplicate") store.duplicateSelected();
              else if (action === "reference" && contextMenu.id) store.createReference(contextMenu.id, { x: contextMenu.world.x + 40, y: contextMenu.world.y + 40 });
              else if (action === "delete") store.deleteSelected();
            }}
          />
        )}
      </main>
      {sessionPanelOpen && (
        <SessionPanel
          regions={state.regions}
          nodes={state.nodes}
          progress={state.sessionProgress}
          activeSessionId={activeSessionId}
          onStart={(id) => {
            setActiveSessionId(id);
            setSessionMode(true);
            setSessionPanelOpen(false);
            requestAnimationFrame(() => canvasRef.current?.focusRegion(id));
          }}
          onStop={() => { setSessionMode(false); setActiveSessionId(null); }}
          onReset={(id) => store.resetSession(id)}
          onExport={(id) => exportSessionSummary(state, id)}
          onOutline={(id) => { setSessionPanelOpen(false); setOutlineSessionId(id); }}
          onClose={() => setSessionPanelOpen(false)}
        />
      )}
      {outlineSessionId ? (
        <OutlinePanel
          sessionId={outlineSessionId}
          nodes={state.nodes}
          regions={state.regions}
          connections={state.connections}
          progress={state.sessionProgress}
          onFocus={(id) => { setOutlineSessionId(null); store.selectNode(id); requestAnimationFrame(() => canvasRef.current?.focusNode(id)); }}
          onClose={() => setOutlineSessionId(null)}
        />
      ) : null}
      {helpOpen ? <HelpPanel state={state} onClose={closeHelp} /> : null}
      {templatePanelOpen && (
        <TemplatePanel
          templates={[...BUILT_IN_TEMPLATES, ...customTemplates]}
          canSaveSelection={state.selectedNodeIds.length === 1 || Boolean(state.selectedRegionId)}
          onUse={(template) => {
            store.createFromTemplate(template, canvasRef.current?.viewportCenter() ?? { x: 0, y: 0 });
            setTemplatePanelOpen(false);
          }}
          onSaveSelection={(name) => {
            const created = templateFromSelection(state, name);
            if (!created) return;
            setCustomTemplates((current) => {
              const next = [...current, created];
              saveCustomTemplates(next);
              return next;
            });
          }}
          onDelete={(id) => setCustomTemplates((current) => {
            const next = current.filter((template) => template.id !== id);
            saveCustomTemplates(next);
            return next;
          })}
          onClose={() => setTemplatePanelOpen(false)}
        />
      )}
      {searchOpen && (
        <SearchPalette
          nodes={state.nodes}
          onClose={() => setSearchOpen(false)}
          onChoose={(node) => {
            store.selectNode(node.id);
            canvasRef.current?.focusNode(node.id);
            setSearchOpen(false);
          }}
        />
      )}
    </div>
  );
}
