import { useState } from "react";
import { createId } from "../../domain/id";
import { defaultEntry, readTableFields, rollTable, type TableFields } from "../../domain/tableFields";
import { Icons } from "../Icons";

interface TableSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function TableSection({ fields, onUpdate }: TableSectionProps) {
  const table = readTableFields(fields);
  const [entryText, setEntryText] = useState("");
  const [entryWeight, setEntryWeight] = useState(1);

  function patch(partial: Partial<TableFields>) {
    onUpdate({ ...fields, ...partial });
  }

  function roll() {
    const picked = rollTable(table.entries);
    if (!picked) return;
    patch({ history: [...table.history, { id: createId("tableroll"), at: Date.now(), result: picked.text }] });
  }

  const lastRoll = table.history[table.history.length - 1] ?? null;

  return (
    <div className="kind-section">
      <span className="eyebrow">TABELA</span>

      <button type="button" className="table-roll-button" disabled={!table.entries.some((e) => e.weight > 0)} onClick={roll}>
        <Icons.dice /> Rolar
      </button>
      {lastRoll && <div className="table-last-roll"><span className="eyebrow">RESULTADO</span>{lastRoll.result}</div>}

      <span className="eyebrow">ENTRADAS ({table.entries.length})</span>
      <ul className="mini-list table-entry-list">
        {table.entries.map((entry) => (
          <li key={entry.id}>
            <input
              className="table-entry-text"
              value={entry.text}
              onChange={(e) => patch({ entries: table.entries.map((x) => (x.id === entry.id ? { ...x, text: e.target.value } : x)) })}
            />
            <input
              className="table-entry-weight"
              type="number"
              min={0}
              value={entry.weight}
              title="Peso — chances relativas de sair essa entrada"
              onChange={(e) => patch({ entries: table.entries.map((x) => (x.id === entry.id ? { ...x, weight: Math.max(0, Number(e.target.value) || 0) } : x)) })}
            />
            <button type="button" className="icon-button" title="Remover entrada" aria-label="Remover entrada" onClick={() => patch({ entries: table.entries.filter((x) => x.id !== entry.id) })}><Icons.close /></button>
          </li>
        ))}
        {!table.entries.length && <li className="mini-list-empty">Nenhuma entrada ainda. Adicione abaixo — peso maior sai mais.</li>}
      </ul>
      <div className="inline-form">
        <input value={entryText} onChange={(e) => setEntryText(e.target.value)} placeholder="Ex.: Uma espada enferrujada mas afiada" />
        <input type="number" min={0} value={entryWeight} onChange={(e) => setEntryWeight(Math.max(0, Number(e.target.value) || 0))} style={{ maxWidth: 70 }} />
        <button type="button" disabled={!entryText.trim()} onClick={() => {
          patch({ entries: [...table.entries, defaultEntry(entryText.trim(), entryWeight)] });
          setEntryText("");
        }}><Icons.plus /> Adicionar</button>
      </div>

      <span className="eyebrow">HISTÓRICO DE ROLAGENS ({table.history.length})</span>
      <ul className="mini-list">
        {[...table.history].reverse().slice(0, 30).map((entry) => (
          <li key={entry.id}>
            <span className="mini-list-text">{entry.result}</span>
            <button type="button" className="icon-button" title="Remover" aria-label="Remover" onClick={() => patch({ history: table.history.filter((h) => h.id !== entry.id) })}><Icons.close /></button>
          </li>
        ))}
        {!table.history.length && <li className="mini-list-empty">Nenhuma rolagem ainda.</li>}
      </ul>
    </div>
  );
}
