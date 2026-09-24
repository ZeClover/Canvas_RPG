import { useState } from "react";
import { NODE_KIND_LABELS, type CanvasNode, type NodeKind } from "../domain/types";
import { ColorPicker } from "./ColorPicker";
import { Icons } from "./Icons";

interface BulkInspectorProps {
  count: number;
  onUpdate: (updates: Partial<Pick<CanvasNode, "kind" | "color" | "important" | "tags">>) => void;
  onClose: () => void;
}

export function BulkInspector({ count, onUpdate, onClose }: BulkInspectorProps) {
  const [tags, setTags] = useState("");
  const [color, setColor] = useState("#20283a");
  return (
    <aside className="node-inspector bulk-inspector">
      <div className="inspector-heading">
        <div><span className="eyebrow">EDIÇÃO EM MASSA</span><h3>{count} caixas</h3></div>
        <button className="icon-button" onClick={onClose} aria-label="Fechar"><Icons.close /></button>
      </div>
      <label>Tipo<select defaultValue="" onChange={(event) => event.target.value && onUpdate({ kind: event.target.value as NodeKind })}><option value="">Manter atual</option>{Object.entries(NODE_KIND_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Cor<ColorPicker value={color} onChange={(next) => { setColor(next); onUpdate({ color: next }); }} /></label>
      <label>Substituir etiquetas<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="combate, boss, final" /></label>
      <button className="ghost-button bulk-apply" onClick={() => onUpdate({ tags: [...new Set(tags.split(",").map((tag) => tag.trim().toLocaleLowerCase("pt-BR")).filter(Boolean))].slice(0, 20) })}>Aplicar etiquetas</button>
      <label className="important-toggle"><input type="checkbox" onChange={(event) => onUpdate({ important: event.target.checked })} /> Destacar todas no mapa distante</label>
    </aside>
  );
}
