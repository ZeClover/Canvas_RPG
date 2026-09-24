import type { Project } from "../domain/types";
import { APP_VERSION } from "../version";
import { Icons } from "./Icons";

interface TopbarProps {
  project: Project;
  sessionMode: boolean;
  saveLabel: string;
  zoom: number;
  onBack: () => void;
  onSearch: () => void;
  onFitAll: () => void;
  onToggleSession: () => void;
  onSave: () => void;
  onExport: () => void;
  onHelp: () => void;
  exporting: boolean;
}

export function Topbar({ project, sessionMode, saveLabel, zoom, onBack, onSearch, onFitAll, onToggleSession, onSave, onExport, onHelp, exporting }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button" onClick={onBack} title="Voltar aos projetos"><Icons.back /></button>
        <div className="project-identity">
          <span className="project-color" style={{ background: project.color }} />
          <div><strong>{project.title}</strong><small>Canvas principal · v{APP_VERSION}</small></div>
        </div>
      </div>

      <div className="topbar-center">
        <button className="search-trigger" onClick={onSearch}><Icons.search /><span>Buscar em todo o RPG</span><kbd>Ctrl K</kbd></button>
      </div>

      <div className="topbar-actions">
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="ghost-button" onClick={onFitAll}><Icons.frame /> Ver tudo</button>
        <button className="ghost-button" onClick={onExport} disabled={exporting}><Icons.download /><span>{exporting ? "Exportando…" : "Exportar"}</span></button>
        <button className="icon-button" onClick={onHelp} title="Ajuda e diagnóstico"><Icons.shield /></button>
        <button className={sessionMode ? "session-button is-active" : "session-button"} onClick={onToggleSession}>
          {sessionMode ? <><span className="live-dot" /> Sessão ativa</> : <><Icons.play /> Iniciar sessão</>}
        </button>
        <button className="save-state" onClick={onSave}>{saveLabel}</button>
      </div>
    </header>
  );
}
