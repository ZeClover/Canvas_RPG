import { useState } from "react";
import { createId } from "../../domain/id";
import { readSettlementFields, SETTLEMENT_STAGES, type SettlementFields } from "../../domain/settlementFields";
import { Icons } from "../Icons";
import { ListEditor } from "./ListEditor";

interface SettlementSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function SettlementSection({ fields, onUpdate }: SettlementSectionProps) {
  const settlement = readSettlementFields(fields);
  const [logNote, setLogNote] = useState("");

  function patch(partial: Partial<SettlementFields>) {
    onUpdate({ ...fields, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">PROGRESSO DO ASSENTAMENTO</span>
      <div className="compact-grid">
        <label className="compact-field">
          Estágio
          <select value={settlement.stage} onChange={(e) => patch({ stage: e.target.value as SettlementFields["stage"] })}>
            {SETTLEMENT_STAGES.map((stage) => <option value={stage} key={stage}>{stage}</option>)}
          </select>
        </label>
        <label className="compact-field">População<input value={settlement.population} placeholder="Ex.: ~600" onChange={(e) => patch({ population: e.target.value })} /></label>
      </div>

      <div className="compact-grid">
        <label className="compact-field">
          Prosperidade ({settlement.prosperity})
          <input type="range" min={0} max={100} value={settlement.prosperity} onChange={(e) => patch({ prosperity: Number(e.target.value) })} />
        </label>
        <label className="compact-field">
          Estabilidade ({settlement.stability})
          <input type="range" min={0} max={100} value={settlement.stability} onChange={(e) => patch({ stability: Number(e.target.value) })} />
        </label>
      </div>

      <div className="compact-grid">
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Governança<input value={settlement.governance} placeholder="Ex.: conselho de anciãos" onChange={(e) => patch({ governance: e.target.value })} /></label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Defesas<input value={settlement.defenses} placeholder="Ex.: milícia local, muralha baixa" onChange={(e) => patch({ defenses: e.target.value })} /></label>
      </div>

      <ListEditor label="Necessidades" value={settlement.needs} placeholder="mais grãos, proteção" onChange={(next) => patch({ needs: next })} />

      <span className="eyebrow">HISTÓRICO DE EVENTOS ({settlement.log.length})</span>
      <ul className="mini-list">
        {[...settlement.log].reverse().map((entry) => (
          <li key={entry.id}>
            <span className="mini-list-text">{entry.note}</span>
            <button type="button" className="icon-button" title="Remover" aria-label="Remover" onClick={() => patch({ log: settlement.log.filter((e) => e.id !== entry.id) })}><Icons.close /></button>
          </li>
        ))}
        {!settlement.log.length && <li className="mini-list-empty">Nada registrado ainda — anote o que muda o assentamento após cada sessão.</li>}
      </ul>
      <div className="inline-form">
        <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Ex.: a colheita falhou, a milícia se fortaleceu…" />
        <button type="button" disabled={!logNote.trim()} onClick={() => {
          patch({ log: [...settlement.log, { id: createId("settlementlog"), at: Date.now(), note: logNote.trim() }] });
          setLogNote("");
        }}><Icons.plus /> Adicionar</button>
      </div>
    </div>
  );
}
