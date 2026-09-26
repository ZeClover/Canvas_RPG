import { useMemo, useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface PlayerKnowledgeViewPanelProps {
  entities: Entity[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

/** Player Knowledge View: a read-only reference of what players
 * officially know, built entirely from the `visibility` field every
 * entity already has (gm_only/partial/revealed) — no separate "player
 * database", so it can never drift from what the GM actually set on each
 * card. "Partial" entities show only that they exist, not their details;
 * "gm_only" ones don't appear here at all. */
export function PlayerKnowledgeViewPanel({ entities, onClose, onFocusEntity }: PlayerKnowledgeViewPanelProps) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entities
      .filter((entity) => entity.kind !== "group" && entity.visibility !== "gm_only")
      .filter((entity) => !query || entity.title.toLowerCase().includes(query))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [entities, search]);

  const revealedCount = rows.filter((entity) => entity.visibility === "revealed").length;

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Player Knowledge View">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">PLAYER KNOWLEDGE VIEW</span><h2>O que os jogadores sabem</h2></div>
          <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="timeline-filters">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título…" />
          <span className="player-view-count">{revealedCount} revelado(s) · {rows.length - revealedCount} parcial(is)</span>
        </div>

        <ul className="entity-list player-view-list">
          {rows.map((entity) => (
            <li key={entity.id}>
              <button type="button" className="entity-row" onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                <span className="entity-row-icon">{entity.icon ?? kindConfig(entity.kind).icon}</span>
                <span className="entity-row-body">
                  <span className="entity-row-title">{entity.title || "Sem título"}</span>
                  {entity.visibility === "revealed" ? (
                    <span className="entity-row-meta">{entity.summary || kindConfig(entity.kind).label}</span>
                  ) : (
                    <span className="entity-row-meta player-view-partial">Parcialmente revelado — jogadores sabem que existe</span>
                  )}
                </span>
              </button>
            </li>
          ))}
          {!rows.length && <li className="tool-panel-empty">Nada revelado aos jogadores ainda — mude a "Visibilidade para jogadores" no inspetor de um elemento.</li>}
        </ul>
      </section>
    </div>
  );
}
