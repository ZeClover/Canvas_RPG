import { useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { createId } from "../../domain/id";
import {
  daysRemaining, defaultLeg, legsDone, readJourneyFields, totalDays, type JourneyFields, type JourneyLeg,
} from "../../domain/journeyFields";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface JourneySectionProps {
  fields: Record<string, unknown>;
  allEntities: Entity[];
  onUpdate: (fields: Record<string, unknown>) => void;
}

const WAYPOINT_KINDS = new Set(["location", "city", "region"]);

export function JourneySection({ fields, allEntities, onUpdate }: JourneySectionProps) {
  const journey = readJourneyFields(fields);
  const [logNote, setLogNote] = useState("");

  function patch(partial: Partial<JourneyFields>) {
    onUpdate({ ...journey, ...partial });
  }

  function patchLeg(id: string, partial: Partial<JourneyLeg>) {
    patch({ legs: journey.legs.map((leg) => (leg.id === id ? { ...leg, ...partial } : leg)) });
  }

  const waypoints = allEntities.filter((e) => WAYPOINT_KINDS.has(e.kind)).sort((a, b) => a.title.localeCompare(b.title));
  const total = totalDays(journey.legs);
  const remaining = daysRemaining(journey.legs);
  const done = legsDone(journey.legs);

  return (
    <div className="kind-section">
      <span className="eyebrow">VIAGEM</span>

      {journey.legs.length > 0 && (
        <div className="journey-progress">
          <span>{done}/{journey.legs.length} trechos concluídos</span>
          <span>{total - remaining}/{total} dias percorridos</span>
        </div>
      )}

      <ul className="journey-leg-list">
        {journey.legs.map((leg, index) => (
          <li key={leg.id} className={leg.done ? "journey-leg is-done" : "journey-leg"}>
            <div className="journey-leg-row">
              <span className="journey-leg-index">{index + 1}</span>
              <select value={leg.fromEntityId ?? ""} onChange={(e) => patchLeg(leg.id, { fromEntityId: e.target.value || null })}>
                <option value="">De…</option>
                {waypoints.map((w) => <option value={w.id} key={w.id}>{kindConfig(w.kind).icon} {w.title}</option>)}
              </select>
              <span className="journey-leg-arrow">→</span>
              <select value={leg.toEntityId ?? ""} onChange={(e) => patchLeg(leg.id, { toEntityId: e.target.value || null })}>
                <option value="">Até…</option>
                {waypoints.map((w) => <option value={w.id} key={w.id}>{kindConfig(w.kind).icon} {w.title}</option>)}
              </select>
              <button type="button" className="icon-button" title="Remover trecho" aria-label="Remover trecho" onClick={() => patch({ legs: journey.legs.filter((l) => l.id !== leg.id) })}><Icons.close /></button>
            </div>
            <div className="compact-grid">
              <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Distância<input value={leg.distanceNote} placeholder="Ex.: 3 dias a pé, atalho pela floresta" onChange={(e) => patchLeg(leg.id, { distanceNote: e.target.value })} /></label>
              <label className="compact-field">Dias<input type="number" min={0} value={leg.days} onChange={(e) => patchLeg(leg.id, { days: Math.max(0, Number(e.target.value) || 0) })} /></label>
              <label className="journey-leg-done">
                <input type="checkbox" checked={leg.done} onChange={(e) => patchLeg(leg.id, { done: e.target.checked })} /> Concluído
              </label>
            </div>
          </li>
        ))}
        {!journey.legs.length && <li className="mini-list-empty">Nenhum trecho ainda. Adicione abaixo pra montar a rota.</li>}
      </ul>
      <button type="button" className="journey-add-leg" onClick={() => patch({ legs: [...journey.legs, defaultLeg()] })}><Icons.plus /> Adicionar trecho</button>

      <label>Suprimentos<textarea value={journey.supplyNote} onChange={(e) => patch({ supplyNote: e.target.value })} placeholder="Ex.: 1 ração/dia por pessoa, checar estoque em Rações da Academia" /></label>
      <label>Encontros<textarea value={journey.encounterNote} onChange={(e) => patch({ encounterNote: e.target.value })} placeholder="Ex.: rolar em 'Encontros da Estrada' 1x por dia de viagem" /></label>

      <span className="eyebrow">HISTÓRICO ({journey.log.length})</span>
      <ul className="mini-list">
        {[...journey.log].reverse().map((entry) => (
          <li key={entry.id}>
            <span className="mini-list-text">{entry.note}</span>
            <button type="button" className="icon-button" title="Remover" aria-label="Remover" onClick={() => patch({ log: journey.log.filter((e) => e.id !== entry.id) })}><Icons.close /></button>
          </li>
        ))}
        {!journey.log.length && <li className="mini-list-empty">Nada registrado ainda.</li>}
      </ul>
      <div className="inline-form">
        <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Ex.: tempestade atrasou um dia, encontraram um posto avançado…" />
        <button type="button" disabled={!logNote.trim()} onClick={() => {
          patch({ log: [...journey.log, { id: createId("journeylog"), at: Date.now(), note: logNote.trim() }] });
          setLogNote("");
        }}><Icons.plus /> Adicionar</button>
      </div>
    </div>
  );
}
