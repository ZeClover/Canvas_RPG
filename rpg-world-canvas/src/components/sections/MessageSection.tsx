import { MESSAGE_DELIVERY_STATUSES, MESSAGE_MEDIA, readMessageFields, type MessageFields } from "../../domain/messageFields";

interface MessageSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function MessageSection({ fields, onUpdate }: MessageSectionProps) {
  const message = readMessageFields(fields);

  function patch(partial: Partial<MessageFields>) {
    onUpdate({ ...message, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">COMUNICAÇÃO</span>
      <div className="compact-grid">
        <label className="compact-field">
          Meio
          <select value={message.medium} onChange={(e) => patch({ medium: e.target.value as MessageFields["medium"] })}>
            {MESSAGE_MEDIA.map((medium) => <option value={medium} key={medium}>{medium}</option>)}
          </select>
        </label>
        <label className="compact-field">
          Status da entrega
          <select value={message.deliveryStatus} onChange={(e) => patch({ deliveryStatus: e.target.value as MessageFields["deliveryStatus"] })}>
            {MESSAGE_DELIVERY_STATUSES.map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
        </label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Enviada em<input value={message.sentDate} placeholder="Ex.: dia seguinte à Sessão 03" onChange={(e) => patch({ sentDate: e.target.value })} /></label>
      </div>
      <label>Conteúdo<textarea value={message.content} onChange={(e) => patch({ content: e.target.value })} placeholder="O que a mensagem diz…" /></label>
      <div className="inspector-tip">Use as relações abaixo — "surgiu de" para quem enviou, "endereçada a" para quem deveria recebê-la.</div>
    </div>
  );
}
