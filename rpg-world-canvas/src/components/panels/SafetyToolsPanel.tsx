import { useState } from "react";
import { createId } from "../../domain/id";
import type { SafetyToolsConfig } from "../../domain/safetyToolsFields";
import { Icons } from "../Icons";

interface SafetyToolsPanelProps {
  safetyTools: SafetyToolsConfig;
  onClose: () => void;
  onUpdate: (partial: Partial<SafetyToolsConfig>) => void;
}

function ListField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string[]; onChange: (next: string[]) => void }) {
  const [text, setText] = useState("");
  return (
    <div>
      <span className="eyebrow">{label} ({value.length})</span>
      <ul className="mini-list">
        {value.map((item, i) => (
          <li key={i}>
            <span className="mini-list-text">{item}</span>
            <button type="button" className="icon-button" title="Remover" aria-label="Remover" onClick={() => onChange(value.filter((_, idx) => idx !== i))}><Icons.close /></button>
          </li>
        ))}
        {!value.length && <li className="mini-list-empty">Nada combinado ainda.</li>}
      </ul>
      <div className="inline-form">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} onKeyDown={(e) => {
          if (e.key !== "Enter" || !text.trim()) return;
          onChange([...value, text.trim()]);
          setText("");
        }} />
        <button type="button" disabled={!text.trim()} onClick={() => { onChange([...value, text.trim()]); setText(""); }}><Icons.plus /> Adicionar</button>
      </div>
    </div>
  );
}

/** Safety Tools: lines & veils are agreed at the table, never enforced by
 * the app — this is just a place to write them down and log how something
 * got handled. Campaign-level, same shape as the Calendar. */
export function SafetyToolsPanel({ safetyTools, onClose, onUpdate }: SafetyToolsPanelProps) {
  const [logNote, setLogNote] = useState("");

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Safety Tools">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">SAFETY TOOLS</span><h2>Limites da mesa</h2></div>
          <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="tool-panel-section">
          <ListField label="LIMITES (NUNCA INCLUIR)" placeholder="Ex.: violência contra crianças" value={safetyTools.linesAlways} onChange={(next) => onUpdate({ linesAlways: next })} />
        </div>
        <div className="tool-panel-section">
          <ListField label="CUIDADO (FADE TO BLACK)" placeholder="Ex.: espaços apertados" value={safetyTools.veilsCareful} onChange={(next) => onUpdate({ veilsCareful: next })} />
        </div>

        <span className="eyebrow">HISTÓRICO ({safetyTools.log.length})</span>
        <ul className="mini-list">
          {[...safetyTools.log].reverse().map((entry) => (
            <li key={entry.id}>
              <span className="mini-list-text">{entry.note}</span>
              <button type="button" className="icon-button" title="Remover" aria-label="Remover" onClick={() => onUpdate({ log: safetyTools.log.filter((e) => e.id !== entry.id) })}><Icons.close /></button>
            </li>
          ))}
          {!safetyTools.log.length && <li className="mini-list-empty">Nada registrado ainda.</li>}
        </ul>
        <div className="inline-form">
          <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="Ex.: cena da sessão 4 mudou pra fade to black a pedido de alguém" />
          <button type="button" disabled={!logNote.trim()} onClick={() => {
            onUpdate({ log: [...safetyTools.log, { id: createId("safetylog"), at: Date.now(), note: logNote.trim() }] });
            setLogNote("");
          }}><Icons.plus /> Adicionar</button>
        </div>
      </section>
    </div>
  );
}
