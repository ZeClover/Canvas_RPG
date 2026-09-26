import { ECONOMY_RARITIES, readEconomyFields, type EconomyFields } from "../../domain/economyFields";

interface EconomySectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function EconomySection({ fields, onUpdate }: EconomySectionProps) {
  const economy = readEconomyFields(fields);

  function patch(partial: Partial<EconomyFields>) {
    onUpdate({ ...fields, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">ECONOMIA</span>
      <div className="compact-grid">
        <label className="compact-field">Preço<input type="number" min={0} value={economy.price} onChange={(e) => patch({ price: Number(e.target.value) })} /></label>
        <label className="compact-field">Moeda<input value={economy.currency} placeholder="Ex.: po, prata" onChange={(e) => patch({ currency: e.target.value })} /></label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>
          Raridade
          <select value={economy.rarity} onChange={(e) => patch({ rarity: e.target.value as EconomyFields["rarity"] })}>
            {ECONOMY_RARITIES.map((rarity) => <option value={rarity} key={rarity}>{rarity}</option>)}
          </select>
        </label>
      </div>
      <label>Notas de comércio<textarea value={economy.tradeNotes} onChange={(e) => patch({ tradeNotes: e.target.value })} placeholder="Onde se compra, quem vende, restrições…" /></label>
    </div>
  );
}
