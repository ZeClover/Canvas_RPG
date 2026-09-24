import { useMemo } from "react";
import { readEconomyFields } from "../../domain/economyFields";
import { isResourceCritical, readResourceFields } from "../../domain/resourceFields";
import type { Entity } from "../../domain/types";
import { Icons } from "../Icons";

interface EconomyResourcesPanelProps {
  entities: Entity[];
  /** Each column is its own module (economy_engine / resource_engine) — a
   * campaign can want price tracking without survival mechanics, or the
   * other way around. The panel itself is only reachable when at least
   * one of the two is on. */
  showItems: boolean;
  showResources: boolean;
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

/** Economy Engine + Resource & Survival Engine in one dialog — both are
 * the same shape of tool (a sortable table over a plain number the GM
 * filled in), so they share the panel instead of doubling the Ferramentas
 * menu. Nothing here is simulated: prices and stock only change when
 * someone edits the item/resource card. */
export function EconomyResourcesPanel({ entities, showItems, showResources, onClose, onFocusEntity }: EconomyResourcesPanelProps) {
  const items = useMemo(
    () => entities
      .filter((entity) => entity.kind === "item")
      .map((entity) => ({ entity, economy: readEconomyFields(entity.fields) }))
      .sort((a, b) => b.economy.price - a.economy.price),
    [entities],
  );

  const resources = useMemo(
    () => entities
      .filter((entity) => entity.kind === "resource")
      .map((entity) => ({ entity, resource: readResourceFields(entity.fields) }))
      .sort((a, b) => {
        const criticalA = isResourceCritical(a.resource) ? 0 : 1;
        const criticalB = isResourceCritical(b.resource) ? 0 : 1;
        return criticalA - criticalB || a.resource.stock - b.resource.stock;
      }),
    [entities],
  );

  const averagePrice = items.length ? Math.round(items.reduce((sum, row) => sum + row.economy.price, 0) / items.length) : 0;
  const criticalCount = resources.filter((row) => isResourceCritical(row.resource)).length;

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Economia e recursos">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">ECONOMIA &amp; RECURSOS</span><h2>Preços e estoque</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <div className={`tool-panel-columns${showItems && showResources ? "" : " is-single-column"}`}>
          {showItems && (
            <div className="tool-panel-section">
              <span className="eyebrow">ITENS ({items.length}{items.length ? ` · preço médio ${averagePrice}` : ""})</span>
              <ul className="entity-list">
                {items.map(({ entity, economy }) => (
                  <li key={entity.id}>
                    <button type="button" className="entity-row" onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                      <span className="entity-row-icon">{entity.icon ?? "🎒"}</span>
                      <span className="entity-row-body">
                        <span className="entity-row-title">{entity.title || "Sem título"}</span>
                        <span className="entity-row-meta">{economy.rarity} · {economy.price} {economy.currency}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {!items.length && <li className="tool-panel-empty">Nenhum item com preço cadastrado.</li>}
              </ul>
            </div>
          )}

          {showResources && (
            <div className="tool-panel-section">
              <span className="eyebrow">RECURSOS ({resources.length}{criticalCount ? ` · ${criticalCount} crítico(s)` : ""})</span>
              <ul className="entity-list">
                {resources.map(({ entity, resource }) => {
                  const critical = isResourceCritical(resource);
                  return (
                    <li key={entity.id}>
                      <button type="button" className={`entity-row${critical ? " is-critical" : ""}`} onClick={() => { onFocusEntity(entity.id); onClose(); }}>
                        <span className="entity-row-icon">{entity.icon ?? "📦"}</span>
                        <span className="entity-row-body">
                          <span className="entity-row-title">{entity.title || "Sem título"}</span>
                          <span className="entity-row-meta">{resource.stock} {resource.unit}{critical ? " · CRÍTICO" : ""}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {!resources.length && <li className="tool-panel-empty">Nenhum recurso cadastrado ainda.</li>}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
