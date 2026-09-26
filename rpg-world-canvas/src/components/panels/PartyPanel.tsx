import { useMemo } from "react";
import { readCharacterFields } from "../../domain/characterFields";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface PartyPanelProps {
  entities: Entity[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

/** Party Overview: a Character Sheet quick-glance, one screen for every PC
 * instead of opening each card — built for the moment mid-combat where the
 * GM needs to see who's hurt. Most-wounded (lowest hp%) floats to the top. */
export function PartyPanel({ entities, onClose, onFocusEntity }: PartyPanelProps) {
  const rows = useMemo(() => {
    return entities
      .filter((entity) => entity.kind === "player")
      .map((entity) => ({ entity, character: readCharacterFields(entity.fields) }))
      .sort((a, b) => {
        const pctA = a.character.maxHp > 0 ? a.character.hp / a.character.maxHp : 1;
        const pctB = b.character.maxHp > 0 ? b.character.hp / b.character.maxHp : 1;
        return pctA - pctB;
      });
  }, [entities]);

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Visão do grupo">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">CHARACTER SHEET</span><h2>Visão do grupo</h2></div>
          <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <ul className="party-list">
          {rows.map(({ entity, character }) => {
            const percent = character.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((character.hp / character.maxHp) * 100))) : 0;
            const low = character.maxHp > 0 && character.hp / character.maxHp <= 0.34;
            return (
              <li key={entity.id} className={low ? "party-row is-low" : "party-row"}>
                <button type="button" className="party-row-main" onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                  <span className="entity-row-icon">{entity.icon ?? "🎮"}</span>
                  <span className="party-row-body">
                    <span className="party-row-title">{entity.title || "Sem título"}{character.level ? ` · ${character.level}` : ""}</span>
                    <div className="progress-bar party-hp-bar"><div className="progress-bar-fill" style={{ width: `${percent}%` }} /></div>
                    <span className="party-row-hp">{character.hp}/{character.maxHp} PV</span>
                  </span>
                </button>
                {character.conditions.length > 0 && (
                  <span className="party-row-conditions">{character.conditions.join(", ")}</span>
                )}
              </li>
            );
          })}
          {!rows.length && <li className="tool-panel-empty">Nenhum personagem cadastrado ainda. Crie um elemento do tipo "Personagem" para acompanhar aqui.</li>}
        </ul>
      </section>
    </div>
  );
}
