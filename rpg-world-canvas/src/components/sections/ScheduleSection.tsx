import { useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { defaultScheduleEntry, readScheduleFields } from "../../domain/scheduleFields";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface ScheduleSectionProps {
  fields: Record<string, unknown>;
  allEntities: Entity[];
  currentEntityId: string;
  onUpdate: (fields: Record<string, unknown>) => void;
}

/** Agenda: generic, works on any non-group entity alongside whatever
 * kind-specific section is already showing — see scheduleFields.ts. */
export function ScheduleSection({ fields, allEntities, currentEntityId, onUpdate }: ScheduleSectionProps) {
  const { entries } = readScheduleFields(fields);
  const [label, setLabel] = useState("");
  const [locationId, setLocationId] = useState("");

  const candidates = allEntities.filter((e) => e.id !== currentEntityId && e.kind !== "group").sort((a, b) => a.title.localeCompare(b.title));

  function patchEntries(next: typeof entries) {
    onUpdate({ ...fields, schedule: next });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">AGENDA</span>
      <ul className="mini-list schedule-entry-list">
        {entries.map((entry) => (
          <li key={entry.id} className="schedule-entry-row">
            <input
              className="schedule-entry-label"
              value={entry.label}
              placeholder="Período (ex.: Manhãs)"
              onChange={(e) => patchEntries(entries.map((x) => (x.id === entry.id ? { ...x, label: e.target.value } : x)))}
            />
            <select
              value={entry.locationEntityId ?? ""}
              onChange={(e) => patchEntries(entries.map((x) => (x.id === entry.id ? { ...x, locationEntityId: e.target.value || null } : x)))}
            >
              <option value="">Onde?</option>
              {candidates.map((c) => <option value={c.id} key={c.id}>{kindConfig(c.kind).icon} {c.title}</option>)}
            </select>
            <input
              className="schedule-entry-note"
              value={entry.note}
              placeholder="Nota (opcional)"
              onChange={(e) => patchEntries(entries.map((x) => (x.id === entry.id ? { ...x, note: e.target.value } : x)))}
            />
            <button type="button" className="icon-button" title="Remover entrada da agenda" aria-label="Remover entrada da agenda" onClick={() => patchEntries(entries.filter((x) => x.id !== entry.id))}><Icons.close /></button>
          </li>
        ))}
        {!entries.length && <li className="mini-list-empty">Nada agendado ainda.</li>}
      </ul>
      <div className="inline-form">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Toda terça à noite" />
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Onde?</option>
          {candidates.map((c) => <option value={c.id} key={c.id}>{kindConfig(c.kind).icon} {c.title}</option>)}
        </select>
        <button
          type="button"
          disabled={!label.trim()}
          onClick={() => {
            patchEntries([...entries, defaultScheduleEntry(label.trim(), locationId || null)]);
            setLabel("");
            setLocationId("");
          }}
        ><Icons.plus /> Adicionar</button>
      </div>
    </div>
  );
}
