import { useMemo, useState } from "react";
import { kindConfig } from "../domain/entityKindRegistry";
import { readEventFields } from "../domain/eventFields";
import { readSessionFields } from "../domain/sessionFields";
import type { Entity } from "../domain/types";
import { Icons } from "./Icons";

interface TimelinePanelProps {
  entities: Entity[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

interface TimelineRow {
  entity: Entity;
  order: number;
  dateLabel: string;
}

export function TimelinePanel({ entities, onClose, onFocusEntity }: TimelinePanelProps) {
  const [showEvents, setShowEvents] = useState(true);
  const [showSessions, setShowSessions] = useState(true);
  const [search, setSearch] = useState("");

  const rows = useMemo<TimelineRow[]>(() => {
    const list: TimelineRow[] = [];
    for (const entity of entities) {
      if (entity.kind === "event" && showEvents) {
        const fields = readEventFields(entity.fields);
        list.push({ entity, order: fields.timelineOrder ?? entity.createdAt, dateLabel: fields.date || fields.era || "—" });
      } else if (entity.kind === "session" && showSessions) {
        const fields = readSessionFields(entity.fields);
        const numeric = Number(fields.number);
        list.push({ entity, order: Number.isFinite(numeric) && fields.number ? numeric * 1_000_000 : entity.createdAt, dateLabel: fields.date || (fields.number ? `Sessão ${fields.number}` : "—") });
      }
    }
    const query = search.trim().toLowerCase();
    const filtered = query ? list.filter((row) => row.entity.title.toLowerCase().includes(query) || row.entity.summary.toLowerCase().includes(query)) : list;
    return filtered.sort((a, b) => a.order - b.order);
  }, [entities, search, showEvents, showSessions]);

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Timeline da campanha">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">TIMELINE</span><h2>Linha do tempo</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="timeline-filters">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título ou resumo…" />
          <label><input type="checkbox" checked={showEvents} onChange={(event) => setShowEvents(event.target.checked)} /> Eventos</label>
          <label><input type="checkbox" checked={showSessions} onChange={(event) => setShowSessions(event.target.checked)} /> Sessões</label>
        </div>

        <ul className="timeline-list">
          {rows.map((row) => (
            <li key={row.entity.id} className="timeline-row">
              <span className="timeline-date">{row.dateLabel}</span>
              <button type="button" className="timeline-item" onClick={() => { onFocusEntity(row.entity.id); onClose(); }}>
                <span className="timeline-icon">{row.entity.icon ?? kindConfig(row.entity.kind).icon}</span>
                <span>
                  <strong>{row.entity.title || "Sem título"}</strong>
                  {row.entity.summary && <small>{row.entity.summary}</small>}
                </span>
              </button>
            </li>
          ))}
          {!rows.length && <li className="tool-panel-empty">Nenhum evento ou sessão cadastrado ainda.</li>}
        </ul>
      </section>
    </div>
  );
}
