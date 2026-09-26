import { useMemo, useState } from "react";
import { createId } from "../../domain/id";
import type { Campaign, UniverseLink } from "../../domain/types";
import { useEscapeToClose } from "../../hooks/useEscapeToClose";
import { Icons } from "../Icons";

interface MultiverseLinksPanelProps {
  campaigns: Campaign[];
  links: UniverseLink[];
  onClose: () => void;
  onCreateLink: (link: UniverseLink) => void;
  onDeleteLink: (id: string) => void;
}

/** Multiverse Engine (Fase 7): a home-level, always-on tool — it lives above
 * any single campaign, so it is never gated by a campaign's module toggles.
 * A link is just a note that two universes touch somehow (a crossover, a
 * shared cosmology, a "these are the same world at different eras"); it
 * never merges data between campaigns or creates cross-campaign entities. */
export function MultiverseLinksPanel({ campaigns, links, onClose, onCreateLink, onDeleteLink }: MultiverseLinksPanelProps) {
  useEscapeToClose(onClose);
  const campaignById = useMemo(() => new Map(campaigns.map((campaign) => [campaign.id, campaign])), [campaigns]);
  const [fromId, setFromId] = useState(campaigns[0]?.id ?? "");
  const [toId, setToId] = useState(campaigns[1]?.id ?? campaigns[0]?.id ?? "");
  const [description, setDescription] = useState("");

  const canCreate = campaigns.length >= 2 && fromId && toId && fromId !== toId;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    onCreateLink({
      id: createId("universelink"),
      fromCampaignId: fromId,
      toCampaignId: toId,
      description: description.trim(),
      createdAt: Date.now(),
    });
    setDescription("");
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="backup-dialog" onMouseDown={(event) => event.stopPropagation()} aria-label="Multiverso">
        <button type="button" className="icon-button dialog-close" title="Fechar multiverso" aria-label="Fechar multiverso" onClick={onClose}><Icons.close /></button>
        <span className="eyebrow">MULTIVERSE ENGINE</span>
        <h2>Ligações entre universos</h2>
        <p>Registre que duas campanhas se tocam de algum jeito — um crossover, uma cosmologia compartilhada, a mesma linha do tempo em eras diferentes. Isso é só uma anotação: nenhum dado é combinado entre as campanhas.</p>

        {campaigns.length < 2 ? (
          <p className="tool-panel-empty">Crie pelo menos duas campanhas para ligá-las.</p>
        ) : (
          <form className="multiverse-form" onSubmit={submit}>
            <div className="compact-grid">
              <label className="compact-field">
                De
                <select value={fromId} onChange={(event) => setFromId(event.target.value)}>
                  {campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.icon ?? "🌐"} {campaign.title}</option>)}
                </select>
              </label>
              <label className="compact-field">
                Para
                <select value={toId} onChange={(event) => setToId(event.target.value)}>
                  {campaigns.map((campaign) => <option value={campaign.id} key={campaign.id}>{campaign.icon ?? "🌐"} {campaign.title}</option>)}
                </select>
              </label>
            </div>
            <label>Como elas se ligam?
              <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: mesma cosmologia, séculos de diferença" />
            </label>
            <button className="primary-button" type="submit" disabled={!canCreate}>Criar ligação</button>
          </form>
        )}

        <div className="backup-list">
          {links.map((link) => {
            const from = campaignById.get(link.fromCampaignId);
            const to = campaignById.get(link.toCampaignId);
            return (
              <article className="backup-row" key={link.id}>
                <span className="backup-icon"><Icons.link /></span>
                <div>
                  <strong>{from?.title ?? "Campanha removida"} → {to?.title ?? "Campanha removida"}</strong>
                  {link.description && <small>{link.description}</small>}
                  <small>{new Date(link.createdAt).toLocaleString("pt-BR")}</small>
                </div>
                <button className="ghost-button" onClick={() => onDeleteLink(link.id)}>Remover</button>
              </article>
            );
          })}
          {!links.length && <p className="tool-panel-empty">Nenhuma ligação criada ainda.</p>}
        </div>
      </section>
    </div>
  );
}
