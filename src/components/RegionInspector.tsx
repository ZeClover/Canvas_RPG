import { useEffect, useState } from "react";
import type { CanvasRegion, RegionKind } from "../domain/types";
import { Icons } from "./Icons";

interface RegionInspectorProps {
  region: CanvasRegion;
  onUpdate: (updates: Partial<CanvasRegion>) => void;
  onClose: () => void;
}

const REGION_LABELS: Record<RegionKind, string> = {
  region: "Região",
  session: "Sessão",
  collection: "Coleção",
};

export function RegionInspector({ region, onUpdate, onClose }: RegionInspectorProps) {
  const [title, setTitle] = useState(region.title);
  const [color, setColor] = useState(region.color);
  const [width, setWidth] = useState(String(Math.round(region.width)));
  const [height, setHeight] = useState(String(Math.round(region.height)));

  useEffect(() => {
    setTitle(region.title);
    setColor(region.color);
    setWidth(String(Math.round(region.width)));
    setHeight(String(Math.round(region.height)));
  }, [region.color, region.height, region.id, region.title, region.width]);

  return (
    <aside className="node-inspector region-inspector" aria-label="Propriedades da região">
      <div className="inspector-heading">
        <div><span className="eyebrow">REGIÃO SELECIONADA</span><h3>{region.title}</h3></div>
        <button className="icon-button" type="button" aria-label="Fechar propriedades" onClick={onClose}><Icons.close /></button>
      </div>
      <label>
        Nome
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => title.trim() && title !== region.title && onUpdate({ title: title.trim() })}
        />
      </label>
      <label>
        Tipo
        <select value={region.kind} onChange={(event) => onUpdate({ kind: event.target.value as RegionKind })}>
          {Object.entries(REGION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="color-field">
        Cor
        <span>
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            onBlur={() => color !== region.color && onUpdate({ color })}
          />
          {color}
        </span>
      </label>
      <div className="size-fields">
        <label>
          Largura
          <input value={width} inputMode="numeric" onChange={(event) => setWidth(event.target.value)} onBlur={() => onUpdate({ width: Math.max(360, Math.min(6000, Number(width) || region.width)) })} />
        </label>
        <label>
          Altura
          <input value={height} inputMode="numeric" onChange={(event) => setHeight(event.target.value)} onBlur={() => onUpdate({ height: Math.max(260, Math.min(5000, Number(height) || region.height)) })} />
        </label>
      </div>
      <div className="inspector-tip">Arraste o título para mover toda a região. Use a alça no canto inferior direito para redimensionar.</div>
    </aside>
  );
}
