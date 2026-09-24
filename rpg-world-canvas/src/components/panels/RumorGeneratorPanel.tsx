import { useEffect, useMemo, useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { renderTemplate, RUMOR_TEMPLATES, templateIsComplete, type TemplateSegment } from "../../domain/rumorTemplates";
import { RUMOR_TRUTH_STATES, type RumorTruthState } from "../../domain/rumorFields";
import type { Entity, EntityKind } from "../../domain/types";
import { Icons } from "../Icons";

interface RumorGeneratorPanelProps {
  entities: Entity[];
  onClose: () => void;
  onCreateRumor: (title: string, summary: string, fields: Record<string, unknown>) => void;
}

/** Rumor Engine's "templates": fixed sentence skeletons filled in by
 * picking existing entities (or free text) from dropdowns — pure string
 * interpolation, never generated text. Creating the rumor from here is
 * the same store.createEntity("rumor", ...) any other card uses; this
 * panel just assembles the summary text for you first. */
export function RumorGeneratorPanel({ entities, onClose, onCreateRumor }: RumorGeneratorPanelProps) {
  const [templateId, setTemplateId] = useState(RUMOR_TEMPLATES[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [truth, setTruth] = useState<RumorTruthState>("Desconhecido");

  const template = RUMOR_TEMPLATES.find((candidate) => candidate.id === templateId) ?? RUMOR_TEMPLATES[0];
  useEffect(() => setValues({}), [templateId]);

  const entitiesByKind = useMemo(() => {
    const map = new Map<EntityKind, Entity[]>();
    for (const entity of entities) {
      if (entity.kind === "group") continue;
      const list = map.get(entity.kind);
      if (list) list.push(entity);
      else map.set(entity.kind, [entity]);
    }
    for (const list of map.values()) list.sort((a, b) => a.title.localeCompare(b.title));
    return map;
  }, [entities]);

  const preview = renderTemplate(template, values);
  const complete = templateIsComplete(template, values);
  const slots = template.segments.filter((segment): segment is Extract<TemplateSegment, { type: "slot" }> => segment.type === "slot");

  function create() {
    if (!complete) return;
    const title = preview.length > 90 ? `${preview.slice(0, 87)}…` : preview;
    onCreateRumor(title, preview, { truth, source: "", spreadNotes: "", templateId: template.id });
  }

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Gerador de rumores">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">RUMOR ENGINE</span><h2>Gerador de rumores</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <label className="compact-field" style={{ marginBottom: 14 }}>
          Template
          <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            {RUMOR_TEMPLATES.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.label}</option>)}
          </select>
        </label>

        <div className="compact-grid rumor-slots">
          {slots.map((slot) => {
            const options = slot.kind ? entitiesByKind.get(slot.kind) ?? [] : null;
            return (
              <label className="compact-field" key={slot.key}>
                {slot.label}
                {options ? (
                  <select value={values[slot.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [slot.key]: event.target.value }))}>
                    <option value="">Escolha…</option>
                    {options.map((entity) => <option value={entity.title} key={entity.id}>{kindConfig(entity.kind).icon} {entity.title}</option>)}
                  </select>
                ) : (
                  <input value={values[slot.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [slot.key]: event.target.value }))} placeholder="Texto livre…" />
                )}
              </label>
            );
          })}
        </div>

        <span className="eyebrow">PRÉVIA</span>
        <p className="rumor-preview">{preview}</p>

        <label className="compact-field" style={{ marginBottom: 16 }}>
          É verdade? (só o mestre vê)
          <select value={truth} onChange={(event) => setTruth(event.target.value as RumorTruthState)}>
            {RUMOR_TRUTH_STATES.map((state) => <option value={state} key={state}>{state}</option>)}
          </select>
        </label>

        <button type="button" className="primary-button rumor-create-button" disabled={!complete} onClick={create}>
          <Icons.plus /> Criar rumor no Canvas
        </button>
      </section>
    </div>
  );
}
