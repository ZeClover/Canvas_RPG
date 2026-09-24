import { useRef, useState } from "react";
import { isDesktopApp, type BackupInfo } from "../data/repository";
import { createId } from "../domain/id";
import type { Project } from "../domain/types";
import { Icons } from "./Icons";

interface ProjectHomeProps {
  projects: Project[];
  onOpen: (project: Project) => void;
  onCreate: (project: Project) => void;
  onImport: (file?: File) => Promise<void>;
  backups: BackupInfo[];
  onRestore: (backup: BackupInfo) => Promise<void>;
  externalError?: string;
}

export function ProjectHome({ projects, onOpen, onCreate, onImport, backups, onRestore, externalError = "" }: ProjectHomeProps) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [backupsOpen, setBackupsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function importProject(file?: File) {
    setBusy(true);
    setError("");
    try {
      await onImport(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível importar o projeto.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function restoreProject(backup: BackupInfo) {
    if (!window.confirm(`Restaurar o backup de “${backup.title}”? O projeto atual com o mesmo ID será substituído.`)) return;
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
      id: createId("project"),
      title: cleanTitle,
      description: "Novo universo visual",
      color: "#a78bfa",
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
        <div className="brand-mark"><Icons.spark /></div>
        <div>
          <span className="eyebrow">RPG CANVAS STUDIO</span>
          <h1>Seus mundos, do tamanho das suas ideias.</h1>
          <p>Escreva sessões como fluxogramas e conecte tudo em um único mapa visual.</p>
        </div>
      </header>

      <section className="projects-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CONTINUE CRIANDO</span>
            <h2>Projetos recentes</h2>
          </div>
          <div className="section-actions">
            <input
              ref={fileRef}
              className="hidden-input"
              type="file"
              accept=".rpgcanvas,.json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importProject(file);
              }}
            />
            {backups.length > 0 && <button className="ghost-button" disabled={busy} onClick={() => setBackupsOpen(true)}><Icons.shield /> Backups</button>}
            <button
              className="ghost-button"
              disabled={busy}
              onClick={() => isDesktopApp() ? void importProject() : fileRef.current?.click()}
            >
              <Icons.upload /> {busy ? "Processando…" : "Importar"}
            </button>
            <button className="primary-button" onClick={() => setCreating(true)}><Icons.plus /> Novo projeto</button>
          </div>
        </div>

        {(error || externalError) && <div className="home-error" role="alert">{error || externalError}</div>}

        <div className="project-grid">
          {projects.map((project, index) => (
            <button key={project.id} className="project-card" onClick={() => onOpen(project)} style={{ "--project-color": project.color } as React.CSSProperties}>
              <div className="project-preview">
                <span className="preview-region region-a" />
                <span className="preview-region region-b" />
                <span className="preview-node node-a" />
                <span className="preview-line" />
                <span className="preview-node node-b" />
                <strong>0{index + 1}</strong>
              </div>
              <div className="project-card-copy">
                <span className="project-dot" />
                <div>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>
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
            <button type="button" className="icon-button dialog-close" onClick={() => setCreating(false)}><Icons.close /></button>
            <span className="eyebrow">NOVO UNIVERSO</span>
            <h2>Como ele vai se chamar?</h2>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Darkrem" />
            <button className="primary-button" type="submit" disabled={!title.trim()}>Criar projeto</button>
          </form>
        </div>
      )}

      {backupsOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setBackupsOpen(false)}>
          <section className="backup-dialog" onMouseDown={(event) => event.stopPropagation()} aria-label="Recuperar backup">
            <button type="button" className="icon-button dialog-close" aria-label="Fechar backups" onClick={() => setBackupsOpen(false)}><Icons.close /></button>
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
                    <small>{backup.nodeCount} caixas · {backup.regionCount} regiões</small>
                  </div>
                  <button className="ghost-button" disabled={busy} onClick={() => void restoreProject(backup)}>Restaurar</button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
