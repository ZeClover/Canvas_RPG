import { useEffect, useMemo, useState } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { relationConfig } from "../../domain/relationTypeRegistry";
import type { Entity, EntityKind, Relation } from "../../domain/types";
import { Icons } from "../Icons";

interface KnowledgeEnginePanelProps {
  entities: Entity[];
  relations: Relation[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

const KNOWLEDGE_KINDS: EntityKind[] = ["secret", "knowledge", "clue", "rumor"];

/** Knowledge Engine: no separate "who knows what" table — it's a read over
 * the same relations everyone else edits (knows_about, reveals, points_to,
 * originated_from...). Pick a secret/clue/rumor/knowledge on the left, see
 * everything connected to it on the right, deterministically. */
export function KnowledgeEnginePanel({ entities, relations, onClose, onFocusEntity }: KnowledgeEnginePanelProps) {
  const [search, setSearch] = useState("");
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const relationsByEntity = useMemo(() => {
    const map = new Map<string, Relation[]>();
    const add = (id: string, relation: Relation) => {
      const list = map.get(id);
      if (list) list.push(relation);
      else map.set(id, [relation]);
    };
    for (const relation of relations) {
      add(relation.fromEntityId, relation);
      add(relation.toEntityId, relation);
    }
    return map;
  }, [relations]);

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entities
      .filter((entity) => KNOWLEDGE_KINDS.includes(entity.kind))
      .filter((entity) => !query || entity.title.toLowerCase().includes(query) || entity.summary.toLowerCase().includes(query))
      .filter((entity) => !onlyUnknown || !(relationsByEntity.get(entity.id)?.length))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [entities, search, onlyUnknown, relationsByEntity]);

  useEffect(() => {
    if (selectedId && items.some((entity) => entity.id === selectedId)) return;
    setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const selected = selectedId ? entityById.get(selectedId) ?? null : null;
  const connections = selected ? relationsByEntity.get(selected.id) ?? [] : [];

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Motor de conhecimento">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">CONHECIMENTO</span><h2>Quem sabe o quê</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className="timeline-filters">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar segredo, pista, rumor, conhecimento…" />
          <label><input type="checkbox" checked={onlyUnknown} onChange={(event) => setOnlyUnknown(event.target.checked)} /> Sem nenhuma conexão</label>
        </div>

        <div className="knowledge-layout">
          <ul className="entity-list">
            {items.map((entity) => (
              <li key={entity.id}>
                <button type="button" className={`entity-row${selectedId === entity.id ? " is-active" : ""}`} onClick={() => setSelectedId(entity.id)}>
                  <span className="entity-row-icon">{entity.icon ?? kindConfig(entity.kind).icon}</span>
                  <span className="entity-row-body">
                    <span className="entity-row-title">{entity.title || "Sem título"}</span>
                    <span className="entity-row-meta">{kindConfig(entity.kind).label} · {relationsByEntity.get(entity.id)?.length ?? 0} conexão(ões)</span>
                  </span>
                </button>
              </li>
            ))}
            {!items.length && <li className="tool-panel-empty">Nada aqui ainda.</li>}
          </ul>

          <div className="knowledge-detail">
            {selected ? (
              <>
                <h3>{selected.title || "Sem título"}</h3>
                {selected.summary && <p className="knowledge-summary">{selected.summary}</p>}
                <span className="eyebrow">CONECTADO A ({connections.length})</span>
                <ul className="entity-list">
                  {connections.map((relation) => {
                    const otherId = relation.fromEntityId === selected.id ? relation.toEntityId : relation.fromEntityId;
                    const other = entityById.get(otherId);
                    if (!other) return null;
                    const direction = relation.fromEntityId === selected.id ? "→" : "←";
                    return (
                      <li key={relation.id}>
                        <button type="button" className="entity-row" onClick={() => { onFocusEntity(other.id); onClose(); }}>
                          <span className="entity-row-icon">{other.icon ?? kindConfig(other.kind).icon}</span>
                          <span className="entity-row-body">
                            <span className="entity-row-title">{other.title || "Sem título"}</span>
                            <span className="entity-row-meta" style={{ color: relationConfig(relation.type).color }}>{direction} {relation.label || relationConfig(relation.type).label}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {!connections.length && <li className="tool-panel-empty">Ninguém sabe disso ainda — ou a conexão não foi registrada.</li>}
                </ul>
              </>
            ) : <div className="tool-panel-empty">Escolha um item à esquerda.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}
