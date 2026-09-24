import { useMemo } from "react";
import type { CanvasConnection, CanvasNode, CanvasRegion, ProgressState } from "../domain/types";
import { NODE_KIND_LABELS } from "../domain/types";
import { buildSessionOutline } from "../domain/sessionOutline";
import { Icons } from "./Icons";

interface OutlinePanelProps {
  sessionId: string;
  nodes: CanvasNode[];
  regions: CanvasRegion[];
  connections: CanvasConnection[];
  progress: Record<string, ProgressState>;
  onFocus: (id: string) => void;
  onClose: () => void;
}

export function OutlinePanel({ sessionId, nodes, regions, connections, progress, onFocus, onClose }: OutlinePanelProps) {
  const session = regions.find((region) => region.id === sessionId);
  const outline = useMemo(() => buildSessionOutline(nodes, regions, connections, sessionId), [connections, nodes, regions, sessionId]);
  return (
    <div className="dialog-backdrop outline-backdrop" onMouseDown={onClose}>
      <section className="outline-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Roteiro da sessão">
        <header className="outline-heading">
          <div><span className="eyebrow">ROTEIRO DA SESSÃO</span><h2>{session?.title ?? "Sessão"}</h2><small>{outline.length} acontecimentos</small></div>
          <div className="outline-actions"><button className="ghost-button" onClick={() => window.print()}><Icons.download /> Imprimir/PDF</button><button className="icon-button" onClick={onClose} aria-label="Fechar"><Icons.close /></button></div>
        </header>
        <ol className="outline-list">
          {outline.map((node) => (
            <li key={node.id} className={`outline-item status-${progress[node.id] ?? "pending"}`}>
              <button onClick={() => onFocus(node.id)} aria-label={`Mostrar ${node.title} no mapa`}><span>{NODE_KIND_LABELS[node.kind]}</span><strong>{node.title}</strong></button>
              {node.body ? <p>{node.body}</p> : null}
              {node.tags.length ? <div className="outline-tags">{node.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
