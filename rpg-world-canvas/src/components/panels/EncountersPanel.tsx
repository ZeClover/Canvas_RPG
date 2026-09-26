import { useMemo } from "react";
import { currentCombatant, readEncounterFields } from "../../domain/encounterFields";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface EncountersPanelProps {
  entities: Entity[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

/** Combat Tracker: quick jump to any encounter without hunting for its card
 * on the canvas — active fights float to the top. */
export function EncountersPanel({ entities, onClose, onFocusEntity }: EncountersPanelProps) {
  const rows = useMemo(() => {
    return entities
      .filter((entity) => entity.kind === "encounter")
      .map((entity) => ({ entity, encounter: readEncounterFields(entity.fields) }))
      .sort((a, b) => Number(b.encounter.active) - Number(a.encounter.active));
  }, [entities]);

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Encontros">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">COMBAT TRACKER</span><h2>Encontros</h2></div>
          <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <ul className="entity-list settlement-list">
          {rows.map(({ entity, encounter }) => {
            const active = currentCombatant(encounter);
            return (
              <li key={entity.id}>
                <button type="button" className={`entity-row settlement-row${encounter.active ? " is-active" : ""}`} onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                  <span className="entity-row-icon">⚔️</span>
                  <span className="entity-row-body">
                    <span className="entity-row-title">{entity.title || "Sem título"}</span>
                    <span className="entity-row-meta">{encounter.active ? `Rodada ${encounter.round} · vez de ${active?.name ?? "—"}` : "Encerrado"}</span>
                  </span>
                  <span className="settlement-stats">{encounter.combatants.length} combatente{encounter.combatants.length === 1 ? "" : "s"}</span>
                </button>
              </li>
            );
          })}
          {!rows.length && <li className="tool-panel-empty">Nenhum encontro cadastrado ainda. Crie um elemento do tipo "Encontro" para rodar um combate aqui.</li>}
        </ul>
      </section>
    </div>
  );
}
