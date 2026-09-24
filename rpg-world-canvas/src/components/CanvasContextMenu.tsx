import { useEffect, useRef } from "react";
import type { CanvasContextTarget } from "../canvas/CanvasEngine";
import { Icons } from "./Icons";

interface CanvasContextMenuProps {
  target: CanvasContextTarget;
  onClose: () => void;
  onAction: (action: "npc" | "group" | "duplicate" | "delete") => void;
}

export function CanvasContextMenu({ target, onClose, onAction }: CanvasContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div className="context-menu-backdrop">
      <div ref={ref} className="canvas-context-menu" style={{ left: target.screen.x, top: target.screen.y }}>
        {target.kind === "canvas" && (
          <>
            <button onClick={() => onAction("npc")}><Icons.plus /> Nova caixa aqui</button>
            <button onClick={() => onAction("group")}><Icons.group /> Novo grupo aqui</button>
          </>
        )}
        {(target.kind === "entity" || target.kind === "group") && (
          <>
            <button onClick={() => onAction("duplicate")}><Icons.spark /> Duplicar</button>
            <button className="danger-menu" onClick={() => onAction("delete")}><Icons.trash /> Excluir</button>
          </>
        )}
      </div>
    </div>
  );
}
