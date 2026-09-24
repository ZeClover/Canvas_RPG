import { readEcologyFields, THREAT_LEVELS, type EcologyFields } from "../../domain/ecologyFields";

interface EcologySectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function EcologySection({ fields, onUpdate }: EcologySectionProps) {
  const ecology = readEcologyFields(fields);

  function patch(partial: Partial<EcologyFields>) {
    onUpdate({ ...ecology, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">ECOLOGIA DO ENCONTRO</span>
      <div className="compact-grid">
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Habitat<input value={ecology.habitat} placeholder="Ex.: cavernas úmidas, floresta densa" onChange={(e) => patch({ habitat: e.target.value })} /></label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Dieta<input value={ecology.diet} placeholder="Ex.: carnívoro, se alimenta de mana" onChange={(e) => patch({ diet: e.target.value })} /></label>
        <label className="compact-field">Grupo<input value={ecology.groupSize} placeholder="Ex.: solitário, 2-4, bando" onChange={(e) => patch({ groupSize: e.target.value })} /></label>
        <label className="compact-field">
          Ameaça
          <select value={ecology.threatLevel} onChange={(e) => patch({ threatLevel: e.target.value as EcologyFields["threatLevel"] })}>
            {THREAT_LEVELS.map((level) => <option value={level} key={level}>{level}</option>)}
          </select>
        </label>
      </div>
      <label>Comportamento<textarea value={ecology.behavior} onChange={(e) => patch({ behavior: e.target.value })} placeholder="Como reage a intrusos, padrões de ataque, hábitos…" /></label>
      <div className="inspector-tip">Use a relação "caça" abaixo para montar cadeias de predador/presa entre criaturas.</div>
    </div>
  );
}
