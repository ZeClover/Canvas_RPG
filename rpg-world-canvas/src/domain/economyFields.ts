// Economy Engine data — scoped to kind "item". A price table the GM fills
// in by hand; nothing here simulates supply/demand or invents a value.

export const ECONOMY_RARITIES = ["Comum", "Incomum", "Raro", "Muito raro", "Lendário", "Único"] as const;
export type EconomyRarity = typeof ECONOMY_RARITIES[number];

export interface EconomyFields {
  price: number;
  currency: string;
  rarity: EconomyRarity;
  tradeNotes: string;
}

export function defaultEconomyFields(): EconomyFields {
  return { price: 0, currency: "po", rarity: "Comum", tradeNotes: "" };
}

export function readEconomyFields(fields: Record<string, unknown>): EconomyFields {
  const defaults = defaultEconomyFields();
  const source = fields as Partial<EconomyFields>;
  return {
    price: typeof source.price === "number" && Number.isFinite(source.price) ? source.price : defaults.price,
    currency: typeof source.currency === "string" ? source.currency : defaults.currency,
    rarity: typeof source.rarity === "string" && (ECONOMY_RARITIES as readonly string[]).includes(source.rarity) ? source.rarity as EconomyRarity : defaults.rarity,
    tradeNotes: typeof source.tradeNotes === "string" ? source.tradeNotes : defaults.tradeNotes,
  };
}
