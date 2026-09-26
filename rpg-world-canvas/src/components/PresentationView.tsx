import { useEffect } from "react";
import { presentationContent } from "../domain/presentation";
import type { Entity } from "../domain/types";
import { Icons } from "./Icons";

interface PresentationViewProps {
  entity: Entity;
  onClose: () => void;
}

/** Presentation Mode: what actually goes on a shared screen. Content is
 * derived from `visibility` the same way Player Knowledge View reads it —
 * this view never has its own idea of what's safe to reveal. */
export function PresentationView({ entity, onClose }: PresentationViewProps) {
  const content = presentationContent(entity);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="presentation-backdrop" onMouseDown={onClose}>
      <button type="button" className="icon-button presentation-close" title="Fechar (Esc)" aria-label="Fechar apresentação" onClick={onClose}><Icons.close /></button>
      <div className="presentation-stage" onMouseDown={(event) => event.stopPropagation()}>
        {content.state === "gm_only" && (
          <div className="presentation-hidden">
            <span className="eyebrow">SÓ O MESTRE</span>
            <p>Este elemento ainda não tem visibilidade "revelado" ou "parcial" — nada aparece aqui até você mudar isso no inspetor.</p>
          </div>
        )}
        {content.state === "partial" && (
          <div className="presentation-partial">
            <h1>{content.title}</h1>
            <p>Os jogadores sabem que isso existe — os detalhes ainda não foram revelados.</p>
          </div>
        )}
        {content.state === "revealed" && (
          <>
            {content.imageSrc && <img className="presentation-image" src={content.imageSrc} alt={content.title} />}
            <h1>{content.title}</h1>
            {content.body && <p className="presentation-body">{content.body}</p>}
          </>
        )}
      </div>
    </div>
  );
}
