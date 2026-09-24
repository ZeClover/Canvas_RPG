// Rumor Engine templates — fixed Mad-Libs-style sentence skeletons the GM
// fills in by picking existing entities (or free text). This is the
// whole "template" mechanism: string interpolation over data the GM
// already has, never generated text. No AI touches this file.

import type { EntityKind } from "./types";

export type TemplateSegment =
  | { type: "text"; value: string }
  | { type: "slot"; key: string; label: string; kind: EntityKind | null };

export interface RumorTemplate {
  id: string;
  label: string;
  segments: TemplateSegment[];
}

function text(value: string): TemplateSegment {
  return { type: "text", value };
}
function slot(key: string, label: string, kind: EntityKind | null): TemplateSegment {
  return { type: "slot", key, label, kind };
}

export const RUMOR_TEMPLATES: RumorTemplate[] = [
  {
    id: "seen_doing",
    label: "Fulano foi visto fazendo algo estranho",
    segments: [
      text("Dizem que "), slot("npc", "quem", "npc"), text(" foi visto perto de "), slot("local", "onde", "location"),
      text(" fazendo algo que ninguém quer explicar."),
    ],
  },
  {
    id: "faction_hides_item",
    label: "Uma facção esconde um item",
    segments: [
      text("Um comerciante jura que "), slot("faccao", "facção", "faction"), text(" está escondendo "), slot("item", "o quê", "item"),
      text(" em algum lugar de "), slot("local", "onde", "location"), text("."),
    ],
  },
  {
    id: "creature_sighted",
    label: "Uma criatura foi avistada",
    segments: [
      text("Ouvi dizer que "), slot("criatura", "criatura", "creature"), text(" foi avistada nos arredores de "), slot("local", "onde", "location"), text("."),
    ],
  },
  {
    id: "npc_not_who_they_say",
    label: "Fulano não é quem diz ser",
    segments: [
      slot("npc1", "quem fala", "npc"), text(" anda dizendo por aí que "), slot("npc2", "sobre quem", "npc"), text(" não é quem diz ser."),
    ],
  },
  {
    id: "place_not_safe",
    label: "Um lugar não é mais seguro",
    segments: [
      text("Circula que "), slot("local", "onde", "location"), text(" não é mais seguro, por causa de "), slot("motivo", "por quê", null), text("."),
    ],
  },
  {
    id: "secret_pact",
    label: "Duas facções fizeram um pacto secreto",
    segments: [
      text("Alguns juram que "), slot("faccao1", "primeira facção", "faction"), text(" e "), slot("faccao2", "segunda facção", "faction"),
      text(" fizeram um acordo que ninguém deveria saber."),
    ],
  },
];

/** Pure string assembly — every slot resolved to either an entity's
 * title or free text the GM typed; unresolved slots render as "___" so
 * the preview always shows what's still missing. */
export function renderTemplate(template: RumorTemplate, values: Record<string, string>): string {
  return template.segments
    .map((segment) => (segment.type === "text" ? segment.value : values[segment.key]?.trim() || "___"))
    .join("");
}

export function templateIsComplete(template: RumorTemplate, values: Record<string, string>): boolean {
  return template.segments.every((segment) => segment.type === "text" || Boolean(values[segment.key]?.trim()));
}
