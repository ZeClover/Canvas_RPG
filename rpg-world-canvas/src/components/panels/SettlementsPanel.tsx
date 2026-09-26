import { useMemo, useState } from "react";
import { readSettlementFields } from "../../domain/settlementFields";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface SettlementsPanelProps {
  entities: Entity[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

type SortKey = "prosperity" | "stability";

/** World Progression / Settlement Engine: a sortable overview of every
 * city's growth, never simulated — each number and log entry here is
 * something the GM typed in after a session. */
export function SettlementsPanel({ entities, onClose, onFocusEntity }: SettlementsPanelProps) {
  const [sortKey, setSortKey] = useState<SortKey>("prosperity");

  const rows = useMemo(() => {
    return entities
      .filter((entity) => entity.kind === "city")
      .map((entity) => ({ entity, settlement: readSettlementFields(entity.fields) }))
      .sort((a, b) => b.settlement[sortKey] - a.settlement[sortKey]);
  }, [entities, sortKey]);

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Progresso do mundo">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">PROGRESSO DO MUNDO</span><h2>Assentamentos</h2></div>
          <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="timeline-filters">
          <label>Ordenar por
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
              <option value="prosperity">Prosperidade</option>
              <option value="stability">Estabilidade</option>
            </select>
          </label>
        </div>

        <ul className="entity-list settlement-list">
          {rows.map(({ entity, settlement }) => {
            const lastLog = settlement.log[settlement.log.length - 1];
            return (
              <li key={entity.id}>
                <button type="button" className="entity-row settlement-row" onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                  <span className="entity-row-icon">{entity.icon ?? "🏙️"}</span>
                  <span className="entity-row-body">
                    <span className="entity-row-title">{entity.title || "Sem título"}</span>
                    <span className="entity-row-meta">{settlement.stage} · {settlement.population || "população desconhecida"}</span>
                    {lastLog && <span className="settlement-last-log">{lastLog.note}</span>}
                  </span>
                  <span className="settlement-stats">
                    <span title="Prosperidade">💰 {settlement.prosperity}</span>
                    <span title="Estabilidade">🛡️ {settlement.stability}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {!rows.length && <li className="tool-panel-empty">Nenhuma cidade cadastrada ainda. Crie um elemento do tipo "Cidade" para acompanhar seu crescimento aqui.</li>}
        </ul>
      </section>
    </div>
  );
}
