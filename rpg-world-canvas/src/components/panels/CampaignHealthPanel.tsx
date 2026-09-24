import { useMemo, useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { readForeshadowingFields } from "../../domain/foreshadowingFields";
import { orphanEntities } from "../../domain/graph";
import { isResourceCritical, readResourceFields } from "../../domain/resourceFields";
import { readRuleFields } from "../../domain/ruleFields";
import type { Entity, EntityKind, Relation } from "../../domain/types";
import { Icons } from "../Icons";

interface CampaignHealthPanelProps {
  entities: Entity[];
  relations: Relation[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

interface Signal {
  key: string;
  label: string;
  items: Entity[];
  tone: "warning" | "info";
}

/** Campaign Health Dashboard: every number here is recomputed live from
 * entities/relations the GM already has — no separate "health" table, no
 * inference. It's the same signals the other engines already track
 * (critical resources, disabled rules, orphan clues...) collected into
 * one screen instead of making the GM open five panels. */
export function CampaignHealthPanel({ entities, relations, onClose, onFocusEntity }: CampaignHealthPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const cardEntities = useMemo(() => entities.filter((entity) => entity.kind !== "group"), [entities]);

  const breakdown = useMemo(() => {
    const map = new Map<EntityKind, number>();
    for (const entity of cardEntities) map.set(entity.kind, (map.get(entity.kind) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [cardEntities]);

  const signals: Signal[] = useMemo(() => {
    const orphans = orphanEntities(cardEntities, relations);
    const criticalResources = cardEntities.filter((entity) => entity.kind === "resource" && isResourceCritical(readResourceFields(entity.fields)));
    const disabledRules = cardEntities.filter((entity) => entity.kind === "rule" && !readRuleFields(entity.fields).enabled);
    const dormantRules = cardEntities.filter((entity) => entity.kind === "rule" && readRuleFields(entity.fields).enabled && readRuleFields(entity.fields).log.length === 0);
    const openForeshadowing = cardEntities.filter((entity) => entity.kind === "foreshadowing" && readForeshadowingFields(entity.fields).status !== "Pago");
    return [
      { key: "orphans", label: "Elementos sem nenhuma relação", items: orphans, tone: "warning" },
      { key: "critical", label: "Recursos em estoque crítico", items: criticalResources, tone: "warning" },
      { key: "disabled-rules", label: "Regras desativadas", items: disabledRules, tone: "info" },
      { key: "dormant-rules", label: "Regras ativas que nunca dispararam", items: dormantRules, tone: "info" },
      { key: "open-foreshadowing", label: "Presságios ainda sem pagamento", items: openForeshadowing, tone: "info" },
    ];
  }, [cardEntities, relations]);

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Saúde da campanha">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">CAMPAIGN HEALTH</span><h2>Saúde da campanha</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="tool-panel-columns">
          <div className="tool-panel-section">
            <span className="eyebrow">ELEMENTOS POR TIPO ({cardEntities.length} · {relations.length} relações)</span>
            <ul className="entity-list health-breakdown">
              {breakdown.map(([kind, count]) => (
                <li key={kind} className="health-breakdown-row">
                  <span className="entity-row-icon">{kindConfig(kind).icon}</span>
                  <span className="health-breakdown-label">{kindConfig(kind).label}</span>
                  <span className="health-breakdown-count">{count}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="tool-panel-section">
            <span className="eyebrow">SINAIS DE ATENÇÃO</span>
            <ul className="health-signal-list">
              {signals.map((signal) => (
                <li key={signal.key}>
                  <button type="button" className={`health-signal is-${signal.tone}`} onClick={() => setExpanded((current) => (current === signal.key ? null : signal.key))}>
                    <span>{signal.label}</span>
                    <span className="health-signal-count">{signal.items.length}</span>
                  </button>
                  {expanded === signal.key && signal.items.length > 0 && (
                    <ul className="entity-list health-signal-items">
                      {signal.items.map((entity) => (
                        <li key={entity.id}>
                          <button type="button" className="entity-row" onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                            <span className="entity-row-icon">{entity.icon ?? kindConfig(entity.kind).icon}</span>
                            <span className="entity-row-body">
                              <span className="entity-row-title">{entity.title || "Sem título"}</span>
                              <span className="entity-row-meta">{kindConfig(entity.kind).label}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
