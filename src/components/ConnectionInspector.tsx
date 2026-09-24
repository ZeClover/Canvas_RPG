import { useEffect, useState } from "react";
import type { CanvasConnection } from "../domain/types";
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
      <label>Tipo<select value={connection.relation} onChange={(event) => onUpdate({ relation: event.target.value as CanvasConnection["relation"] })}><option value="flow">Fluxo</option><option value="condition">Condição</option><option value="reference">Referência</option></select></label>
      <label className="color-field">Cor<span><input type="color" value={connection.color} onChange={(event) => onUpdate({ color: event.target.value })} />{connection.color}</span></label>
      <div className="inspector-actions"><button className="ghost-button" onClick={onReverse}>Inverter direção</button><button className="danger-button" onClick={onDelete}><Icons.trash /> Excluir</button></div>
    </aside>
  );
}
