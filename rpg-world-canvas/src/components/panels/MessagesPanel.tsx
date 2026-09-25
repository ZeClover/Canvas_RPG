import { useMemo } from "react";
import { kindConfig } from "../../domain/entityKindRegistry";
import { readMessageFields } from "../../domain/messageFields";
import type { Entity, Relation } from "../../domain/types";
import { Icons } from "../Icons";

interface MessagesPanelProps {
  entities: Entity[];
  relations: Relation[];
  onClose: () => void;
  onFocusEntity: (id: string) => void;
}

const AT_RISK_STATUSES = new Set(["Interceptada", "Perdida"]);

/** World Communication System: a global list over the same message
 * entities/relations the inspector edits — sender and recipient are read
 * straight from the relation graph (originated_from/addressed_to), never
 * duplicated here. */
export function MessagesPanel({ entities, relations, onClose, onFocusEntity }: MessagesPanelProps) {
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);

  const rows = useMemo(() => {
    const messages = entities.filter((entity) => entity.kind === "message");
    return messages
      .map((message) => {
        const fields = readMessageFields(message.fields);
        const sender = relations.find((relation) => relation.fromEntityId === message.id && relation.type === "originated_from");
        const recipient = relations.find((relation) => relation.fromEntityId === message.id && relation.type === "addressed_to");
        return {
          message,
          fields,
          sender: sender ? entityById.get(sender.toEntityId) ?? null : null,
          recipient: recipient ? entityById.get(recipient.toEntityId) ?? null : null,
        };
      })
      .sort((a, b) => {
        const riskA = AT_RISK_STATUSES.has(a.fields.deliveryStatus) ? 0 : 1;
        const riskB = AT_RISK_STATUSES.has(b.fields.deliveryStatus) ? 0 : 1;
        return riskA - riskB || a.message.title.localeCompare(b.message.title);
      });
  }, [entities, relations, entityById]);

  const atRiskCount = rows.filter((row) => AT_RISK_STATUSES.has(row.fields.deliveryStatus)).length;

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Comunicações do mundo">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">WORLD COMMUNICATION</span><h2>Cartas &amp; mensageiros</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>

        <span className="eyebrow">MENSAGENS ({rows.length}{atRiskCount ? ` · ${atRiskCount} em risco` : ""})</span>
        <ul className="entity-list message-list">
          {rows.map(({ message, fields, sender, recipient }) => {
            const atRisk = AT_RISK_STATUSES.has(fields.deliveryStatus);
            return (
              <li key={message.id}>
                <button type="button" className={`entity-row${atRisk ? " is-critical" : ""}`} onClick={() => { onFocusEntity(message.id); onClose(); }}>
                  <span className="entity-row-icon">{message.icon ?? kindConfig("message").icon}</span>
                  <span className="entity-row-body">
                    <span className="entity-row-title">{message.title || "Sem título"}</span>
                    <span className="entity-row-meta">
                      {sender ? sender.title : "remetente desconhecido"} → {recipient ? recipient.title : "destinatário desconhecido"} · {fields.medium} · {fields.deliveryStatus}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {!rows.length && <li className="tool-panel-empty">Nenhuma mensagem criada ainda. Use "surgiu de" para o remetente e "endereçada a" para o destinatário.</li>}
        </ul>
      </section>
    </div>
  );
}
