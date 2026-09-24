import { projectProgress, readProjectFields, type ProjectFields } from "../../domain/projectFields";
import { ObjectiveList } from "./ObjectiveList";

interface ProjectSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function ProjectSection({ fields, onUpdate }: ProjectSectionProps) {
  const project = readProjectFields(fields);
  const progress = projectProgress(project);

  function patch(partial: Partial<ProjectFields>) {
    onUpdate({ ...project, ...partial });
  }

  return (
    <div className="kind-section">
      <label>Objetivo<textarea value={project.goal} onChange={(e) => patch({ goal: e.target.value })} placeholder="O que esse projeto entrega quando terminar?" /></label>

      <span className="eyebrow">PROGRESSO ({progress.done}/{progress.total} · {progress.percent}%)</span>
      <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress.percent}%` }} /></div>

      <ObjectiveList title="Etapas" objectives={project.stages} onChange={(next) => patch({ stages: next })} />

      <div className="compact-grid">
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Prazo<input value={project.deadline} placeholder="Ex.: antes do inverno" onChange={(e) => patch({ deadline: e.target.value })} /></label>
      </div>

      <label>Bloqueios<textarea value={project.blockers} onChange={(e) => patch({ blockers: e.target.value })} placeholder="O que está impedindo o avanço?" /></label>
      <label>Notas<textarea value={project.notes} onChange={(e) => patch({ notes: e.target.value })} /></label>
      <div className="inspector-tip">Use as relações abaixo (tipo "requer") para ligar recursos e itens que o projeto consome.</div>
    </div>
  );
}
