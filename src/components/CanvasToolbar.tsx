import { Icons } from "./Icons";

interface CanvasToolbarProps {
  selectedCount: number;
  hasSelection: boolean;
  canGroup: boolean;
  canUngroup: boolean;
  focusMode: boolean;
  onAddNode: () => void;
  onAddRegion: () => void;
  onAddSession: () => void;
  onConnect: () => void;
  onCreateReference: () => void;
  onOpenTemplates: () => void;
  onDelete: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onToggleFocusMode: () => void;
  onExportImage: () => void;
}

export function CanvasToolbar({
  selectedCount,
  hasSelection,
  canGroup,
  canUngroup,
  focusMode,
  onAddNode,
  onAddRegion,
  onAddSession,
  onConnect,
  onCreateReference,
  onOpenTemplates,
  onDelete,
  onGroup,
  onUngroup,
  onToggleFocusMode,
  onExportImage,
}: CanvasToolbarProps) {
  return (
    <div className="canvas-toolbar">
      <button onClick={onAddNode} title="Nova caixa"><Icons.plus /><span>Caixa</span></button>
      <button onClick={onAddRegion} title="Nova região"><Icons.region /><span>Região</span></button>
      <button onClick={onAddSession} title="Nova sessão"><Icons.session /><span>Sessão</span></button>
      <button onClick={onOpenTemplates} title="Templates reutilizáveis"><Icons.spark /><span>Templates</span></button>
      <span className="toolbar-divider" />
      <button onClick={onConnect} disabled={selectedCount !== 2} title="Selecione duas caixas com Shift"><Icons.link /><span>Conectar</span></button>
      <button onClick={onCreateReference} disabled={selectedCount !== 1} title="Criar uma aparição sincronizada deste elemento"><Icons.spark /><span>Referência</span></button>
      {canUngroup ? (
        <button onClick={onUngroup} title="Desagrupar (Ctrl+Shift+G)"><Icons.ungroup /><span>Desagrupar</span></button>
      ) : (
        <button onClick={onGroup} disabled={!canGroup} title="Agrupar seleção — move junto sem virar região (Ctrl+G)"><Icons.group /><span>Agrupar</span></button>
      )}
      <span className="toolbar-divider" />
      <button className={focusMode ? "is-active" : undefined} onClick={onToggleFocusMode} title="Modo foco — realça só a cadeia conectada à seleção"><Icons.focus /><span>Foco</span></button>
      <button onClick={onExportImage} title="Exportar o mapa inteiro como imagem PNG"><Icons.image /><span>Imagem</span></button>
      <button className="danger-tool" onClick={onDelete} disabled={!hasSelection} title="Excluir selecionados"><Icons.trash /></button>
    </div>
  );
}
