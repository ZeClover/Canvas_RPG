import { useMemo } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { readScheduleFields } from "../../domain/scheduleFields";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface SchedulePanelProps {
  entities: Entity[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

interface LocationGroup {
  locationEntity: Entity | null;
  rows: Array<{ owner: Entity; label: string; note: string }>;
}

/** Agenda: "onde estão agora" reads every entity's own schedule entries
 * (see scheduleFields.ts) and regroups them by location — no separate
 * store, so it can never drift from what's set on each card. */
export function SchedulePanel({ entities, onClose, onFocusEntity }: SchedulePanelProps) {
  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const groups = useMemo(() => {
    const byLocation = new Map<string, LocationGroup>();
    for (const owner of entities) {
      if (owner.kind === "group") continue;
      const { entries } = readScheduleFields(owner.fields);
      for (const entry of entries) {
        const key = entry.locationEntityId ?? "__unassigned__";
        if (!byLocation.has(key)) {
          byLocation.set(key, { locationEntity: entry.locationEntityId ? entityById.get(entry.locationEntityId) ?? null : null, rows: [] });
        }
        byLocation.get(key)!.rows.push({ owner, label: entry.label, note: entry.note });
      }
    }
    return [...byLocation.values()].sort((a, b) => (a.locationEntity?.title ?? "zzz").localeCompare(b.locationEntity?.title ?? "zzz"));
  }, [entities, entityById]);

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Onde estão agora">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">AGENDA</span><h2>Onde estão agora</h2></div>
          <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="tool-panel-section">
          {groups.map((group) => (
            <div key={group.locationEntity?.id ?? "unassigned"} className="schedule-group">
              <button
                type="button"
                className="schedule-group-heading"
                disabled={!group.locationEntity}
                onClick={() => group.locationEntity && onFocusEntity(group.locationEntity.id)}
              >
                {group.locationEntity ? `${kindConfig(group.locationEntity.kind).icon} ${group.locationEntity.title}` : "Sem local definido"}
              </button>
              <ul className="entity-list">
                {group.rows.map(({ owner, label, note }, i) => (
                  <li key={`${owner.id}-${i}`}>
                    <button type="button" className="entity-row" onClick={() => { onFocusEntity(owner.id); onClose(); }}>
                      <span className="entity-row-icon">{owner.icon ?? kindConfig(owner.kind).icon}</span>
                      <span className="entity-row-body">
                        <span className="entity-row-title">{owner.title || "Sem título"}</span>
                        <span className="entity-row-meta">{label}{note ? ` · ${note}` : ""}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {!groups.length && <div className="tool-panel-empty">Nenhuma entrada de agenda ainda — adicione uma na seção "Agenda" de qualquer elemento.</div>}
        </div>
      </section>
    </div>
  );
}
