import type { CanvasContextTarget } from "../canvas/CanvasEngine";
import { Icons } from "./Icons";

interface Props {
  target: CanvasContextTarget;
  onAction: (action: "node" | "region" | "session" | "duplicate" | "reference" | "delete") => void;
  onClose: () => void;
}

export function CanvasContextMenu({ target, onAction, onClose }: Props) {
  const action = (value: Parameters<Props["onAction"]>[0]) => { onAction(value); onClose(); };
  return (
    <div className="context-menu-backdrop" onPointerDown={onClose}>
      <div className="canvas-context-menu" style={{ left: target.screen.x, top: target.screen.y }} onPointerDown={(event) => event.stopPropagation()}>
        {target.kind === "canvas" ? <>
          <button onClick={() => action("node")}><Icons.plus /> Nova caixa</button>
          <button onClick={() => action("region")}><Icons.region /> Nova região</button>
          <button onClick={() => action("session")}><Icons.session /> Nova sessão</button>
        </> : target.kind === "node" ? <>
          <button onClick={() => action("duplicate")}><Icons.plus /> Duplicar caixa</button>
          <button onClick={() => action("reference")}><Icons.spark /> Criar referência</button>
          <button className="danger-menu" onClick={() => action("delete")}><Icons.trash /> Excluir caixa</button>
        </> : <button className="danger-menu" onClick={() => action("delete")}><Icons.trash /> Excluir região</button>}
      </div>
    </div>
  );
}
