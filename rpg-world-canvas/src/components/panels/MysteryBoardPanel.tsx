import { useMemo, useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { bfsFrom, buildAdjacency, degreeCounts, orphanEntities } from "../../domain/graph";
import { relationConfig } from "../../domain/relationTypeRegistry";
import type { Entity, EntityKind, Relation } from "../../domain/types";
import { Icons } from "../Icons";

interface MysteryBoardPanelProps {
  entities: Entity[];
  relations: Relation[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

const MYSTERY_KINDS: EntityKind[] = ["secret", "clue", "rumor"];

/** Mystery/Conspiracy Board: no invented connections, no "AI suggests a
 * suspect" — just honest graph reading over the relations the GM already
 * drew: who's most connected, what's still a loose thread, and what sits
 * within N hops of a chosen focus. */
export function MysteryBoardPanel({ entities, relations, onClose, onFocusEntity }: MysteryBoardPanelProps) {
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const [focusId, setFocusId] = useState("");
  const [depth, setDepth] = useState(2);

  const adjacency = useMemo(() => buildAdjacency(relations), [relations]);
  const degrees = useMemo(() => degreeCounts(relations), [relations]);
  const orphans = useMemo(
    () => orphanEntities(entities.filter((entity) => MYSTERY_KINDS.includes(entity.kind)), relations),
    [entities, relations],
  );

  const hubs = useMemo(
    () => [...degrees.entries()]
      .map(([id, count]) => ({ entity: entityById.get(id), count }))
      .filter((row): row is { entity: Entity; count: number } => row.entity !== undefined && row.entity.kind !== "group")
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    [degrees, entityById],
  );

  const focusResults = useMemo(() => {
    if (!focusId) return [];
    return bfsFrom(focusId, adjacency, depth).sort((a, b) => a.distance - b.distance);
  }, [focusId, adjacency, depth]);

  const focusOptions = useMemo(
    () => [...entities].filter((entity) => entity.kind !== "group").sort((a, b) => a.title.localeCompare(b.title)),
    [entities],
  );

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Quadro de mistérios">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">MISTÉRIO</span><h2>Quadro de conspirações</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="tool-panel-columns">
          <div className="tool-panel-section">
            <span className="eyebrow">MAIS CONECTADOS</span>
            <ul className="entity-list">
              {hubs.map(({ entity, count }) => (
                <li key={entity.id}>
                  <button type="button" className="entity-row" onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                    <span className="entity-row-icon">{entity.icon ?? kindConfig(entity.kind).icon}</span>
                    <span className="entity-row-body">
                      <span className="entity-row-title">{entity.title || "Sem título"}</span>
                      <span className="entity-row-meta">{count} conexão(ões)</span>
                    </span>
                  </button>
                </li>
              ))}
              {!hubs.length && <li className="tool-panel-empty">Nenhuma relação criada ainda.</li>}
            </ul>
          </div>

          <div className="tool-panel-section">
            <span className="eyebrow">PISTAS SOLTAS ({orphans.length})</span>
            <ul className="entity-list">
              {orphans.map((entity) => (
                <li key={entity.id}>
                  <button type="button" className="entity-row" onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                    <span className="entity-row-icon">{entity.icon ?? kindConfig(entity.kind).icon}</span>
                    <span className="entity-row-body">
                      <span className="entity-row-title">{entity.title || "Sem título"}</span>
                      <span className="entity-row-meta">{kindConfig(entity.kind).label} · sem conexões</span>
                    </span>
                  </button>
                </li>
              ))}
              {!orphans.length && <li className="tool-panel-empty">Nenhuma pista solta — tudo já está conectado.</li>}
            </ul>
          </div>
        </div>

        <div className="tool-panel-section">
          <span className="eyebrow">EXPLORAR A PARTIR DE</span>
          <div className="graph-focus-form">
            <select value={focusId} onChange={(event) => setFocusId(event.target.value)}>
              <option value="">Escolha um elemento…</option>
              {focusOptions.map((entity) => <option value={entity.id} key={entity.id}>{kindConfig(entity.kind).icon} {entity.title}</option>)}
            </select>
            <label>
              Profundidade
              <input type="number" min={1} max={5} value={depth} onChange={(event) => setDepth(Math.max(1, Math.min(5, Number(event.target.value) || 1)))} />
            </label>
          </div>
          <ul className="entity-list">
            {focusResults.map((node) => {
              const entity = entityById.get(node.entityId);
              if (!entity) return null;
              return (
                <li key={entity.id}>
                  <button type="button" className="entity-row" onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                    <span className="entity-row-icon">{entity.icon ?? kindConfig(entity.kind).icon}</span>
                    <span className="entity-row-body">
                      <span className="entity-row-title">{entity.title || "Sem título"}</span>
                      <span className="entity-row-meta">{node.distance} passo(s){node.via ? ` · ${relationConfig(node.via.type).label}` : ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
            {focusId && !focusResults.length && <li className="tool-panel-empty">Nada conectado dentro dessa profundidade.</li>}
            {!focusId && <li className="tool-panel-empty">Escolha um elemento para explorar as conexões dele.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
