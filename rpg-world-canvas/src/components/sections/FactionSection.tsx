import { useState } from "react";
import { createId } from "../../domain/id";
import {
  CLOCK_SEGMENT_OPTIONS, defaultClock, readFactionFields, setClockFilled,
  type FactionClock, type FactionFields,
} from "../../domain/factionFields";
import { Icons } from "../Icons";

interface FactionSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function FactionSection({ fields, onUpdate }: FactionSectionProps) {
  const faction = readFactionFields(fields);
  const [clockLabel, setClockLabel] = useState("");
  const [clockSegments, setClockSegments] = useState<number>(6);
  const [logNote, setLogNote] = useState("");

  function patch(partial: Partial<FactionFields>) {
    onUpdate({ ...fields, ...partial });
  }

  function patchClock(id: string, next: FactionClock) {
    patch({ clocks: faction.clocks.map((c) => (c.id === id ? next : c)) });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">FACÇÃO</span>

      <label>Objetivo<textarea value={faction.goal} onChange={(e) => patch({ goal: e.target.value })} placeholder="O que essa facção está tentando conseguir agora?" /></label>
      <label>Recursos<textarea value={faction.resources} onChange={(e) => patch({ resources: e.target.value })} placeholder="Ex.: ouro alto, 200 tropas, poucos aliados políticos…" /></label>

      <label className="compact-field" style={{ marginBottom: 12 }}>
        Standing com o grupo ({faction.standing > 0 ? `+${faction.standing}` : faction.standing})
        <input type="range" min={-100} max={100} value={faction.standing} onChange={(e) => patch({ standing: Number(e.target.value) })} />
      </label>

      <span className="eyebrow">RELÓGIOS DE PROGRESSO ({faction.clocks.length})</span>
      <ul className="faction-clock-list">
        {faction.clocks.map((clock) => (
          <li key={clock.id} className="faction-clock">
            <div className="faction-clock-header">
              <input value={clock.label} onChange={(e) => patchClock(clock.id, { ...clock, label: e.target.value })} />
              <span className="faction-clock-count">{clock.filled}/{clock.segments}</span>
              <button type="button" className="icon-button" title="Remover relógio" aria-label="Remover relógio" onClick={() => patch({ clocks: faction.clocks.filter((c) => c.id !== clock.id) })}><Icons.close /></button>
            </div>
            <div className="faction-clock-dots">
              {Array.from({ length: clock.segments }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={i < clock.filled ? "faction-clock-dot is-filled" : "faction-clock-dot"}
                  aria-label={`Preencher até o segmento ${i + 1} de ${clock.segments}`}
                  onClick={() => patchClock(clock.id, setClockFilled(clock, i + 1 === clock.filled ? i : i + 1))}
                />
              ))}
            </div>
          </li>
        ))}
        {!faction.clocks.length && <li className="mini-list-empty">Nenhum relógio ainda. Crie um para acompanhar um plano, ameaça ou progresso da facção.</li>}
      </ul>
      <div className="inline-form">
        <input value={clockLabel} onChange={(e) => setClockLabel(e.target.value)} placeholder="Ex.: Cerco à capital" />
        <select value={clockSegments} onChange={(e) => setClockSegments(Number(e.target.value))}>
          {CLOCK_SEGMENT_OPTIONS.map((n) => <option value={n} key={n}>{n} segmentos</option>)}
        </select>
        <button type="button" disabled={!clockLabel.trim()} onClick={() => {
          patch({ clocks: [...faction.clocks, defaultClock(clockLabel.trim(), clockSegments)] });
          setClockLabel("");
        }}><Icons.plus /> Adicionar</button>
      </div>

      <span className="eyebrow">HISTÓRICO ({faction.log.length})</span>
      <ul className="mini-list">
        {[...faction.log].reverse().map((entry) => (
          <li key={entry.id}>
            <span className="mini-list-text">{entry.note}</span>
            <button type="button" className="icon-button" title="Remover" aria-label="Remover" onClick={() => patch({ log: faction.log.filter((e) => e.id !== entry.id) })}><Icons.close /></button>
          </li>
        ))}
        {!faction.log.length && <li className="mini-list-empty">Nada registrado ainda.</li>}
      </ul>
      <div className="inline-form">
        <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Ex.: fechou uma aliança secreta, perdeu um posto avançado…" />
        <button type="button" disabled={!logNote.trim()} onClick={() => {
          patch({ log: [...faction.log, { id: createId("factionlog"), at: Date.now(), note: logNote.trim() }] });
          setLogNote("");
        }}><Icons.plus /> Adicionar</button>
      </div>
    </div>
  );
}
