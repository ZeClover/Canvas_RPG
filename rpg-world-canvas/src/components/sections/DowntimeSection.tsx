import { useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { downtimeProgress, readDowntimeFields, type DowntimeFields } from "../../domain/downtimeFields";
import { createId } from "../../domain/id";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface DowntimeSectionProps {
  fields: Record<string, unknown>;
  allEntities: Entity[];
  onUpdate: (fields: Record<string, unknown>) => void;
}

const CHARACTER_KINDS = new Set(["player", "npc"]);

export function DowntimeSection({ fields, allEntities, onUpdate }: DowntimeSectionProps) {
  const downtime = readDowntimeFields(fields);
  const progress = downtimeProgress(downtime);
  const [logNote, setLogNote] = useState("");

  function patch(partial: Partial<DowntimeFields>) {
    onUpdate({ ...fields, ...partial });
  }

  const characters = allEntities.filter((e) => CHARACTER_KINDS.has(e.kind)).sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="kind-section">
      <span className="eyebrow">DOWNTIME</span>

      <label className="compact-field" style={{ marginBottom: 10 }}>
        Personagem
        <select value={downtime.characterEntityId ?? ""} onChange={(e) => patch({ characterEntityId: e.target.value || null })}>
          <option value="">Quem está fazendo isso?</option>
          {characters.map((c) => <option value={c.id} key={c.id}>{kindConfig(c.kind).icon} {c.title}</option>)}
        </select>
      </label>

      <label>Atividade<textarea value={downtime.activity} onChange={(e) => patch({ activity: e.target.value })} placeholder="Ex.: forjar uma espada, treinar com o mestre de armas, pesquisar sobre a runa…" /></label>

      <span className="eyebrow">PROGRESSO ({downtime.daysSpent}/{downtime.daysNeeded} dias · {progress.percent}%{progress.complete ? " · concluído" : ""})</span>
      <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} /></div>
      <div className="compact-grid">
        <label className="compact-field">Dias necessários<input type="number" min={0} value={downtime.daysNeeded} onChange={(e) => patch({ daysNeeded: Math.max(0, Number(e.target.value) || 0) })} /></label>
        <label className="compact-field">Dias gastos<input type="number" min={0} value={downtime.daysSpent} onChange={(e) => patch({ daysSpent: Math.max(0, Number(e.target.value) || 0) })} /></label>
      </div>

      <label>Resultado<textarea value={downtime.outcomeNote} onChange={(e) => patch({ outcomeNote: e.target.value })} placeholder="O que saiu disso quando terminou (ou até agora)…" /></label>

      <span className="eyebrow">HISTÓRICO ({downtime.log.length})</span>
      <ul className="mini-list">
        {[...downtime.log].reverse().map((entry) => (
          <li key={entry.id}>
            <span className="mini-list-text">{entry.note}</span>
            <button type="button" className="icon-button" title="Remover" aria-label="Remover" onClick={() => patch({ log: downtime.log.filter((e) => e.id !== entry.id) })}><Icons.close /></button>
          </li>
        ))}
        {!downtime.log.length && <li className="mini-list-empty">Nada registrado ainda.</li>}
      </ul>
      <div className="inline-form">
        <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Ex.: +2 dias investidos na sessão 5…" />
        <button type="button" disabled={!logNote.trim()} onClick={() => {
          patch({ log: [...downtime.log, { id: createId("downtimelog"), at: Date.now(), note: logNote.trim() }] });
          setLogNote("");
        }}><Icons.plus /> Adicionar</button>
      </div>
    </div>
  );
}
