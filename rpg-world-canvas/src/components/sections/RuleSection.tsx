import { kindConfig } from "../../domain/entityKindRegistry";
import { relationConfig } from "../../domain/relationTypeRegistry";
import { readRuleFields, RULE_ACTION_LABEL, type RuleActionKind, type RuleFields } from "../../domain/ruleFields";
import type { Entity } from "../../domain/types";
import { RELATION_TYPES } from "../../domain/types";
import { Icons } from "../Icons";

interface RuleSectionProps {
  fields: Record<string, unknown>;
  allEntities: Entity[];
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function RuleSection({ fields, allEntities, onUpdate }: RuleSectionProps) {
  const rule = readRuleFields(fields);
  const candidates = [...allEntities].filter((entity) => entity.kind !== "rule" && entity.kind !== "group").sort((a, b) => a.title.localeCompare(b.title));

  function patch(partial: Partial<RuleFields>) {
    onUpdate({ ...rule, ...partial });
  }

  return (
    <div className="kind-section rule-section">
      <label className="important-toggle">
        <input type="checkbox" checked={rule.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
        Regra ativa
      </label>

      <span className="eyebrow">QUANDO</span>
      <div className="compact-grid">
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>
          Entidade observada
          <select value={rule.trigger.entityId ?? ""} onChange={(event) => patch({ trigger: { ...rule.trigger, entityId: event.target.value || null } })}>
            <option value="">Escolha um elemento…</option>
            {candidates.map((entity) => <option value={entity.id} key={entity.id}>{kindConfig(entity.kind).icon} {entity.title}</option>)}
          </select>
        </label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>
          Chegar ao status
          <input value={rule.trigger.value} placeholder="Ex.: Concluída, Instável, Morto…" onChange={(event) => patch({ trigger: { ...rule.trigger, value: event.target.value } })} />
        </label>
      </div>

      <span className="eyebrow">ENTÃO</span>
      <div className="compact-grid">
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>
          Ação
          <select value={rule.action.kind} onChange={(event) => patch({ action: { ...rule.action, kind: event.target.value as RuleActionKind } })}>
            {(Object.keys(RULE_ACTION_LABEL) as RuleActionKind[]).map((kind) => <option value={kind} key={kind}>{RULE_ACTION_LABEL[kind]}</option>)}
          </select>
        </label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>
          Entidade alvo
          <select value={rule.action.targetEntityId ?? ""} onChange={(event) => patch({ action: { ...rule.action, targetEntityId: event.target.value || null } })}>
            <option value="">Escolha um elemento…</option>
            {candidates.map((entity) => <option value={entity.id} key={entity.id}>{kindConfig(entity.kind).icon} {entity.title}</option>)}
          </select>
        </label>
        {rule.action.kind === "set_status" && (
          <label className="compact-field" style={{ gridColumn: "1 / -1" }}>
            Novo status
            <input value={rule.action.value} placeholder="Ex.: Suspensa, Disponível…" onChange={(event) => patch({ action: { ...rule.action, value: event.target.value } })} />
          </label>
        )}
        {rule.action.kind === "create_relation" && (
          <label className="compact-field" style={{ gridColumn: "1 / -1" }}>
            Tipo da relação criada
            <select value={rule.action.relationType} onChange={(event) => patch({ action: { ...rule.action, relationType: event.target.value as RuleFields["action"]["relationType"] } })}>
              {RELATION_TYPES.map((type) => <option value={type} key={type}>{relationConfig(type).label}</option>)}
            </select>
          </label>
        )}
      </div>

      <span className="eyebrow">HISTÓRICO ({rule.log.length})</span>
      <ul className="mini-list rule-log">
        {[...rule.log].reverse().map((entry) => (
          <li key={entry.id}>
            <Icons.spark />
            <span className="mini-list-text">{entry.note}</span>
          </li>
        ))}
        {!rule.log.length && <li className="mini-list-empty">Ainda não disparou.</li>}
      </ul>
    </div>
  );
}
