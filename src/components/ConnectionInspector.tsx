import { useEffect, useState } from "react";
import type { CanvasConnection } from "../domain/types";
import { ColorPicker } from "./ColorPicker";
import { Icons } from "./Icons";

interface Props {
  connection: CanvasConnection;
  onUpdate: (updates: Partial<CanvasConnection>) => void;
  onReverse: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ConnectionInspector({ connection, onUpdate, onReverse, onDelete, onClose }: Props) {
  const [label, setLabel] = useState(connection.label);
  useEffect(() => setLabel(connection.label), [connection.id, connection.label]);
  return (
    <aside className="node-inspector connection-inspector" aria-label="Propriedades da conexão">
      <div className="inspector-heading">
        <div><span className="eyebrow">CONEXÃO</span><h3>{connection.label || "Sem título"}</h3></div>
        <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
      </div>
      <label>Texto<input value={label} onChange={(event) => setLabel(event.target.value)} onBlur={() => label !== connection.label && onUpdate({ label })} placeholder="Ex.: se aceitarem" /></label>
      <label>Tipo<select value={connection.relation} onChange={(event) => onUpdate({ relation: event.target.value as CanvasConnection["relation"] })}><option value="flow">Fluxo — seta sólida</option><option value="condition">Condição — seta tracejada em losango</option><option value="reference">Referência — linha pontilhada</option></select></label>
      <label>Cor<ColorPicker value={connection.color} onChange={(color) => onUpdate({ color })} /></label>
      <div className="inspector-actions"><button className="ghost-button" onClick={onReverse}>Inverter direção</button><button className="danger-button" onClick={onDelete}><Icons.trash /> Excluir</button></div>
    </aside>
  );
}
