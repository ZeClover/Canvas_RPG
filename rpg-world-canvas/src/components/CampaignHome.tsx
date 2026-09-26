import { useRef, useState } from "react";
import type { BackupInfo } from "../data/repository";
import { defaultCalendarConfig } from "../domain/calendarFields";
import { createId } from "../domain/id";
import { defaultEnabledModules } from "../domain/modules";
import type { Campaign, UniverseLink } from "../domain/types";
import { Icons } from "./Icons";
import { MultiverseLinksPanel } from "./panels/MultiverseLinksPanel";

interface CampaignHomeProps {
  campaigns: Campaign[];
  onOpen: (campaign: Campaign) => void;
  onCreate: (campaign: Campaign) => void;
  onImport: (file?: File) => Promise<void>;
  backups: BackupInfo[];
  onRestore: (backup: BackupInfo) => Promise<void>;
  universeLinks: UniverseLink[];
  onCreateUniverseLink: (link: UniverseLink) => void;
  onDeleteUniverseLink: (id: string) => void;
  externalError?: string;
}

const CAMPAIGN_COLORS = ["#a78bfa", "#38bdf8", "#34d399", "#fb923c", "#f43f5e", "#facc15"];

export function CampaignHome({ campaigns, onOpen, onCreate, onImport, backups, onRestore, universeLinks, onCreateUniverseLink, onDeleteUniverseLink, externalError = "" }: CampaignHomeProps) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [multiverseOpen, setMultiverseOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function importCampaign(file?: File) {
    setBusy(true);
    setError("");
    try {
      await onImport(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível importar a campanha.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function restoreCampaign(backup: BackupInfo) {
    if (!window.confirm(`Restaurar o backup de "${backup.title}"? A campanha atual com o mesmo ID será substituída.`)) return;
    setBusy(true);
    setError("");
    try {
      await onRestore(backup);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível restaurar o backup.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    onCreate({
      id: createId("campaign"),
      title: cleanTitle,
      description: "Novo universo",
      color: CAMPAIGN_COLORS[campaigns.length % CAMPAIGN_COLORS.length],
      icon: "🌐",
      enabledModules: defaultEnabledModules(),
      favoriteEntityIds: [],
      favoriteViewIds: [],
      calendar: defaultCalendarConfig(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setTitle("");
    setCreating(false);
  }

  return (
    <main className="project-home">
      <div className="home-aurora home-aurora-one" />
      <div className="home-aurora home-aurora-two" />
      <header className="home-header">
        <div className="brand-mark"><Icons.world /></div>
        <div>
          <span className="eyebrow">RPG WORLD CANVAS</span>
          <h1>Seus universos, vivos num único mapa.</h1>
          <p>NPCs, quests, segredos, facções e sessões — tudo o mesmo dado, visto de formas diferentes.</p>
        </div>
      </header>

      <section className="projects-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SEUS RPGs</span>
            <h2>Campanhas</h2>
          </div>
          <div className="section-actions">
            <input
              ref={fileRef}
              className="hidden-input"
              type="file"
              accept=".rpgworld,.json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCampaign(file);
              }}
            />
            {backups.length > 0 && <button className="ghost-button" disabled={busy} onClick={() => setBackupsOpen(true)}><Icons.shield /> Backups</button>}
            <button className="ghost-button" disabled={busy} onClick={() => setMultiverseOpen(true)}><Icons.link /> Multiverso</button>
            <button className="ghost-button" disabled={busy} onClick={() => fileRef.current?.click()}><Icons.upload /> {busy ? "Processando…" : "Importar"}</button>
            <button className="primary-button" onClick={() => setCreating(true)}><Icons.plus /> Nova campanha</button>
          </div>
        </div>

        {(error || externalError) && <div className="home-error" role="alert">{error || externalError}</div>}

        <div className="project-grid">
          {campaigns.map((campaign) => (
            <button key={campaign.id} className="project-card" onClick={() => onOpen(campaign)} style={{ "--project-color": campaign.color } as React.CSSProperties}>
              <div className="project-preview">
                <span className="preview-region region-a" />
                <span className="preview-region region-b" />
                <span className="preview-node node-a" />
                <span className="preview-line" />
                <span className="preview-node node-b" />
                <strong>{campaign.icon ?? "🌐"}</strong>
              </div>
              <div className="project-card-copy">
                <span className="project-dot" />
                <div>
                  <h3>{campaign.title}</h3>
                  <p>{campaign.description}</p>
                </div>
                <span className="open-arrow">↗</span>
              </div>
            </button>
          ))}
          <button className="project-card project-card-new" onClick={() => setCreating(true)}>
            <span className="new-project-icon"><Icons.plus /></span>
            <strong>Criar outro universo</strong>
            <small>Comece com um canvas vazio</small>
          </button>
        </div>
      </section>

      {creating && (
        <div className="dialog-backdrop" onMouseDown={() => setCreating(false)}>
          <form className="new-project-dialog" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="icon-button dialog-close" title="Fechar" aria-label="Fechar" onClick={() => setCreating(false)}><Icons.close /></button>
            <span className="eyebrow">NOVA CAMPANHA</span>
            <h2>Como ela vai se chamar?</h2>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Darkrem" />
            <button className="primary-button" type="submit" disabled={!title.trim()}>Criar campanha</button>
          </form>
        </div>
      )}

      {backupsOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setBackupsOpen(false)}>
          <section className="backup-dialog" onMouseDown={(event) => event.stopPropagation()} aria-label="Recuperar backup">
            <button type="button" className="icon-button dialog-close" title="Fechar backups" aria-label="Fechar backups" onClick={() => setBackupsOpen(false)}><Icons.close /></button>
            <span className="eyebrow">RECUPERAÇÃO</span>
            <h2>Backups disponíveis</h2>
            <p>O mais recente é atualizado automaticamente. As cópias históricas são mantidas em rotação.</p>
            <div className="backup-list">
              {backups.map((backup) => (
                <article className="backup-row" key={backup.id}>
                  <span className="backup-icon"><Icons.shield /></span>
                  <div>
                    <strong>{backup.title}</strong>
                    <small>{backup.latest ? "Backup mais recente" : "Cópia histórica"} · {new Date(backup.createdAt).toLocaleString("pt-BR")}</small>
                    <small>{backup.entityCount} elementos</small>
                  </div>
                  <button className="ghost-button" disabled={busy} onClick={() => void restoreCampaign(backup)}>Restaurar</button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {multiverseOpen && (
        <MultiverseLinksPanel
          campaigns={campaigns}
          links={universeLinks}
          onClose={() => setMultiverseOpen(false)}
          onCreateLink={onCreateUniverseLink}
          onDeleteLink={onDeleteUniverseLink}
        />
      )}
    </main>
  );
}
