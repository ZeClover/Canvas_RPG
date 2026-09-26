import { useMemo, useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { causalChain, type CausalNode } from "../../domain/graph";
import { relationConfig } from "../../domain/relationTypeRegistry";
import type { Entity, Relation } from "../../domain/types";
import { useEscapeToClose } from "../../hooks/useEscapeToClose";
import { Icons } from "../Icons";

interface CausalityPanelProps {
  entities: Entity[];
  relations: Relation[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

/** Which relation types count as "caused this" for the purposes of the
 * Butterfly Effect view — the GM draws these relations by hand, this panel
 * only walks them. */
const CAUSAL_RELATION_TYPES = new Set(["caused", "leads_to", "unlocks_on_success", "unlocks_on_fail"]);

function CausalTree({ nodes, onSelect }: { nodes: CausalNode[]; onSelect: (id: string) => void }) {
  return (
    <ul className="causal-tree">
      {nodes.map((node) => (
        <li key={node.relation.id}>
          <button type="button" className="entity-row" onClick={() => onSelect(node.entity.id)}>
            <span className="entity-row-icon">{node.entity.icon ?? kindConfig(node.entity.kind).icon}</span>
            <span className="entity-row-body">
              <span className="entity-row-title">{node.entity.title || "Sem título"}</span>
              <span className="entity-row-meta" style={{ color: relationConfig(node.relation.type).color }}>{relationConfig(node.relation.type).label}</span>
            </span>
          </button>
          {node.children.length > 0 && <CausalTree nodes={node.children} onSelect={onSelect} />}
        </li>
      ))}
    </ul>
  );
}

/** Butterfly Effect / Causality: pure recursive traversal of "causou"/"leva
 * a"/"desbloqueia se…" relations, both directions, cycle-safe. Nothing is
 * inferred — a chain only exists here because the GM already connected it
 * on the Canvas. */
export function CausalityPanel({ entities, relations, onClose, onFocusEntity }: CausalityPanelProps) {
  useEscapeToClose(onClose);
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const [focusId, setFocusId] = useState("");

  const focusOptions = useMemo(
    () => [...entities].filter((entity) => entity.kind !== "group").sort((a, b) => a.title.localeCompare(b.title)),
    [entities],
  );

  const backward = useMemo(
    () => (focusId ? causalChain(focusId, entityById, relations, CAUSAL_RELATION_TYPES, "backward") : []),
    [focusId, entityById, relations],
  );
  const forward = useMemo(
    () => (focusId ? causalChain(focusId, entityById, relations, CAUSAL_RELATION_TYPES, "forward") : []),
    [focusId, entityById, relations],
  );

  function select(id: string) {
    onFocusEntity(id);
    onClose();
  }

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Efeito borboleta">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">CAUSALIDADE</span><h2>Efeito borboleta</h2></div>
          <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="graph-focus-form">
          <select value={focusId} onChange={(event) => setFocusId(event.target.value)}>
            <option value="">Escolha uma decisão, evento, quest…</option>
            {focusOptions.map((entity) => <option value={entity.id} key={entity.id}>{kindConfig(entity.kind).icon} {entity.title}</option>)}
          </select>
        </div>

        {focusId ? (
          <div className="tool-panel-columns">
            <div className="tool-panel-section">
              <span className="eyebrow">O QUE LEVOU A ISSO</span>
              {backward.length ? <CausalTree nodes={backward} onSelect={select} /> : <div className="tool-panel-empty">Nada registrado como causa disso ainda.</div>}
            </div>
            <div className="tool-panel-section">
              <span className="eyebrow">O QUE ISSO CAUSOU</span>
              {forward.length ? <CausalTree nodes={forward} onSelect={select} /> : <div className="tool-panel-empty">Ainda não causou nada registrado.</div>}
            </div>
          </div>
        ) : (
          <div className="tool-panel-empty">Escolha um elemento para ver a cadeia de causas e consequências (usa as relações "causou", "leva a" e "desbloqueia se…").</div>
        )}
      </section>
    </div>
  );
}
