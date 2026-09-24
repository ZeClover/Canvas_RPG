import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CanvasSurfaceHandle } from "./canvas/CanvasSurface";
import type { CanvasContextTarget } from "./canvas/CanvasEngine";
import { CampaignHome } from "./components/CampaignHome";
import { CanvasContextMenu } from "./components/CanvasContextMenu";
import { CanvasToolbar } from "./components/CanvasToolbar";
import { CommandPalette } from "./components/CommandPalette";
import { EntityInspector } from "./components/EntityInspector";
import { Minimap } from "./components/Minimap";
import { CausalityPanel } from "./components/panels/CausalityPanel";
import { KnowledgeEnginePanel } from "./components/panels/KnowledgeEnginePanel";
import { MysteryBoardPanel } from "./components/panels/MysteryBoardPanel";
import { RulesEnginePanel } from "./components/panels/RulesEnginePanel";
import { QuickEditor } from "./components/QuickEditor";
import { RelationInspector } from "./components/RelationInspector";
import { TimelinePanel } from "./components/TimelinePanel";
import { Topbar } from "./components/Topbar";
import {
  createCampaign,
  exportCampaignFile,
  importCampaignFromArchive,
  listBackups,
  listCampaigns,
  loadCampaignData,
  readCampaignFile,
  restoreBackup,
  seedCampaign,
  type BackupInfo,
} from "./data/repository";
import { createDemoCampaign } from "./data/seed";
import type { CameraState, Campaign, EntityKind, WorldBounds, WorldPoint } from "./domain/types";
import { CampaignStore } from "./state/campaignStore";
import { useCampaign } from "./state/useCampaign";

const initialCamera: CameraState = { x: 0, y: 0, scale: 1, viewportWidth: 1200, viewportHeight: 700 };
const CanvasSurface = lazy(() => import("./canvas/CanvasSurface").then((module) => ({ default: module.CanvasSurface })));

export default function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [store, setStore] = useState<CampaignStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeError, setHomeError] = useState("");

  useEffect(() => {
    void Promise.allSettled([listCampaigns(), listBackups()])
      .then(async ([campaignResult, backupResult]) => {
        const availableBackups = backupResult.status === "fulfilled" ? backupResult.value : [];
        setBackups(availableBackups);
        if (campaignResult.status !== "fulfilled") {
          setHomeError("Não foi possível ler o banco local.");
          return;
        }
        if (!campaignResult.value.length) {
          // First run: seed one example campaign so there's something to
          // explore immediately, matching every card type and relation type.
          const demo = createDemoCampaign();
          await seedCampaign(demo);
          setCampaigns([demo.campaign]);
          return;
        }
        setCampaigns(campaignResult.value);
      })
      .finally(() => setLoading(false));
  }, []);

  async function openCampaign(campaign: Campaign) {
    setLoading(true);
    setHomeError("");
    try {
      const data = await loadCampaignData(campaign.id);
      setStore(new CampaignStore(data));
    } catch (cause) {
      setHomeError(cause instanceof Error ? cause.message : "Não foi possível abrir a campanha.");
    } finally {
      setLoading(false);
    }
  }

  async function addCampaign(campaign: Campaign) {
    await createCampaign(campaign);
    setCampaigns((items) => [campaign, ...items]);
    await openCampaign(campaign);
  }

  async function importCampaign(file?: File) {
    setHomeError("");
    if (!file) return;
    const text = await readCampaignFile(file);
    const data = await importCampaignFromArchive(text);
    setCampaigns((items) => [data.campaign, ...items]);
    setBackups(await listBackups());
    setStore(new CampaignStore(data));
  }

  async function recoverCampaign(backup: BackupInfo) {
    setHomeError("");
    const data = await restoreBackup(backup.id);
    const [items, availableBackups] = await Promise.all([listCampaigns(), listBackups()]);
    setCampaigns(items);
    setBackups(availableBackups);
    setStore(new CampaignStore(data));
  }

  async function leaveWorkspace() {
    if (!store) return;
    await store.saveNow();
    const [campaignResult, backupResult] = await Promise.allSettled([listCampaigns(), listBackups()]);
    if (campaignResult.status === "fulfilled") setCampaigns(campaignResult.value);
    if (backupResult.status === "fulfilled") setBackups(backupResult.value);
    setStore(null);
  }

  return (
    <div className="app-shell">
      {loading ? (
        <div className="app-loading"><span className="loading-orbit" /><strong>Montando seu universo…</strong></div>
      ) : store ? (
        <Workspace key={store.getSnapshot().campaign.id} store={store} onBack={() => void leaveWorkspace()} />
      ) : (
        <CampaignHome
          campaigns={campaigns}
          backups={backups}
          onOpen={openCampaign}
          onCreate={addCampaign}
          onImport={importCampaign}
          onRestore={recoverCampaign}
          externalError={homeError}
        />
      )}
    </div>
  );
}

