import { useEffect, useRef, useState, type FC, type SVGProps } from "react";
import type { Campaign, View } from "../domain/types";
import { APP_VERSION } from "../version";
import { Icons } from "./Icons";

export interface ToolMenuItem {
  key: string;
  label: string;
  icon: FC<SVGProps<SVGSVGElement>>;
  onClick: () => void;
}

interface TopbarProps {
  campaign: Campaign;
  saveLabel: string;
  zoom: number;
  views: View[];
  activeViewId: string;
  tools: ToolMenuItem[];
  onSetView: (id: string) => void;
  onBack: () => void;
  onSearch: () => void;
  onFitAll: () => void;
  onSave: () => void;
  onExport: () => void;
}

/** Every global read-only/automation tool (Timeline, Knowledge, Mystery,
 * Causality, Rules, Settlements, Economy...) lives behind one
 * "Ferramentas" button instead of its own topbar slot — each phase adds
 * more of these, and a flat row of buttons would eventually overflow the
 * topbar at normal window widths. */
function ToolsMenu({ items }: { items: ToolMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="tools-menu-wrap" ref={ref}>
      <button type="button" className="ghost-button" onClick={() => setOpen((value) => !value)}>
        <Icons.tools /><span>Ferramentas</span><Icons.chevronDown />
      </button>
      {open && (
        <div className="tools-menu">
          {items.map(({ key, label, icon: Icon, onClick }) => (
            <button type="button" key={key} onClick={() => { onClick(); setOpen(false); }}>
              <Icon /> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Topbar({ campaign, saveLabel, zoom, views, activeViewId, tools, onSetView, onBack, onSearch, onFitAll, onSave, onExport }: TopbarProps) {
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
        <ToolsMenu items={tools} />
        <button className="ghost-button" onClick={onExport}><Icons.download /><span>Exportar</span></button>
        <button className="save-state" onClick={onSave}>{saveLabel}</button>
      </div>
    </header>
  );
}
