import { useState } from "react";
import { createId } from "../../domain/id";
import { Icons } from "../Icons";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** Shared checklist editor — quest objectives (secondary/hidden) and
 * project stages are the same shape, so this is the one place that knows
 * how to add/check/remove an item. */
export function ObjectiveList({ title, objectives, onChange }: { title: string; objectives: ChecklistItem[]; onChange: (next: ChecklistItem[]) => void }) {
  const [text, setText] = useState("");
  function add() {
    if (!text.trim()) return;
    onChange([...objectives, { id: createId("objective"), text: text.trim(), done: false }]);
    setText("");
  }
  return (
    <div className="objective-block">
      <span className="objective-title">{title}</span>
      <ul className="mini-list">
        {objectives.map((objective) => (
          <li key={objective.id}>
            <input type="checkbox" checked={objective.done} onChange={(e) => onChange(objectives.map((o) => (o.id === objective.id ? { ...o, done: e.target.checked } : o)))} />
            <span className={objective.done ? "mini-list-text is-done" : "mini-list-text"}>{objective.text}</span>
            <button type="button" className="icon-button" aria-label="Remover" onClick={() => onChange(objectives.filter((o) => o.id !== objective.id))}><Icons.close /></button>
          </li>
        ))}
        {!objectives.length && <li className="mini-list-empty">Nenhum ainda.</li>}
      </ul>
      <div className="inline-form">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Novo item…" onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button type="button" disabled={!text.trim()} onClick={add}><Icons.plus /></button>
      </div>
    </div>
  );
}
