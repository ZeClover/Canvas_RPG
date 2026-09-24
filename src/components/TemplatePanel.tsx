import { useMemo, useState } from "react";
import type { CanvasTemplate } from "../data/templateLibrary";
import { Icons } from "./Icons";

interface TemplatePanelProps {
  templates: CanvasTemplate[];
  canSaveSelection: boolean;
  onUse: (template: CanvasTemplate) => void;
  onSaveSelection: (name: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function TemplatePanel({ templates, canSaveSelection, onUse, onSaveSelection, onDelete, onClose }: TemplatePanelProps) {
  const [name, setName] = useState("");
  const grouped = useMemo(() => ({
    builtIn: templates.filter((template) => template.builtIn),
    custom: templates.filter((template) => !template.builtIn),
  }), [templates]);

  return (
    <div className="dialog-backdrop template-backdrop" onMouseDown={onClose}>
      <section className="template-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Biblioteca de templates">
        <header className="session-panel-heading">
          <div><span className="eyebrow">REUTILIZAR</span><h2>Templates</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar"><Icons.close /></button>
        </header>
        <div className="template-save">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do template selecionado" disabled={!canSaveSelection} />
          <button className="primary-button" disabled={!canSaveSelection || !name.trim()} onClick={() => { onSaveSelection(name.trim()); setName(""); }}>Salvar seleção</button>
        </div>
        <TemplateGroup title="PRONTOS" templates={grouped.builtIn} onUse={onUse} onDelete={onDelete} />
        <TemplateGroup title="MEUS TEMPLATES" templates={grouped.custom} onUse={onUse} onDelete={onDelete} empty="Salve uma caixa, região ou sessão selecionada." />
      </section>
    </div>
  );
}

function TemplateGroup({ title, templates, onUse, onDelete, empty }: { title: string; templates: CanvasTemplate[]; onUse: (template: CanvasTemplate) => void; onDelete: (id: string) => void; empty?: string }) {
  return (
    <div className="template-group">
      <span className="eyebrow">{title}</span>
      {templates.length === 0 ? <p>{empty}</p> : <div className="template-grid">
        {templates.map((template) => (
          <article className="template-card" key={template.id}>
            <div className={`template-type type-${template.type}`}>{template.type === "node" ? <Icons.spark /> : <Icons.session />}</div>
            <div><strong>{template.name}</strong><small>{template.nodes.length} caixas · {template.regions.length} áreas</small></div>
            <button className="primary-button" onClick={() => onUse(template)}>Usar</button>
            {!template.builtIn ? <button className="icon-button" onClick={() => onDelete(template.id)} aria-label={`Excluir ${template.name}`}><Icons.trash /></button> : null}
          </article>
        ))}
      </div>}
    </div>
  );
}
