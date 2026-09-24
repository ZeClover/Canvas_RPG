import { useState } from "react";
import { createId } from "../../domain/id";
import { KNOWLEDGE_STATE_LABEL, readNpcFields, type KnowledgeState, type NpcFields } from "../../domain/npcFields";
import { Icons } from "../Icons";

interface NpcSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

const PERSONALITY_KEYS: Array<{ key: keyof NpcFields; label: string; placeholder: string }> = [
  { key: "traits", label: "Características", placeholder: "impulsivo, leal, curioso" },
  { key: "behaviors", label: "Comportamentos", placeholder: "evita contato visual, fala rápido" },
  { key: "values", label: "Valores", placeholder: "honra, família" },
  { key: "fears", label: "Medos", placeholder: "escuridão, traição" },
  { key: "desires", label: "Desejos", placeholder: "reconhecimento, riqueza" },
  { key: "goals", label: "Objetivos", placeholder: "reconstruir a guilda" },
  { key: "limits", label: "Limites", placeholder: "nunca mente para crianças" },
  { key: "habits", label: "Hábitos", placeholder: "gira um anel quando nervoso" },
];

function ListEditor({ label, value, placeholder, onChange }: { label: string; value: string[]; placeholder: string; onChange: (next: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <label className="compact-field">
      {label}
      <input
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => onChange(text.split(",").map((item) => item.trim()).filter(Boolean))}
      />
    </label>
  );
}

export function NpcSection({ fields, onUpdate }: NpcSectionProps) {
  const npc = readNpcFields(fields);
  const [knowledgeStatement, setKnowledgeStatement] = useState("");
  const [knowledgeState, setKnowledgeState] = useState<KnowledgeState>("sabe");
  const [possibilityText, setPossibilityText] = useState("");

  function patch(partial: Partial<NpcFields>) {
    onUpdate({ ...fields, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">IDENTIDADE</span>
      <div className="compact-grid">
        <label className="compact-field">Idade<input value={npc.age} onChange={(e) => patch({ age: e.target.value })} /></label>
        <label className="compact-field">Raça<input value={npc.race} onChange={(e) => patch({ race: e.target.value })} /></label>
        <label className="compact-field">Profissão<input value={npc.profession} onChange={(e) => patch({ profession: e.target.value })} /></label>
        <label className="compact-field">Organização<input value={npc.organization} onChange={(e) => patch({ organization: e.target.value })} /></label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Localização atual<input value={npc.currentLocation} onChange={(e) => patch({ currentLocation: e.target.value })} /></label>
      </div>

      <span className="eyebrow">PERSONALIDADE</span>
      <div className="compact-grid">
        {PERSONALITY_KEYS.map(({ key, label, placeholder }) => (
          <ListEditor
            key={key}
            label={label}
            placeholder={placeholder}
            value={npc[key] as string[]}
            onChange={(next) => patch({ [key]: next } as Partial<NpcFields>)}
          />
        ))}
      </div>

      <span className="eyebrow">CONHECIMENTO ({npc.knowledge.length})</span>
      <ul className="mini-list">
        {npc.knowledge.map((entry) => (
          <li key={entry.id}>
            <span className={`knowledge-badge state-${entry.state}`}>{KNOWLEDGE_STATE_LABEL[entry.state]}</span>
            <span className="mini-list-text">{entry.statement}</span>
            <button type="button" className="icon-button" aria-label="Remover" onClick={() => patch({ knowledge: npc.knowledge.filter((k) => k.id !== entry.id) })}><Icons.close /></button>
          </li>
        ))}
        {!npc.knowledge.length && <li className="mini-list-empty">Nada registrado ainda.</li>}
      </ul>
      <div className="inline-form">
        <input value={knowledgeStatement} onChange={(e) => setKnowledgeStatement(e.target.value)} placeholder="Ex.: A porta secreta fica sob a biblioteca" />
        <select value={knowledgeState} onChange={(e) => setKnowledgeState(e.target.value as KnowledgeState)}>
          {Object.entries(KNOWLEDGE_STATE_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <button type="button" disabled={!knowledgeStatement.trim()} onClick={() => {
          patch({ knowledge: [...npc.knowledge, { id: createId("knowledge"), statement: knowledgeStatement.trim(), state: knowledgeState, discoveredAtSession: null, source: "" }] });
          setKnowledgeStatement("");
        }}><Icons.plus /> Adicionar</button>
      </div>

      <span className="eyebrow">POSSIBILIDADES FUTURAS ({npc.possibilities.length})</span>
      <ul className="mini-list">
        {npc.possibilities.map((item) => (
          <li key={item.id}>
            <input type="checkbox" checked={item.done} onChange={(e) => patch({ possibilities: npc.possibilities.map((p) => (p.id === item.id ? { ...p, done: e.target.checked } : p)) })} />
            <span className={item.done ? "mini-list-text is-done" : "mini-list-text"}>{item.text}</span>
            <button type="button" className="icon-button" aria-label="Remover" onClick={() => patch({ possibilities: npc.possibilities.filter((p) => p.id !== item.id) })}><Icons.close /></button>
          </li>
        ))}
        {!npc.possibilities.length && <li className="mini-list-empty">Nenhuma cadastrada. Ex.: confrontar Kaleb, abandonar a academia…</li>}
      </ul>
      <div className="inline-form">
        <input value={possibilityText} onChange={(e) => setPossibilityText(e.target.value)} placeholder="Ex.: revelar o segredo aos jogadores" />
        <button type="button" disabled={!possibilityText.trim()} onClick={() => {
          patch({ possibilities: [...npc.possibilities, { id: createId("possibility"), text: possibilityText.trim(), done: false }] });
          setPossibilityText("");
        }}><Icons.plus /> Adicionar</button>
      </div>
    </div>
  );
}
