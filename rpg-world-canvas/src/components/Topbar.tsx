import type { Campaign, View } from "../domain/types";
import { APP_VERSION } from "../version";
import { Icons } from "./Icons";

interface TopbarProps {
  campaign: Campaign;
  saveLabel: string;
  zoom: number;
  views: View[];
  activeViewId: string;
  onSetView: (id: string) => void;
  onBack: () => void;
  onSearch: () => void;
  onFitAll: () => void;
  onSave: () => void;
  onExport: () => void;
}

export function Topbar({ campaign, saveLabel, zoom, views, activeViewId, onSetView, onBack, onSearch, onFitAll, onSave, onExport }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="icon-button" onClick={onBack} title="Voltar às campanhas"><Icons.back /></button>
        <div className="campaign-identity">
          <span className="campaign-color" style={{ background: campaign.color }} />
          <div><strong>{campaign.title}</strong><small>Canvas · v{APP_VERSION}</small></div>
        </div>
      </div>

      <div className="topbar-center">
        <select className="view-select" value={activeViewId} onChange={(event) => onSetView(event.target.value)} aria-label="View ativa">
          {views.map((view) => <option key={view.id} value={view.id}>{view.icon} {view.title}</option>)}
        </select>
        <button className="search-trigger" onClick={onSearch}><Icons.search /><span>Buscar em toda a campanha</span><kbd>Ctrl K</kbd></button>
      </div>

      <div className="topbar-actions">
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="ghost-button" onClick={onFitAll}><Icons.frame /> Ver tudo</button>
        <button className="ghost-button" onClick={onExport}><Icons.download /><span>Exportar</span></button>
        <button className="save-state" onClick={onSave}>{saveLabel}</button>
      </div>
    </header>
  );
}
