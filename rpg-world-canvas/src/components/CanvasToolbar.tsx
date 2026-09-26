import { useState } from "react";
import type { AlignMode, DistributeAxis } from "../domain/alignment";
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
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: DistributeAxis) => void;
  onFitSelection: () => void;
}

const ALIGN_OPTIONS: Array<{ mode: AlignMode; label: string }> = [
  { mode: "left", label: "Esquerda" },
  { mode: "centerX", label: "Centro (horizontal)" },
  { mode: "right", label: "Direita" },
  { mode: "top", label: "Topo" },
  { mode: "centerY", label: "Centro (vertical)" },
  { mode: "bottom", label: "Base" },
];

export function CanvasToolbar({ selectedCount, hasSelection, onAddEntity, onAddGroup, onConnect, onDelete, onAlign, onDistribute, onFitSelection }: CanvasToolbarProps) {
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
      <button onClick={onFitSelection} disabled={!hasSelection} title="Enquadrar só a seleção (Shift+Home)"><Icons.frame /><span>Enquadrar seleção</span></button>
      <span className="toolbar-divider" />
      <select
        className="kind-select"
        value=""
        disabled={selectedCount < 2}
        title="Alinhar os elementos selecionados"
        aria-label="Alinhar os elementos selecionados"
        onChange={(event) => {
          const mode = event.target.value as AlignMode | "";
          if (mode) onAlign(mode);
          event.target.value = "";
        }}
      >
        <option value="" disabled>Alinhar…</option>
        {ALIGN_OPTIONS.map((option) => <option value={option.mode} key={option.mode}>{option.label}</option>)}
      </select>
      <select
        className="kind-select"
        value=""
        disabled={selectedCount < 3}
        title="Distribuir espaçamento uniforme entre os selecionados"
        aria-label="Distribuir espaçamento uniforme entre os selecionados"
        onChange={(event) => {
          const axis = event.target.value as DistributeAxis | "";
          if (axis) onDistribute(axis);
          event.target.value = "";
        }}
      >
        <option value="" disabled>Distribuir…</option>
        <option value="horizontal">Horizontal</option>
        <option value="vertical">Vertical</option>
      </select>
      <button className="danger-tool" onClick={onDelete} disabled={!hasSelection} title="Excluir selecionados"><Icons.trash /></button>
    </div>
  );
}
