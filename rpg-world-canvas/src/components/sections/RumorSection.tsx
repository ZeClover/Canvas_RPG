import { readRumorFields, RUMOR_TRUTH_STATES, type RumorFields } from "../../domain/rumorFields";

interface RumorSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function RumorSection({ fields, onUpdate }: RumorSectionProps) {
  const rumor = readRumorFields(fields);

  function patch(partial: Partial<RumorFields>) {
    onUpdate({ ...fields, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">RUMOR (SÓ O MESTRE VÊ ISTO)</span>
      <div className="compact-grid">
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>
          É verdade?
          <select value={rumor.truth} onChange={(e) => patch({ truth: e.target.value as RumorFields["truth"] })}>
            {RUMOR_TRUTH_STATES.map((state) => <option value={state} key={state}>{state}</option>)}
          </select>
        </label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Fonte<input value={rumor.source} placeholder="Quem começou a espalhar isso?" onChange={(e) => patch({ source: e.target.value })} /></label>
      </div>
      <label>Como se espalha<textarea value={rumor.spreadNotes} onChange={(e) => patch({ spreadNotes: e.target.value })} placeholder="Tavernas, mercado, boatos entre alunos…" /></label>
    </div>
  );
}
