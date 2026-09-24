import { useState } from "react";
import { createId } from "../../domain/id";
import { FORESHADOWING_STATUSES, readForeshadowingFields, type ForeshadowingFields } from "../../domain/foreshadowingFields";
import { Icons } from "../Icons";

interface ForeshadowingSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function ForeshadowingSection({ fields, onUpdate }: ForeshadowingSectionProps) {
  const foreshadowing = readForeshadowingFields(fields);
  const [logNote, setLogNote] = useState("");

  function patch(partial: Partial<ForeshadowingFields>) {
    onUpdate({ ...foreshadowing, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">FORESHADOWING</span>
      <label>
        Status
        <select value={foreshadowing.status} onChange={(e) => patch({ status: e.target.value as ForeshadowingFields["status"] })}>
          {FORESHADOWING_STATUSES.map((status) => <option value={status} key={status}>{status}</option>)}
        </select>
      </label>
      <label>Pista plantada<textarea value={foreshadowing.hint} onChange={(e) => patch({ hint: e.target.value })} placeholder="O que foi dito ou mostrado?" /></label>
      <label>Pagamento pretendido<textarea value={foreshadowing.intendedPayoff} onChange={(e) => patch({ intendedPayoff: e.target.value })} placeholder="O que isso deveria revelar ou causar no fim?" /></label>

      <span className="eyebrow">HISTÓRICO ({foreshadowing.log.length})</span>
      <ul className="mini-list">
        {[...foreshadowing.log].reverse().map((entry) => (
          <li key={entry.id}>
            <span className="mini-list-text">{entry.note}</span>
            <button type="button" className="icon-button" aria-label="Remover" onClick={() => patch({ log: foreshadowing.log.filter((e) => e.id !== entry.id) })}><Icons.close /></button>
          </li>
        ))}
        {!foreshadowing.log.length && <li className="mini-list-empty">Nada registrado ainda.</li>}
      </ul>
      <div className="inline-form">
        <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Ex.: reforçado na sessão 4, quando…" />
        <button type="button" disabled={!logNote.trim()} onClick={() => {
          patch({ log: [...foreshadowing.log, { id: createId("foreshadowinglog"), at: Date.now(), note: logNote.trim() }] });
          setLogNote("");
        }}><Icons.plus /> Adicionar</button>
      </div>
    </div>
  );
}
