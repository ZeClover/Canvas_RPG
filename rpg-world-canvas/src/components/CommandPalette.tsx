import { useMemo, useState } from "react";
import { kindConfig } from "../domain/entityKindRegistry";
import { highlightSegments, searchEntities, type MatchField } from "../domain/search";
import type { Entity } from "../domain/types";

interface CommandPaletteProps {
  entities: Entity[];
  onClose: () => void;
  onChoose: (entity: Entity) => void;
}

const FIELD_LABEL: Record<MatchField, string> = { title: "", tag: "por etiqueta", summary: "por resumo", kind: "por tipo" };

function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = highlightSegments(text, query);
  return <>{segments.map((segment, index) => segment.matched ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>)}</>;
}

export function CommandPalette({ entities, onClose, onChoose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchEntities(entities, query), [entities, query]);

  return (
    <div className="dialog-backdrop search-backdrop" onMouseDown={onClose}>
      <div className="search-palette" onMouseDown={(event) => event.stopPropagation()}>
        <input
          autoFocus
          className="search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar NPCs, quests, locais, segredos…"
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Enter" && results[0]) onChoose(results[0].entity);
          }}
        />
        <ul className="search-results">
          {results.map(({ entity, field }) => (
            <li key={entity.id}>
              <button type="button" onClick={() => onChoose(entity)}>
                <span className="search-icon">{entity.icon ?? kindConfig(entity.kind).icon}</span>
                <span className="search-title">
                  <HighlightedText text={entity.title || "Sem título"} query={field === "title" ? query : ""} />
                </span>
                <span className="search-kind">{kindConfig(entity.kind).label}{field !== "title" && FIELD_LABEL[field] ? ` · ${FIELD_LABEL[field]}` : ""}</span>
              </button>
            </li>
          ))}
          {!results.length && <li className="search-empty">Nada encontrado.</li>}
        </ul>
      </div>
    </div>
  );
}
