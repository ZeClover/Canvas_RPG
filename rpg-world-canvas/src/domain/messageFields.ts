// World Communication System data — a letter/messenger/spell traveling
// between two entities. Who sent it and who it's addressed to are the
// existing relation graph (originated_from = sender, addressed_to =
// recipient), never a parallel free-text sender/recipient field.

export const MESSAGE_MEDIA = ["Carta", "Mensageiro", "Magia", "Boato oral", "Outro"] as const;
export type MessageMedium = typeof MESSAGE_MEDIA[number];

export const MESSAGE_DELIVERY_STATUSES = ["Enviada", "Em trânsito", "Entregue", "Interceptada", "Perdida"] as const;
export type MessageDeliveryStatus = typeof MESSAGE_DELIVERY_STATUSES[number];

export interface MessageFields {
  medium: MessageMedium;
  deliveryStatus: MessageDeliveryStatus;
  content: string;
  sentDate: string;
}

export function defaultMessageFields(): MessageFields {
  return { medium: "Carta", deliveryStatus: "Enviada", content: "", sentDate: "" };
}

export function readMessageFields(fields: Record<string, unknown>): MessageFields {
  const defaults = defaultMessageFields();
  const source = fields as Partial<MessageFields>;
  return {
    medium: typeof source.medium === "string" && (MESSAGE_MEDIA as readonly string[]).includes(source.medium) ? source.medium as MessageMedium : defaults.medium,
    deliveryStatus: typeof source.deliveryStatus === "string" && (MESSAGE_DELIVERY_STATUSES as readonly string[]).includes(source.deliveryStatus) ? source.deliveryStatus as MessageDeliveryStatus : defaults.deliveryStatus,
    content: typeof source.content === "string" ? source.content : defaults.content,
    sentDate: typeof source.sentDate === "string" ? source.sentDate : defaults.sentDate,
  };
}
