import { useState } from "react";
import { createId } from "../../domain/id";
import { QUEST_STATUSES, readQuestFields, type QuestFields } from "../../domain/questFields";
import { Icons } from "../Icons";
import { ObjectiveList } from "./ObjectiveList";

interface QuestSectionProps {
  status: string | null;
  fields: Record<string, unknown>;
  onUpdateStatus: (status: string) => void;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function QuestSection({ status, fields, onUpdateStatus, onUpdate }: QuestSectionProps) {
  const quest = readQuestFields(fields);
  const [resolutionTitle, setResolutionTitle] = useState("");

  function patch(partial: Partial<QuestFields>) {
    onUpdate({ ...fields, ...partial });
  }

  return (
    <div className="kind-section">
      <label>
        Status
        <select value={status ?? QUEST_STATUSES[0]} onChange={(e) => onUpdateStatus(e.target.value)}>
          {QUEST_STATUSES.map((value) => <option value={value} key={value}>{value}</option>)}
        </select>
      </label>

      <label>Motivação<textarea value={quest.motivation} onChange={(e) => patch({ motivation: e.target.value })} placeholder="Por que essa quest existe?" /></label>
      <label>Objetivo principal<textarea value={quest.mainObjective} onChange={(e) => patch({ mainObjective: e.target.value })} /></label>

      <ObjectiveList title="Objetivos secundários" objectives={quest.secondaryObjectives} onChange={(next) => patch({ secondaryObjectives: next })} />
      <ObjectiveList title="Objetivos ocultos 🔒" objectives={quest.hiddenObjectives} onChange={(next) => patch({ hiddenObjectives: next })} />

      <span className="eyebrow">CONDIÇÕES</span>
      <label>Início<textarea value={quest.startConditions} onChange={(e) => patch({ startConditions: e.target.value })} /></label>
      <label>Falha<textarea value={quest.failConditions} onChange={(e) => patch({ failConditions: e.target.value })} /></label>
      <label>Conclusão<textarea value={quest.completeConditions} onChange={(e) => patch({ completeConditions: e.target.value })} /></label>

      <div className="compact-grid">
        <label className="compact-field">Prazo<input value={quest.deadline} onChange={(e) => patch({ deadline: e.target.value })} placeholder="Ex.: 3 sessões" /></label>
      </div>

      <span className="eyebrow">RELÓGIO</span>
      {quest.clock ? (
        <div className="clock-editor">
          <input value={quest.clock.label} onChange={(e) => patch({ clock: { ...quest.clock!, label: e.target.value } })} placeholder="Rótulo" />
          <input type="number" min={0} max={quest.clock.max} value={quest.clock.current} onChange={(e) => patch({ clock: { ...quest.clock!, current: Number(e.target.value) } })} />
          <span>/</span>
          <input type="number" min={1} value={quest.clock.max} onChange={(e) => patch({ clock: { ...quest.clock!, max: Number(e.target.value) } })} />
          <button type="button" className="icon-button" title="Remover relógio" aria-label="Remover relógio" onClick={() => patch({ clock: null })}><Icons.close /></button>
        </div>
      ) : (
        <button type="button" className="ghost-button" onClick={() => patch({ clock: { label: "Prazo", current: 0, max: 4 } })}><Icons.plus /> Adicionar relógio</button>
      )}

      <label>Recompensas<textarea value={quest.rewards} onChange={(e) => patch({ rewards: e.target.value })} /></label>
      <label>Consequências<textarea value={quest.consequences} onChange={(e) => patch({ consequences: e.target.value })} /></label>

      <span className="eyebrow">RESOLUÇÕES POSSÍVEIS ({quest.resolutions.length})</span>
      <ul className="mini-list">
        {quest.resolutions.map((resolution) => (
          <li key={resolution.id}>
            <span className="mini-list-text">{resolution.title}</span>
            <button type="button" className="icon-button" title="Remover" aria-label="Remover" onClick={() => patch({ resolutions: quest.resolutions.filter((r) => r.id !== resolution.id) })}><Icons.close /></button>
          </li>
        ))}
        {!quest.resolutions.length && <li className="mini-list-empty">Ex.: salvar Hector, encontrar o corpo, investigar a morte…</li>}
      </ul>
      <div className="inline-form">
        <input value={resolutionTitle} onChange={(e) => setResolutionTitle(e.target.value)} placeholder="Nova resolução…" />
        <button type="button" title="Adicionar resolução" aria-label="Adicionar resolução" disabled={!resolutionTitle.trim()} onClick={() => {
          patch({ resolutions: [...quest.resolutions, { id: createId("resolution"), title: resolutionTitle.trim(), description: "" }] });
          setResolutionTitle("");
        }}><Icons.plus /></button>
      </div>
      <div className="inspector-tip">Use as relações (seção abaixo) para ligar NPCs envolvidos, locais, itens, segredos e pistas — e os tipos "desbloqueia se concluir/falhar" para ramificar em outras quests.</div>
    </div>
  );
}
