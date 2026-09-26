import { useState } from "react";
import { readTableFields, rollTable } from "../../domain/tableFields";
import type { Entity } from "../../domain/types";
import { useEscapeToClose } from "../../hooks/useEscapeToClose";
import { Icons } from "../Icons";

interface TablesPanelProps {
  entities: Entity[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
  onRecordRoll: (entityId: string, result: string) => void;
}

/** Random Table Engine: roll on any table from one place, without hunting
 * for its card or opening the inspector — built for the moment mid-session
 * where the GM needs a name/loot/rumor right now. */
export function TablesPanel({ entities, onClose, onFocusEntity, onRecordRoll }: TablesPanelProps) {
  useEscapeToClose(onClose);
  const tables = entities.filter((entity) => entity.kind === "table").sort((a, b) => a.title.localeCompare(b.title));
  const [lastResults, setLastResults] = useState<Record<string, string>>({});

  function roll(entity: Entity) {
    const table = readTableFields(entity.fields);
    const picked = rollTable(table.entries);
    if (!picked) return;
    setLastResults((current) => ({ ...current, [entity.id]: picked.text }));
    onRecordRoll(entity.id, picked.text);
  }

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Tabelas">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">RANDOM TABLE ENGINE</span><h2>Tabelas</h2></div>
          <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <ul className="entity-list table-quickroll-list">
          {tables.map((entity) => {
            const fields = readTableFields(entity.fields);
            const rollable = fields.entries.some((e) => e.weight > 0);
            return (
              <li key={entity.id} className="table-quickroll-row">
                <button type="button" className="entity-row" onClick={() => onFocusEntity(entity.id)}>
                  <span className="entity-row-icon">🎲</span>
                  <span className="entity-row-body">
                    <span className="entity-row-title">{entity.title || "Sem título"}</span>
                    <span className="entity-row-meta">{fields.entries.length} entrada{fields.entries.length === 1 ? "" : "s"}{lastResults[entity.id] ? ` · último: ${lastResults[entity.id]}` : ""}</span>
                  </span>
                </button>
                <button type="button" className="table-quickroll-button" disabled={!rollable} onClick={() => roll(entity)}><Icons.dice /> Rolar</button>
              </li>
            );
          })}
          {!tables.length && <li className="tool-panel-empty">Nenhuma tabela cadastrada ainda. Crie um elemento do tipo "Tabela" para montar uma lista sorteável.</li>}
        </ul>
      </section>
    </div>
  );
}
