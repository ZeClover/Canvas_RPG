import { Icons } from "./Icons";

interface CanvasToolbarProps {
  selectedCount: number;
  hasSelection: boolean;
  onAddNode: () => void;
  onAddRegion: () => void;
  onAddSession: () => void;
  onConnect: () => void;
  onCreateReference: () => void;
  onOpenTemplates: () => void;
  onDelete: () => void;
}

export function CanvasToolbar({ selectedCount, hasSelection, onAddNode, onAddRegion, onAddSession, onConnect, onCreateReference, onOpenTemplates, onDelete }: CanvasToolbarProps) {
  return (
    <div className="canvas-toolbar">
      <button onClick={onAddNode} title="Nova caixa"><Icons.plus /><span>Caixa</span></button>
      <button onClick={onAddRegion} title="Nova região"><Icons.region /><span>Região</span></button>
      <button onClick={onAddSession} title="Nova sessão"><Icons.session /><span>Sessão</span></button>
      <button onClick={onOpenTemplates} title="Templates reutilizáveis"><Icons.spark /><span>Templates</span></button>
      <span className="toolbar-divider" />
      <button onClick={onConnect} disabled={selectedCount !== 2} title="Selecione duas caixas com Shift"><Icons.link /><span>Conectar</span></button>
      <button onClick={onCreateReference} disabled={selectedCount !== 1} title="Criar uma aparição sincronizada deste elemento"><Icons.spark /><span>Referência</span></button>
      <button className="danger-tool" onClick={onDelete} disabled={!hasSelection} title="Excluir selecionados"><Icons.trash /></button>
    </div>
  );
}
