// Pure evaluation of the Rules Engine: given the campaign's "rule"
// entities, what changed on this commit, and the live entities/relations,
// compute what should happen next. No side effects here — CampaignStore
// applies the result. Deterministic by construction: same input, same
// output, never a guess.

import { relationConfig } from "./relationTypeRegistry";
import { readRuleFields } from "./ruleFields";
import { createId } from "./id";
import type { Entity, Relation } from "./types";

export interface RuleEvaluationResult {
  /** Keyed by target entity id. */
  entityUpdates: Map<string, Partial<Entity>>;
  newRelations: Relation[];
  /** Keyed by the rule entity's own id — its updated fields (with a new
   * log entry appended), so the GM can see what fired and why. Typed as a
   * plain bag (not RuleFields) because this is what gets written straight
   * back into Entity.fields, same as every other kind-specific section. */
  ruleFieldUpdates: Map<string, Record<string, unknown>>;
}

/** One pass: for every enabled rule whose watched entity just transitioned
 * into the trigger value (and wasn't already there), apply its action.
 * "Just transitioned" is what stops a rule from re-firing every single
 * commit once its condition is already true. */
export function evaluateRulesOnce(
  ruleEntities: Entity[],
  previousById: Map<string, Entity>,
  currentEntities: Entity[],
  currentRelations: Relation[],
): RuleEvaluationResult {
  const entityUpdates = new Map<string, Partial<Entity>>();
  const newRelations: Relation[] = [];
  const ruleFieldUpdates = new Map<string, Record<string, unknown>>();
  const currentById = new Map(currentEntities.map((entity) => [entity.id, entity]));

  for (const ruleEntity of ruleEntities) {
    const rule = readRuleFields(ruleEntity.fields);
    if (!rule.enabled || !rule.trigger.entityId || !rule.trigger.value || !rule.action.targetEntityId) continue;

    const watched = currentById.get(rule.trigger.entityId);
    if (!watched) continue;
    const watchedBefore = previousById.get(rule.trigger.entityId);
    const justMatched = watched.status === rule.trigger.value && watchedBefore?.status !== rule.trigger.value;
    if (!justMatched) continue;

    const target = currentById.get(rule.action.targetEntityId);
    if (!target) continue;

    let note = "";
    if (rule.action.kind === "set_status") {
      entityUpdates.set(target.id, { ...entityUpdates.get(target.id), status: rule.action.value || null });
      note = `"${watched.title}" chegou a "${rule.trigger.value}" → status de "${target.title}" definido como "${rule.action.value || "—"}".`;
    } else if (rule.action.kind === "mark_important") {
      entityUpdates.set(target.id, { ...entityUpdates.get(target.id), important: true });
      note = `"${watched.title}" chegou a "${rule.trigger.value}" → "${target.title}" marcado como importante.`;
    } else if (rule.action.kind === "create_relation") {
      const alreadyExists =
        currentRelations.some((relation) => relation.fromEntityId === watched.id && relation.toEntityId === target.id && relation.type === rule.action.relationType) ||
        newRelations.some((relation) => relation.fromEntityId === watched.id && relation.toEntityId === target.id && relation.type === rule.action.relationType);
      if (!alreadyExists) {
        const now = Date.now();
        newRelations.push({
          id: createId("relation"),
          campaignId: watched.campaignId,
          fromEntityId: watched.id,
          toEntityId: target.id,
          type: rule.action.relationType,
          label: "",
          description: `Criada automaticamente pela regra "${ruleEntity.title}".`,
          date: null,
          sessionId: null,
          importance: null,
          state: null,
          fields: {},
          history: [],
          createdAt: now,
          updatedAt: now,
        });
        note = `"${watched.title}" chegou a "${rule.trigger.value}" → relação "${relationConfig(rule.action.relationType).label}" criada até "${target.title}".`;
      }
    }

    if (note) {
      const log = [...rule.log, { id: createId("rulelog"), at: Date.now(), note }].slice(-30);
      ruleFieldUpdates.set(ruleEntity.id, { ...rule, log } as Record<string, unknown>);
    }
  }

  return { entityUpdates, newRelations, ruleFieldUpdates };
}
