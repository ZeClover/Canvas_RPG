// Rules Engine data. A rule is deterministic and local: "quando <entidade
// observada> chega ao status <valor>, então <ação> em <entidade alvo>". No
// AI ever decides an action — CampaignStore evaluates this same structure
// on every commit (see rulesEngine.ts), so the GM sees and controls every
// automatic change.

import { RELATION_TYPES, type RelationType } from "./types";

const RELATION_TYPE_SET = new Set<string>(RELATION_TYPES);

export type RuleActionKind = "set_status" | "mark_important" | "create_relation";

export const RULE_ACTION_LABEL: Record<RuleActionKind, string> = {
  set_status: "mudar o status de",
  mark_important: "marcar como importante",
  create_relation: "criar uma relação até",
};

export interface RuleTrigger {
  /** Only trigger kind for now: a watched entity's status becoming a
   * specific value. Room to grow (relation created, date reached...)
   * without migrating existing rules — readRuleFields defaults anything
   * it doesn't recognize away safely. */
  kind: "status_equals";
  entityId: string | null;
  value: string;
}

export interface RuleAction {
  kind: RuleActionKind;
  targetEntityId: string | null;
  /** Used by set_status. */
  value: string;
  /** Used by create_relation. */
  relationType: RelationType;
}

export interface RuleLogEntry {
  id: string;
  at: number;
  note: string;
}

export interface RuleFields {
  enabled: boolean;
  trigger: RuleTrigger;
  action: RuleAction;
  log: RuleLogEntry[];
}

export function defaultRuleFields(): RuleFields {
  return {
    enabled: true,
    trigger: { kind: "status_equals", entityId: null, value: "" },
    action: { kind: "set_status", targetEntityId: null, value: "", relationType: "leads_to" },
    log: [],
  };
}

function readTrigger(value: unknown): RuleTrigger {
  const defaults = defaultRuleFields().trigger;
  if (!value || typeof value !== "object") return defaults;
  const source = value as Partial<RuleTrigger>;
  return {
    kind: "status_equals",
    entityId: typeof source.entityId === "string" ? source.entityId : defaults.entityId,
    value: typeof source.value === "string" ? source.value : defaults.value,
  };
}

function readAction(value: unknown): RuleAction {
  const defaults = defaultRuleFields().action;
  if (!value || typeof value !== "object") return defaults;
  const source = value as Partial<RuleAction>;
  const kind: RuleActionKind = source.kind === "mark_important" || source.kind === "create_relation" ? source.kind : "set_status";
  return {
    kind,
    targetEntityId: typeof source.targetEntityId === "string" ? source.targetEntityId : defaults.targetEntityId,
    value: typeof source.value === "string" ? source.value : defaults.value,
    relationType: typeof source.relationType === "string" && RELATION_TYPE_SET.has(source.relationType)
      ? (source.relationType as RelationType)
      : defaults.relationType,
  };
}

export function readRuleFields(fields: Record<string, unknown>): RuleFields {
  const defaults = defaultRuleFields();
  const source = fields as Partial<RuleFields>;
  return {
    enabled: typeof source.enabled === "boolean" ? source.enabled : defaults.enabled,
    trigger: readTrigger(source.trigger),
    action: readAction(source.action),
    log: Array.isArray(source.log) ? (source.log as RuleLogEntry[]) : defaults.log,
  };
}
