import { useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import {
  advanceTurn, currentCombatant, defaultCombatant, readEncounterFields,
  sortByInitiative, type Combatant, type EncounterFields,
} from "../../domain/encounterFields";
import { createId } from "../../domain/id";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";
import { ListEditor } from "./ListEditor";

interface EncounterSectionProps {
  fields: Record<string, unknown>;
  allEntities: Entity[];
  onUpdate: (fields: Record<string, unknown>) => void;
}

const LINKABLE_KINDS = new Set(["npc", "player", "creature"]);

export function EncounterSection({ fields, allEntities, onUpdate }: EncounterSectionProps) {
  const encounter = readEncounterFields(fields);
  const [newName, setNewName] = useState("");
  const [newLinkId, setNewLinkId] = useState("");
  const [logNote, setLogNote] = useState("");

  function patch(partial: Partial<EncounterFields>) {
    onUpdate({ ...encounter, ...partial });
  }

  function patchCombatant(id: string, partial: Partial<Combatant>) {
    patch({ combatants: encounter.combatants.map((c) => (c.id === id ? { ...c, ...partial } : c)) });
  }

  const linkable = allEntities.filter((e) => LINKABLE_KINDS.has(e.kind)).sort((a, b) => a.title.localeCompare(b.title));
  const ordered = sortByInitiative(encounter.combatants);
  const active = currentCombatant(encounter);

  return (
    <div className="kind-section">
      <span className="eyebrow">COMBATE</span>

      <div className="compact-grid">
        <label className="compact-field">Rodada<input type="number" value={encounter.round} onChange={(e) => patch({ round: Math.max(1, Number(e.target.value) || 1) })} /></label>
        <label className="important-toggle">
          <input type="checkbox" checked={encounter.active} onChange={(e) => patch({ active: e.target.checked })} />
          Encontro em andamento
        </label>
      </div>

      {ordered.length > 0 && (
        <div className="encounter-turn-banner">
          <span>Vez de: <strong>{active?.name ?? "—"}</strong></span>
          <button type="button" onClick={() => patch(advanceTurn(encounter))}><Icons.forward /> Próximo turno</button>
        </div>
      )}

      <ul className="encounter-list">
        {ordered.map((combatant) => (
          <li key={combatant.id} className={combatant.id === active?.id ? "encounter-row encounter-row-active" : "encounter-row"}>
            <div className="compact-grid">
              <label className="compact-field">Nome<input value={combatant.name} onChange={(e) => patchCombatant(combatant.id, { name: e.target.value })} /></label>
              <label className="compact-field">Iniciativa<input type="number" value={combatant.initiative} onChange={(e) => patchCombatant(combatant.id, { initiative: Number(e.target.value) || 0 })} /></label>
              <label className="compact-field">PV<input type="number" value={combatant.hp} onChange={(e) => patchCombatant(combatant.id, { hp: Number(e.target.value) || 0 })} /></label>
              <label className="compact-field">PV máx.<input type="number" value={combatant.maxHp} onChange={(e) => patchCombatant(combatant.id, { maxHp: Number(e.target.value) || 0 })} /></label>
            </div>
            <label className="encounter-ally-toggle">
              <input type="checkbox" checked={combatant.isAlly} onChange={(e) => patchCombatant(combatant.id, { isAlly: e.target.checked })} /> Aliado dos jogadores
            </label>
            <ListEditor label="Condições" value={combatant.conditions} placeholder="atordoado, sangrando" onChange={(next) => patchCombatant(combatant.id, { conditions: next })} />
            <div className="encounter-row-footer">
              {combatant.entityId && <span className="encounter-linked">🔗 {allEntities.find((e) => e.id === combatant.entityId)?.title ?? "(removido)"}</span>}
              <button type="button" className="icon-button" title="Remover combatente" aria-label="Remover combatente" onClick={() => patch({ combatants: encounter.combatants.filter((c) => c.id !== combatant.id) })}><Icons.close /></button>
            </div>
          </li>
        ))}
        {!encounter.combatants.length && <li className="mini-list-empty">Nenhum combatente ainda. Adicione abaixo.</li>}
      </ul>

      <div className="inline-form">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do combatente" />
        <select
          value={newLinkId}
          onChange={(e) => {
            setNewLinkId(e.target.value);
            const found = linkable.find((x) => x.id === e.target.value);
            if (found && !newName.trim()) setNewName(found.title);
          }}
        >
          <option value="">Vincular a… (opcional)</option>
          {linkable.map((e) => <option value={e.id} key={e.id}>{kindConfig(e.kind).icon} {e.title}</option>)}
        </select>
        <button
          type="button"
          disabled={!newName.trim() && !newLinkId}
          onClick={() => {
            const linked = linkable.find((x) => x.id === newLinkId);
            const combatant = defaultCombatant(newName.trim() || linked?.title || "Combatente");
            combatant.entityId = newLinkId || null;
            patch({ combatants: [...encounter.combatants, combatant] });
            setNewName("");
            setNewLinkId("");
          }}
        ><Icons.plus /> Adicionar</button>
      </div>

      <span className="eyebrow">HISTÓRICO ({encounter.log.length})</span>
      <ul className="mini-list">
        {[...encounter.log].reverse().map((entry) => (
          <li key={entry.id}>
            <span className="mini-list-text">{entry.note}</span>
            <button type="button" className="icon-button" title="Remover" aria-label="Remover" onClick={() => patch({ log: encounter.log.filter((e) => e.id !== entry.id) })}><Icons.close /></button>
          </li>
        ))}
        {!encounter.log.length && <li className="mini-list-empty">Nada registrado ainda.</li>}
      </ul>
      <div className="inline-form">
        <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Ex.: o goblin foge, a armadilha dispara…" />
        <button type="button" disabled={!logNote.trim()} onClick={() => {
          patch({ log: [...encounter.log, { id: createId("encounterlog"), at: Date.now(), note: logNote.trim() }] });
          setLogNote("");
        }}><Icons.plus /> Adicionar</button>
      </div>
    </div>
  );
}
