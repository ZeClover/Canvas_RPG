import { useEffect, useState } from "react";
import { kindConfig } from "../domain/entityKindRegistry";
import { relationConfig } from "../domain/relationTypeRegistry";
import { RELATION_STAT_LABEL, readRelationStats, type RelationStats } from "../domain/relationStats";
import type { Entity, Relation, RelationType } from "../domain/types";
import { RELATION_TYPES } from "../domain/types";
import { Icons } from "./Icons";

interface RelationInspectorProps {
  relation: Relation;
  fromEntity: Entity | null;
  toEntity: Entity | null;
  onUpdate: (updates: Partial<Relation>) => void;
  onReverse: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function RelationInspector({ relation, fromEntity, toEntity, onUpdate, onReverse, onDelete, onClose }: RelationInspectorProps) {
  const [label, setLabel] = useState(relation.label);
  const [description, setDescription] = useState(relation.description);
  useEffect(() => {
    setLabel(relation.label);
    setDescription(relation.description);
  }, [relation.id, relation.label, relation.description]);

  return (
    <aside className="node-inspector connection-inspector" aria-label="Propriedades da relação">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">RELAÇÃO</span>
          <h3>{fromEntity?.title ?? "?"} → {toEntity?.title ?? "?"}</h3>
        </div>
        <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
      </div>
      <label>Tipo<select value={relation.type} onChange={(event) => onUpdate({ type: event.target.value as RelationType })}>
        {RELATION_TYPES.map((type) => <option value={type} key={type}>{relationConfig(type).label}</option>)}
      </select></label>
      <label>Rótulo<input value={label} onChange={(event) => setLabel(event.target.value)} onBlur={() => label !== relation.label && onUpdate({ label })} placeholder="Ex.: desconfia mas finge não saber" /></label>
      <label>Descrição<textarea value={description} onChange={(event) => setDescription(event.target.value)} onBlur={() => description !== relation.description && onUpdate({ description })} /></label>
      <label>Importância
        <select value={relation.importance ?? ""} onChange={(event) => onUpdate({ importance: (event.target.value || null) as Relation["importance"] })}>
          <option value="">—</option>
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
        </select>
      </label>
      {fromEntity?.kind === "npc" && toEntity?.kind === "npc" && (
        <>
          <span className="eyebrow">ATRIBUTOS (OPCIONAIS)</span>
          <RelationStatsEditor stats={readRelationStats(relation.fields)} onChange={(fields) => onUpdate({ fields })} />
        </>
      )}
      {fromEntity && toEntity && (
        <div className="inspector-tip">
          {kindConfig(fromEntity.kind).icon} {fromEntity.title} → {kindConfig(toEntity.kind).icon} {toEntity.title}
        </div>
      )}
      <div className="inspector-actions">
        <button className="ghost-button" onClick={onReverse}>Inverter direção</button>
        <button className="danger-button" onClick={onDelete}><Icons.trash /> Excluir</button>
      </div>
    </aside>
  );
}

function RelationStatsEditor({ stats, onChange }: { stats: RelationStats; onChange: (fields: Record<string, unknown>) => void }) {
  const keys = Object.keys(RELATION_STAT_LABEL) as Array<keyof RelationStats>;
  return (
    <div className="compact-grid">
      {keys.map((key) => (
        <label className="compact-field" key={key}>
          {RELATION_STAT_LABEL[key]}
          <input
            type="number"
            min={-10}
            max={10}
            value={stats[key] ?? ""}
            placeholder="—"
            onChange={(event) => onChange({ ...stats, [key]: event.target.value === "" ? null : Number(event.target.value) })}
          />
        </label>
      ))}
    </div>
  );
}
