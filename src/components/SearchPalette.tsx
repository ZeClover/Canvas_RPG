import { useEffect, useMemo, useRef, useState } from "react";
import { NODE_KIND_LABELS, type CanvasNode, type NodeKind } from "../domain/types";
import { Icons } from "./Icons";

interface SearchPaletteProps {
  nodes: CanvasNode[];
  onChoose: (node: CanvasNode) => void;
  onClose: () => void;
}

export function SearchPalette({ nodes, onChoose, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<NodeKind | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return nodes.filter((node) => {
      if (kind !== "all" && node.kind !== kind) return false;
      return !normalized || `${node.title} ${node.body} ${node.kind} ${node.tags.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalized);
    }).slice(0, normalized ? 12 : 8);
  }, [kind, nodes, query]);

  useEffect(() => inputRef.current?.focus(), []);

  return (
    <div className="search-backdrop" onMouseDown={onClose}>
      <div className="search-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-input-wrap"><Icons.search /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Busque texto ou etiqueta…" onKeyDown={(event) => event.key === "Escape" && onClose()} /><kbd>ESC</kbd></div>
        <div className="search-filters">
          <select value={kind} onChange={(event) => setKind(event.target.value as NodeKind | "all")} aria-label="Filtrar por tipo">
            <option value="all">Todos os tipos</option>
            {Object.entries(NODE_KIND_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>
        <div className="search-results">
          <span className="search-caption">{query ? `${results.length} resultados` : "ACESSO RÁPIDO"}</span>
          {results.map((node) => (
            <button key={node.id} onClick={() => onChoose(node)}>
              <span className={`result-icon kind-${node.kind}`}>{node.title.slice(0, 1).toUpperCase()}</span>
              <span><strong>{node.title}</strong><small>{NODE_KIND_LABELS[node.kind]} · {node.tags.length ? node.tags.map((tag) => `#${tag}`).join(" ") : node.body || "Sem descrição"}</small></span>
              <em>Mostrar no mapa</em>
            </button>
          ))}
          {!results.length && <div className="empty-results">Nada encontrado neste universo.</div>}
        </div>
      </div>
    </div>
  );
}
