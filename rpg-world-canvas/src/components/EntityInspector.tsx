import { useEffect, useMemo, useState } from "react";
import { CARD_KINDS, kindConfig } from "../domain/entityKindRegistry";
import { relationConfig } from "../domain/relationTypeRegistry";
import { imageFileToDataUrl, normalizeExternalImageUrl } from "../data/imageProcessing";
import type { Entity, EntityKind, Relation, RelationType, Visibility } from "../domain/types";
import { RELATION_TYPES } from "../domain/types";
import { ColorPicker } from "./ColorPicker";
import { Icons } from "./Icons";
import { NpcSection } from "./sections/NpcSection";
import { QuestSection } from "./sections/QuestSection";
import { SessionSection } from "./sections/SessionSection";

interface EntityInspectorProps {
  entity: Entity;
  allEntities: Entity[];
  relations: Relation[];
  onUpdate: (updates: Partial<Entity>) => void;
  onClose: () => void;
  onFocusEntity: (id: string) => void;
  onCreateRelation: (toEntityId: string, type: RelationType) => void;
  onDeleteRelation: (id: string) => void;
}

const VISIBILITY_LABEL: Record<Visibility, string> = { gm_only: "Só o mestre", revealed: "Revelado aos jogadores", partial: "Parcialmente revelado" };

