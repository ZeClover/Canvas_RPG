import { useState } from "react";
import { CARD_KINDS, kindConfig } from "../domain/entityKindRegistry";
import type { EntityKind } from "../domain/types";
import { Icons } from "./Icons";

interface CanvasToolbarProps {
  selectedCount: number;
  hasSelection: boolean;
  onAddEntity: (kind: EntityKind) => void;
  onAddGroup: () => void;
  onConnect: () => void;
  onDelete: () => void;
}

export function CanvasToolbar({ selectedCount, hasSelection, onAddEntity, onAddGroup, onConnect, onDelete }: CanvasToolbarProps) {
  const [kind, setKind] = useState<EntityKind>("npc");
  return (
    <div className="canvas-toolbar">
      <select className="kind-select" value={kind} onChange={(event) => setKind(event.target.value as EntityKind)} aria-label="Tipo do novo elemento">
        {CARD_KINDS.map((candidate) => <option key={candidate} value={candidate}>{kindConfig(candidate).icon} {kindConfig(candidate).label}</option>)}
      </select>
      <button onClick={() => onAddEntity(kind)} title="Criar elemento deste tipo"><Icons.plus /><span>Criar</span></button>
      <button onClick={onAddGroup} title="Criar uma área/grupo no canvas"><Icons.group /><span>Grupo</span></button>
      <span className="toolbar-divider" />
      <button onClick={onConnect} disabled={selectedCount !== 2} title="Selecione dois elementos com Shift"><Icons.link /><span>Conectar</span></button>
      <button className="danger-tool" onClick={onDelete} disabled={!hasSelection} title="Excluir selecionados"><Icons.trash /></button>
    </div>
  );
}
