import { useMemo } from "react";
import { readRuleFields, RULE_ACTION_LABEL } from "../../domain/ruleFields";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface RulesEnginePanelProps {
  entities: Entity[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
  onToggleEnabled: (ruleId: string, enabled: boolean) => void;
  onCreateRule: () => void;
}

/** Rules Engine: the global list of "quando X vira Y, então Z" automations.
 * Editing a rule's trigger/action happens in its own inspector (RuleSection)
 * like any other card — this panel is the at-a-glance list plus a quick
 * enable/disable toggle and firing history, mirroring the Timeline. */
export function RulesEnginePanel({ entities, onClose, onFocusEntity, onToggleEnabled, onCreateRule }: RulesEnginePanelProps) {
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const rules = useMemo(() => entities.filter((entity) => entity.kind === "rule").sort((a, b) => a.title.localeCompare(b.title)), [entities]);

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Motor de regras">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">AUTOMAÇÃO</span><h2>Motor de regras</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <button type="button" className="ghost-button rule-create-button" onClick={onCreateRule}><Icons.plus /> Nova regra</button>

        <ul className="entity-list rule-list">
          {rules.map((ruleEntity) => {
            const rule = readRuleFields(ruleEntity.fields);
            const watched = rule.trigger.entityId ? entityById.get(rule.trigger.entityId) : null;
            const target = rule.action.targetEntityId ? entityById.get(rule.action.targetEntityId) : null;
            const lastLog = rule.log[rule.log.length - 1];
            return (
              <li key={ruleEntity.id} className="rule-row">
                <label className="rule-toggle" title={rule.enabled ? "Desativar regra" : "Ativar regra"}>
                  <input type="checkbox" checked={rule.enabled} onChange={(event) => onToggleEnabled(ruleEntity.id, event.target.checked)} />
                </label>
                <button type="button" className="rule-summary" onClick={() => { onFocusEntity(ruleEntity.id); onClose(); }}>
                  <strong>{ruleEntity.title || "Sem título"}</strong>
                  <span className="rule-condition">
                    Quando <em>{watched?.title ?? "?"}</em> chega a <em>"{rule.trigger.value || "…"}"</em> → {RULE_ACTION_LABEL[rule.action.kind]} <em>{target?.title ?? "?"}</em>
                  </span>
                  {lastLog && <small className="rule-last-log">{lastLog.note}</small>}
                </button>
              </li>
            );
          })}
          {!rules.length && (
            <li className="tool-panel-empty">
              Nenhuma regra criada ainda. Regras automatizam consequências óbvias — "se a quest falhar, o NPC fica hostil" — sem depender de IA.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
