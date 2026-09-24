import { useMemo, useState } from "react";
import { kindConfig } from "../domain/entityKindRegistry";
import type { Entity } from "../domain/types";

interface CommandPaletteProps {
  entities: Entity[];
  onClose: () => void;
  onChoose: (entity: Entity) => void;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CommandPalette({ entities, onClose, onChoose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = normalize(query.trim());
    const scored = entities.map((entity) => {
      const haystack = normalize(`${entity.title} ${entity.summary} ${entity.tags.join(" ")}`);
      const titleMatch = normalize(entity.title).includes(q);
      const match = !q || haystack.includes(q);
      return { entity, match, rank: titleMatch ? 0 : 1 };
    });
    return scored
      .filter((item) => item.match)
      .sort((a, b) => a.rank - b.rank || a.entity.title.localeCompare(b.entity.title))
      .slice(0, 60)
      .map((item) => item.entity);
  }, [entities, query]);

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
            if (event.key === "Enter" && results[0]) onChoose(results[0]);
          }}
        />
        <ul className="search-results">
          {results.map((entity) => (
            <li key={entity.id}>
              <button type="button" onClick={() => onChoose(entity)}>
                <span className="search-icon">{entity.icon ?? kindConfig(entity.kind).icon}</span>
                <span className="search-title">{entity.title || "Sem título"}</span>
                <span className="search-kind">{kindConfig(entity.kind).label}</span>
              </button>
            </li>
          ))}
          {!results.length && <li className="search-empty">Nada encontrado.</li>}
        </ul>
      </div>
    </div>
  );
}
