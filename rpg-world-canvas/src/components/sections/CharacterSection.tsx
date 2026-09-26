import { useState } from "react";
import { defaultAttribute, readCharacterFields, type AttributeEntry, type CharacterFields } from "../../domain/characterFields";
import { Icons } from "../Icons";
import { ListEditor } from "./ListEditor";

interface CharacterSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function CharacterSection({ fields, onUpdate }: CharacterSectionProps) {
  const character = readCharacterFields(fields);
  const [attrLabel, setAttrLabel] = useState("");
  const [attrValue, setAttrValue] = useState("");

  function patch(partial: Partial<CharacterFields>) {
    onUpdate({ ...fields, ...partial });
  }

  function patchAttribute(id: string, partial: Partial<AttributeEntry>) {
    patch({ attributes: character.attributes.map((a) => (a.id === id ? { ...a, ...partial } : a)) });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">FICHA DE PERSONAGEM</span>

      <div className="compact-grid">
        <label className="compact-field">PV<input type="number" value={character.hp} onChange={(e) => patch({ hp: Number(e.target.value) || 0 })} /></label>
        <label className="compact-field">PV máx.<input type="number" value={character.maxHp} onChange={(e) => patch({ maxHp: Number(e.target.value) || 0 })} /></label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Nível / patente<input value={character.level} placeholder="Ex.: 5, Novato, Rank C…" onChange={(e) => patch({ level: e.target.value })} /></label>
      </div>

      <ListEditor label="Condições" value={character.conditions} placeholder="envenenado, exausto" onChange={(next) => patch({ conditions: next })} />

      <span className="eyebrow">ATRIBUTOS ({character.attributes.length})</span>
      <ul className="mini-list character-attribute-list">
        {character.attributes.map((attribute) => (
          <li key={attribute.id}>
            <input className="character-attribute-label" value={attribute.label} onChange={(e) => patchAttribute(attribute.id, { label: e.target.value })} placeholder="Ex.: Força" />
            <input className="character-attribute-value" value={attribute.value} onChange={(e) => patchAttribute(attribute.id, { value: e.target.value })} placeholder="Ex.: 16" />
            <button type="button" className="icon-button" title="Remover atributo" aria-label="Remover atributo" onClick={() => patch({ attributes: character.attributes.filter((a) => a.id !== attribute.id) })}><Icons.close /></button>
          </li>
        ))}
        {!character.attributes.length && <li className="mini-list-empty">Nenhum atributo ainda — qualquer sistema serve, é só nome + valor.</li>}
      </ul>
      <div className="inline-form">
        <input value={attrLabel} onChange={(e) => setAttrLabel(e.target.value)} placeholder="Atributo (ex.: Vigor)" />
        <input value={attrValue} onChange={(e) => setAttrValue(e.target.value)} placeholder="Valor (ex.: d8)" />
        <button
          type="button"
          disabled={!attrLabel.trim()}
          onClick={() => {
            patch({ attributes: [...character.attributes, defaultAttribute(attrLabel.trim(), attrValue.trim())] });
            setAttrLabel("");
            setAttrValue("");
          }}
        ><Icons.plus /> Adicionar</button>
      </div>

      <label>Notas<textarea value={character.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Histórico, motivação, o que mais importa lembrar…" /></label>
      <div className="inspector-tip">Inventário fica nas relações abaixo — conecte a itens usando o tipo "carrega".</div>
    </div>
  );
}
