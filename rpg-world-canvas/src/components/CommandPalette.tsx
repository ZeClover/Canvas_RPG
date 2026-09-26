import { useMemo, useState } from "react";
import { kindConfig } from "../domain/entityKindRegistry";
import { highlightSegments, searchEntities, sortFavoritesFirst, type MatchField } from "../domain/search";
import type { Entity } from "../domain/types";
import { Icons } from "./Icons";

interface CommandPaletteProps {
  entities: Entity[];
  favoriteEntityIds: string[];
  onClose: () => void;
  onChoose: (entity: Entity) => void;
}

const FIELD_LABEL: Record<MatchField, string> = { title: "", tag: "por etiqueta", summary: "por resumo", kind: "por tipo" };

function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = highlightSegments(text, query);
  return <>{segments.map((segment, index) => segment.matched ? <mark key={index}>{segment.text}</mark> : <span key={index}>{segment.text}</span>)}</>;
}

export function CommandPalette({ entities, favoriteEntityIds, onClose, onChoose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const matches = searchEntities(entities, query);
    if (query.trim()) return matches;
    const favoriteSet = new Set(favoriteEntityIds);
    return sortFavoritesFirst(matches, (match) => favoriteSet.has(match.entity.id));
  }, [entities, query, favoriteEntityIds]);
  const favoriteSet = useMemo(() => new Set(favoriteEntityIds), [favoriteEntityIds]);

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
                {favoriteSet.has(entity.id) && <Icons.starFilled className="search-favorite-mark" />}
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