export function EntityInspector({ entity, allEntities, relations, onUpdate, onClose, onFocusEntity, onCreateRelation, onDeleteRelation }: EntityInspectorProps) {
  const [tags, setTags] = useState(entity.tags.join(", "));
  const [summary, setSummary] = useState(entity.summary);
  const [status, setStatus] = useState(entity.status ?? "");
  const [imageUrl, setImageUrl] = useState(entity.imageSrc?.startsWith("http") ? entity.imageSrc : "");
  const [imageError, setImageError] = useState("");
  const [connectTarget, setConnectTarget] = useState("");
  const [connectType, setConnectType] = useState<RelationType>("knows");

  useEffect(() => {
    setTags(entity.tags.join(", "));
    setSummary(entity.summary);
    setStatus(entity.status ?? "");
    setImageUrl(entity.imageSrc?.startsWith("http") ? entity.imageSrc : "");
    setImageError("");
  }, [entity.id, entity.tags, entity.summary, entity.status, entity.imageSrc]);

  const config = kindConfig(entity.kind);
  const otherEntities = useMemo(
    () => allEntities.filter((candidate) => candidate.id !== entity.id).sort((a, b) => a.title.localeCompare(b.title)).slice(0, 500),
    [allEntities, entity.id],
  );
  const entityById = useMemo(() => new Map(allEntities.map((candidate) => [candidate.id, candidate])), [allEntities]);
  const isGroup = entity.kind === "group";

  return (
    <aside className="node-inspector" aria-label="Propriedades do elemento">
      <div className="inspector-heading">
        <div><span className="eyebrow">{config.icon} {config.label.toUpperCase()}</span><h3>{entity.title || "Sem título"}</h3></div>
        <button className="icon-button" type="button" aria-label="Fechar propriedades" onClick={onClose}><Icons.close /></button>
      </div>

      <label>
        Título
        <input
          value={entity.title}
          onChange={(event) => onUpdate({ title: event.target.value })}
          placeholder="Nome"
        />
      </label>

      {!isGroup && (
        <label>
          Tipo
          <select value={entity.kind} onChange={(event) => onUpdate({ kind: event.target.value as EntityKind })}>
            {CARD_KINDS.map((kind) => <option value={kind} key={kind}>{kindConfig(kind).icon} {kindConfig(kind).label}</option>)}
          </select>
        </label>
      )}

      <label>
        Cor
        <ColorPicker value={entity.color ?? config.color} onChange={(color) => onUpdate({ color })} />
      </label>

      <label>
        {isGroup ? "Descrição" : "Resumo"}
        <textarea value={summary} onChange={(event) => setSummary(event.target.value)} onBlur={() => summary !== entity.summary && onUpdate({ summary })} placeholder="Detalhes, contexto, lembretes…" />
      </label>

      {!isGroup && entity.kind !== "quest" && entity.kind !== "side_quest" && (
        <label>
          Status
          <input value={status} onChange={(event) => setStatus(event.target.value)} onBlur={() => onUpdate({ status: status.trim() || null })} placeholder="Ex.: Ativa, Concluída, Vivo…" />
        </label>
      )}

      {!isGroup && (
        <>
          <label>
            Etiquetas
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              onBlur={() => onUpdate({ tags: [...new Set(tags.split(",").map((tag) => tag.trim().toLocaleLowerCase("pt-BR")).filter(Boolean))].slice(0, 20) })}
              placeholder="vilão, floresta, pista"
            />
          </label>

          <label>
            Visibilidade para jogadores
            <select value={entity.visibility} onChange={(event) => onUpdate({ visibility: event.target.value as Visibility })}>
              {Object.entries(VISIBILITY_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
          </label>

          <div className="image-field">
            <span>Imagem</span>
            {entity.imageSrc ? <img src={entity.imageSrc} alt="Prévia" /> : <div className="image-placeholder">Sem imagem</div>}
            <div>
              <label className="image-picker">
                Escolher imagem
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void imageFileToDataUrl(file).then((imageSrc) => onUpdate({ imageSrc }));
                  }}
                />
              </label>
              {entity.imageSrc && <button type="button" onClick={() => onUpdate({ imageSrc: null })}>Remover</button>}
            </div>
            <div className="image-url-field">
              <input
                type="url"
                value={imageUrl}
                placeholder="Ou cole um link https://…"
                onChange={(event) => { setImageUrl(event.target.value); setImageError(""); }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const url = normalizeExternalImageUrl(imageUrl);
                  if (url) { onUpdate({ imageSrc: url }); setImageError(""); } else setImageError("Link inválido");
                }}
              />
              <button type="button" onClick={() => {
                const url = normalizeExternalImageUrl(imageUrl);
                if (url) { onUpdate({ imageSrc: url }); setImageError(""); } else setImageError("Link inválido");
              }}>Usar link</button>
            </div>
            {imageError && <small className="image-error">{imageError}</small>}
          </div>

          <label className="important-toggle">
            <input type="checkbox" checked={entity.important} onChange={(event) => onUpdate({ important: event.target.checked })} />
            Mostrar este elemento quando o mapa estiver distante
          </label>
        </>
      )}

      {entity.kind === "npc" && <NpcSection fields={entity.fields} onUpdate={(fields) => onUpdate({ fields })} />}
      {(entity.kind === "quest" || entity.kind === "side_quest") && (
        <QuestSection status={entity.status} fields={entity.fields} onUpdateStatus={(value) => onUpdate({ status: value })} onUpdate={(fields) => onUpdate({ fields })} />
      )}
      {entity.kind === "session" && <SessionSection fields={entity.fields} onUpdate={(fields) => onUpdate({ fields })} />}

      <div className="size-fields">
        <label>Largura<input value={Math.round(entity.width)} inputMode="numeric" onChange={(event) => onUpdate({ width: Math.max(80, Number(event.target.value) || entity.width) })} /></label>
        <label>Altura<input value={Math.round(entity.height)} inputMode="numeric" onChange={(event) => onUpdate({ height: Math.max(60, Number(event.target.value) || entity.height) })} /></label>
      </div>

      {!isGroup && (
        <div className="relations-section">
          <span className="eyebrow">RELAÇÕES ({relations.length})</span>
          <ul className="relations-list">
            {relations.map((relation) => {
              const otherId = relation.fromEntityId === entity.id ? relation.toEntityId : relation.fromEntityId;
              const other = entityById.get(otherId);
              const direction = relation.fromEntityId === entity.id ? "→" : "←";
              const cfg = relationConfig(relation.type);
              return (
                <li key={relation.id}>
                  <button type="button" className="relation-row" onClick={() => other && onFocusEntity(other.id)}>
                    <span className="relation-type" style={{ color: cfg.color }}>{direction} {relation.label || cfg.label}</span>
                    <span className="relation-target">{other ? `${kindConfig(other.kind).icon} ${other.title}` : "(removido)"}</span>
                  </button>
                  <button type="button" className="icon-button" aria-label="Remover relação" onClick={() => onDeleteRelation(relation.id)}><Icons.close /></button>
                </li>
              );
            })}
            {!relations.length && <li className="relations-empty">Nenhuma relação ainda. Puxe o ponto lateral no canvas até outro elemento.</li>}
          </ul>
          <div className="connect-form">
            <select value={connectTarget} onChange={(event) => setConnectTarget(event.target.value)}>
              <option value="">Conectar a…</option>
              {otherEntities.map((candidate) => <option value={candidate.id} key={candidate.id}>{kindConfig(candidate.kind).icon} {candidate.title}</option>)}
            </select>
            <select value={connectType} onChange={(event) => setConnectType(event.target.value as RelationType)}>
              {RELATION_TYPES.map((type) => <option value={type} key={type}>{relationConfig(type).label}</option>)}
            </select>
            <button type="button" disabled={!connectTarget} onClick={() => { if (connectTarget) { onCreateRelation(connectTarget, connectType); setConnectTarget(""); } }}>
              <Icons.link /> Conectar
            </button>
          </div>
        </div>
      )}

      <div className="inspector-tip">Duplo clique na caixa para editar rapidamente. Arraste o ponto lateral para conectar.</div>
    </aside>
  );
}
