import type { CanvasNode, CanvasRegion, ProgressState } from "../domain/types";
import { Icons } from "./Icons";

interface SessionPanelProps {
  regions: CanvasRegion[];
  nodes: CanvasNode[];
  progress: Record<string, ProgressState>;
  activeSessionId: string | null;
  onStart: (id: string) => void;
  onStop: () => void;
  onReset: (id: string) => void;
  onExport: (id: string) => void;
  onOutline: (id: string) => void;
  onClose: () => void;
}

function regionTreeIds(regions: CanvasRegion[], rootId: string): Set<string> {
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

export function SessionPanel({ regions, nodes, progress, activeSessionId, onStart, onStop, onReset, onExport, onOutline, onClose }: SessionPanelProps) {
  const sessions = regions.filter((region) => region.kind === "session");

  return (
    <div className="dialog-backdrop session-backdrop" onMouseDown={onClose}>
      <section className="session-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Sessões">
        <header className="session-panel-heading">
          <div><span className="eyebrow">MODO MESTRE</span><h2>Sessões</h2></div>
          <button className="icon-button" onClick={onClose} title="Fechar"><Icons.close /></button>
        </header>
        <div className="session-list">
          {sessions.length === 0 && <p className="session-empty">Crie uma área do tipo sessão no canvas para começar.</p>}
          {sessions.map((session) => {
            const regionIds = regionTreeIds(regions, session.id);
            const sessionNodes = nodes.filter((node) => node.regionId && regionIds.has(node.regionId));
            const completed = sessionNodes.filter((node) => progress[node.id] === "completed").length;
            const active = sessionNodes.filter((node) => progress[node.id] === "active").length;
            const percent = sessionNodes.length ? Math.round((completed / sessionNodes.length) * 100) : 0;
            const isRunning = activeSessionId === session.id;
            return (
              <article className={isRunning ? "session-card is-running" : "session-card"} key={session.id}>
                <div className="session-card-title">
                  <span style={{ background: session.color }} />
                  <div><strong>{session.title}</strong><small>{completed} concluídos · {active} em andamento · {sessionNodes.length} total</small></div>
                  <b>{percent}%</b>
                </div>
                <div className="session-progress"><span style={{ width: `${percent}%` }} /></div>
                <div className="session-card-actions">
                  <button className="primary-button" onClick={() => isRunning ? onStop() : onStart(session.id)}>
                    {isRunning ? <><Icons.stop /> Encerrar</> : <><Icons.play /> {completed || active ? "Continuar" : "Iniciar"}</>}
                  </button>
                  <button className="ghost-button" onClick={() => onExport(session.id)}><Icons.download /> Resumo</button>
                  <button className="ghost-button" onClick={() => onOutline(session.id)}><Icons.session /> Roteiro</button>
                  <button className="ghost-button session-reset" onClick={() => onReset(session.id)} disabled={!completed && !active}>Reiniciar</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
