import { useEffect, useState } from "react";
import { imageFileToDataUrl, normalizeExternalImageUrl } from "../data/imageProcessing";
import { NODE_KIND_LABELS, type CanvasNode, type NodeKind } from "../domain/types";
import { ColorPicker } from "./ColorPicker";
import { Icons } from "./Icons";

interface NodeInspectorProps {
  node: CanvasNode;
  onUpdate: (updates: Partial<CanvasNode>) => void;
  onClose: () => void;
}

export function NodeInspector({ node, onUpdate, onClose }: NodeInspectorProps) {
  const [body, setBody] = useState(node.body);
  const [notes, setNotes] = useState(node.instanceNotes);
  const [width, setWidth] = useState(String(Math.round(node.width)));
  const [height, setHeight] = useState(String(Math.round(node.height)));
  const [imageUrl, setImageUrl] = useState(node.imageSrc?.startsWith("http") ? node.imageSrc : "");
  const [imageError, setImageError] = useState("");
  const [tags, setTags] = useState(node.tags.join(", "));

  useEffect(() => {
    setBody(node.body);
    setNotes(node.instanceNotes);
    setWidth(String(Math.round(node.width)));
    setHeight(String(Math.round(node.height)));
    setImageUrl(node.imageSrc?.startsWith("http") ? node.imageSrc : "");
    setImageError("");
    setTags(node.tags.join(", "));
  }, [node.body, node.height, node.id, node.imageSrc, node.instanceNotes, node.tags, node.width]);

  return (
    <aside className="node-inspector">
      <div className="inspector-heading">
        <div><span className="eyebrow">SELECIONADO</span><h3>{node.title}</h3></div>
        <button className="icon-button" type="button" aria-label="Fechar propriedades" onClick={onClose}><Icons.close /></button>
      </div>
      {node.sourceNodeId && <div className="reference-banner"><Icons.link /> Referência sincronizada com o original</div>}
      <label>
        Tipo
        <select value={node.kind} onChange={(event) => onUpdate({ kind: event.target.value as NodeKind })}>
          {Object.entries(NODE_KIND_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
      <label>
        Cor
        <ColorPicker value={node.color} onChange={(color) => onUpdate({ color })} />
      </label>
      <label>
        Conteúdo
        <textarea value={body} onChange={(event) => setBody(event.target.value)} onBlur={() => body !== node.body && onUpdate({ body })} placeholder="Detalhes, falas e lembretes…" />
      </label>
      <label>
        Etiquetas
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          onBlur={() => onUpdate({ tags: [...new Set(tags.split(",").map((tag) => tag.trim().toLocaleLowerCase("pt-BR")).filter(Boolean))].slice(0, 20) })}
          placeholder="vilão, floresta, pista"
        />
      </label>
      <div className="image-field">
        <span>Imagem</span>
        {node.imageSrc ? <img src={node.imageSrc} alt="Prévia do nó" /> : <div className="image-placeholder">Sem imagem</div>}
        <div>
          <label className="image-picker">
            Escolher imagem
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void imageFileToDataUrl(file).then((imageSrc) => onUpdate({ imageSrc }));
              }}
            />
          </label>
          {node.imageSrc && <button type="button" onClick={() => onUpdate({ imageSrc: null })}>Remover</button>}
        </div>
        <div className="image-url-field">
          <input
            type="url"
            value={imageUrl}
            placeholder="Ou cole um link https://…"
            onChange={(event) => { setImageUrl(event.target.value); setImageError(""); }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              const url = normalizeExternalImageUrl(imageUrl);
              if (url) { onUpdate({ imageSrc: url }); setImageError(""); }
              else setImageError("Link inválido");
            }}
          />
          <button type="button" onClick={() => {
            const url = normalizeExternalImageUrl(imageUrl);
            if (url) { onUpdate({ imageSrc: url }); setImageError(""); }
            else setImageError("Link inválido");
          }}>Usar link</button>
        </div>
        {imageError && <small className="image-error">{imageError}</small>}
      </div>
      <div className="size-fields">
        <label>
          Largura
          <input value={width} inputMode="numeric" onChange={(event) => setWidth(event.target.value)} onBlur={() => onUpdate({ width: Math.max(140, Math.min(900, Number(width) || node.width)) })} />
        </label>
        <label>
          Altura
          <input value={height} inputMode="numeric" onChange={(event) => setHeight(event.target.value)} onBlur={() => onUpdate({ height: Math.max(76, Math.min(700, Number(height) || node.height)) })} />
        </label>
      </div>
      {node.sourceNodeId && (
        <label>
          Nota desta aparição
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={() => notes !== node.instanceNotes && onUpdate({ instanceNotes: notes })} />
        </label>
      )}
      <label className="important-toggle">
        <input type="checkbox" checked={node.important} onChange={(event) => onUpdate({ important: event.target.checked })} />
        Mostrar este nó quando o mapa estiver distante
      </label>
      <div className="inspector-tip">Duplo clique na caixa para editar o título rapidamente.</div>
    </aside>
  );
}
