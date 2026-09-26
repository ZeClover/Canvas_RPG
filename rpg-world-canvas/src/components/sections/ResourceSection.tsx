import { isResourceCritical, readResourceFields, type ResourceFields } from "../../domain/resourceFields";

interface ResourceSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function ResourceSection({ fields, onUpdate }: ResourceSectionProps) {
  const resource = readResourceFields(fields);
  const critical = isResourceCritical(resource);

  function patch(partial: Partial<ResourceFields>) {
    onUpdate({ ...fields, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">RECURSO</span>
      {critical && <div className="resource-critical-banner">Estoque crítico — abaixo do limite configurado.</div>}
      <div className="compact-grid">
        <label className="compact-field">Estoque<input type="number" value={resource.stock} onChange={(e) => patch({ stock: Number(e.target.value) })} /></label>
        <label className="compact-field">Unidade<input value={resource.unit} placeholder="Ex.: porções, barris" onChange={(e) => patch({ unit: e.target.value })} /></label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Limite crítico<input type="number" value={resource.criticalThreshold} onChange={(e) => patch({ criticalThreshold: Number(e.target.value) })} /></label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Reposição/consumo<input value={resource.regenNote} placeholder="Ex.: reabastece 20 a cada sessão de mercado" onChange={(e) => patch({ regenNote: e.target.value })} /></label>
      </div>
      <label>Notas<textarea value={resource.notes} onChange={(e) => patch({ notes: e.target.value })} /></label>
    </div>
  );
}