function Workspace({ store, onBack }: { store: CampaignStore; onBack: () => void }) {
  const state = useCampaign(store);
  const canvasRef = useRef<CanvasSurfaceHandle>(null);
  const [camera, setCamera] = useState(initialCamera);
  const [searchOpen, setSearchOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [mysteryOpen, setMysteryOpen] = useState(false);
  const [causalityOpen, setCausalityOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; bounds: WorldBounds } | null>(null);
  const [contextMenu, setContextMenu] = useState<CanvasContextTarget | null>(null);

  const selectedEntity = useMemo(
    () => state.selectedEntityIds.length === 1 ? state.entities.find((entity) => entity.id === state.selectedEntityIds[0]) ?? null : null,
    [state.entities, state.selectedEntityIds],
  );
  const selectedRelation = useMemo(
    () => state.selectedRelationId ? state.relations.find((relation) => relation.id === state.selectedRelationId) ?? null : null,
    [state.relations, state.selectedRelationId],
  );
  const selectedEntityRelations = useMemo(() => {
    if (!selectedEntity) return [];
    return state.relations.filter((relation) => relation.fromEntityId === selectedEntity.id || relation.toEntityId === selectedEntity.id);
  }, [selectedEntity, state.relations]);

  const onCameraChange = useCallback((next: CameraState) => setCamera(next), []);
  const onEditEntity = useCallback((id: string, bounds: WorldBounds) => setEditing({ id, bounds }), []);
  const onCreateEntity = useCallback((id: string, screen: WorldPoint) => {
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
        event.preventDefault();
        if (state.selectedEntityIds.length) store.duplicateEntitiesInPlace(state.selectedEntityIds);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        store.deleteSelected();
      } else if (event.key === "Home") {
        event.preventDefault(); canvasRef.current?.fitAll();
      } else if ((event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") && state.selectedEntityIds.length) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        const moves = state.entities.filter((entity) => state.selectedEntityIds.includes(entity.id)).map((entity) => ({ id: entity.id, x: entity.x + dx, y: entity.y + dy }));
        store.moveEntities(moves);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [state.entities, state.selectedEntityIds, store]);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!state.dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [state.dirty]);

  function createAtCenter(kind: EntityKind) {
    const center = canvasRef.current?.viewportCenter() ?? { x: 0, y: 0 };
    const created = store.createEntity(kind, { x: center.x - 120, y: center.y - 60 });
    canvasRef.current?.focusEntity(created.id);
  }

  async function exportCurrentCampaign() {
    await store.saveNow();
    await exportCampaignFile({ campaign: state.campaign, entities: state.entities, relations: state.relations, views: state.views });
  }

  const saveLabel = state.saving ? "Salvando…" : state.dirty ? "Alterações locais" : state.lastSavedAt ? "Salvo agora" : "Salvo localmente";
  const editEntity = editing ? state.entities.find((entity) => entity.id === editing.id) : null;

  return (
    <div className="workspace-screen">
      <Topbar
        campaign={state.campaign}
        saveLabel={saveLabel}
        zoom={camera.scale}
        views={state.views}
        activeViewId={state.activeViewId}
        onSetView={(id) => store.setActiveView(id)}
        onBack={onBack}
        onSearch={() => setSearchOpen(true)}
        onFitAll={() => canvasRef.current?.fitAll()}
        onSave={() => void store.saveNow()}
        onExport={() => void exportCurrentCampaign()}
        onOpenTimeline={() => setTimelineOpen(true)}
        onOpenKnowledge={() => setKnowledgeOpen(true)}
        onOpenMystery={() => setMysteryOpen(true)}
        onOpenCausality={() => setCausalityOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
      />
      <main className="workspace-main">
        <Suspense fallback={<div className="canvas-loading"><span className="loading-orbit" />Preparando o mapa…</div>}>
          <CanvasSurface ref={canvasRef} store={store} onCameraChange={onCameraChange} onEditEntity={onEditEntity} onCreateEntity={onCreateEntity} onContextMenu={onContextMenu} />
        </Suspense>
        <CanvasToolbar
          selectedCount={state.selectedEntityIds.length}
          hasSelection={state.selectedEntityIds.length > 0 || Boolean(state.selectedRelationId)}
          onAddEntity={(kind) => createAtCenter(kind)}
          onAddGroup={() => createAtCenter("group")}
          onConnect={() => {
            const [fromId, toId] = state.selectedEntityIds;
            if (fromId && toId) store.createRelation(fromId, toId, "custom");
          }}
          onDelete={() => store.deleteSelected()}
        />
        <Minimap entities={state.entities} camera={camera} onNavigate={(point) => canvasRef.current?.centerOn(point)} />
        <div className="canvas-hint">Arraste o fundo para selecionar · Espaço + arrastar move o mapa · Puxe o ponto lateral para conectar · Alt + arrastar duplica</div>
        {state.selectedEntityIds.length > 1 && <div className="multi-selection-badge">{state.selectedEntityIds.length} elementos selecionados · arraste um para mover o conjunto</div>}

        {editEntity && editing && (
          <QuickEditor
            initialValue={editEntity.title}
            bounds={editing.bounds}
            onCommit={(title) => { store.updateEntity(editEntity.id, { title }); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        )}
        {selectedEntity && !editing && (
          <EntityInspector
            entity={selectedEntity}
            allEntities={state.entities}
            relations={selectedEntityRelations}
            onUpdate={(updates) => store.updateEntity(selectedEntity.id, updates)}
            onClose={() => store.clearSelection()}
            onFocusEntity={(id) => { store.selectEntity(id); canvasRef.current?.focusEntity(id); }}
            onCreateRelation={(toId, type) => store.createRelation(selectedEntity.id, toId, type)}
            onDeleteRelation={(id) => store.deleteRelation(id)}
          />
        )}
        {selectedRelation && !editing && (
          <RelationInspector
            relation={selectedRelation}
            fromEntity={state.entities.find((entity) => entity.id === selectedRelation.fromEntityId) ?? null}
            toEntity={state.entities.find((entity) => entity.id === selectedRelation.toEntityId) ?? null}
            onUpdate={(updates) => store.updateRelation(selectedRelation.id, updates)}
            onReverse={() => store.reverseRelation(selectedRelation.id)}
            onDelete={() => store.deleteRelation(selectedRelation.id)}
            onClose={() => store.clearSelection()}
          />
        )}
        {contextMenu && (
          <CanvasContextMenu
            target={contextMenu}
            onClose={() => setContextMenu(null)}
            onAction={(action) => {
              if (action === "npc") store.createEntity("npc", { x: contextMenu.world.x - 120, y: contextMenu.world.y - 60 });
              else if (action === "group") store.createEntity("group", contextMenu.world);
              else if (action === "duplicate" && state.selectedEntityIds.length) store.duplicateEntitiesInPlace(state.selectedEntityIds);
              else if (action === "delete") store.deleteSelected();
            }}
          />
        )}
      </main>
      {searchOpen && (
        <CommandPalette
          entities={state.entities}
          onClose={() => setSearchOpen(false)}
          onChoose={(entity) => {
            store.selectEntity(entity.id);
            canvasRef.current?.focusEntity(entity.id);
            setSearchOpen(false);
          }}
        />
      )}
      {timelineOpen && (
        <TimelinePanel
          entities={state.entities}
          onClose={() => setTimelineOpen(false)}
          onFocusEntity={(id) => { store.selectEntity(id); canvasRef.current?.focusEntity(id); }}
        />
      )}
      {knowledgeOpen && (
        <KnowledgeEnginePanel
          entities={state.entities}
          relations={state.relations}
          onClose={() => setKnowledgeOpen(false)}
          onFocusEntity={(id) => { store.selectEntity(id); canvasRef.current?.focusEntity(id); }}
        />
      )}
      {mysteryOpen && (
        <MysteryBoardPanel
          entities={state.entities}
          relations={state.relations}
          onClose={() => setMysteryOpen(false)}
          onFocusEntity={(id) => { store.selectEntity(id); canvasRef.current?.focusEntity(id); }}
        />
      )}
      {causalityOpen && (
        <CausalityPanel
          entities={state.entities}
          relations={state.relations}
          onClose={() => setCausalityOpen(false)}
          onFocusEntity={(id) => { store.selectEntity(id); canvasRef.current?.focusEntity(id); }}
        />
      )}
      {rulesOpen && (
        <RulesEnginePanel
          entities={state.entities}
          onClose={() => setRulesOpen(false)}
          onFocusEntity={(id) => { store.selectEntity(id); canvasRef.current?.focusEntity(id); }}
          onToggleEnabled={(id, enabled) => {
            const rule = state.entities.find((entity) => entity.id === id);
            if (!rule) return;
            store.updateEntity(id, { fields: { ...rule.fields, enabled } });
          }}
          onCreateRule={() => { createAtCenter("rule"); setRulesOpen(false); }}
        />
      )}
    </div>
  );
}
