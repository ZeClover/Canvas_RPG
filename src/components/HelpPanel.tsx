import { useMemo, useState } from "react";
import type { WorkspaceData } from "../domain/types";
import { diagnoseWorkspace } from "../domain/workspaceDiagnostics";
import { Icons } from "./Icons";

export function HelpPanel({ state, onClose }: { state: WorkspaceData; onClose: () => void }) {
  const [tab, setTab] = useState<"guide" | "health">("guide");
  const issues = useMemo(() => diagnoseWorkspace(state), [state]);
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return (
    <div className="dialog-backdrop help-backdrop" onMouseDown={onClose}>
      <section className="help-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Ajuda e diagnóstico">
        <header className="session-panel-heading"><div><span className="eyebrow">RPG CANVAS STUDIO 1.0</span><h2>Central de ajuda</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar"><Icons.close /></button></header>
        <div className="help-tabs"><button className={tab === "guide" ? "is-active" : ""} onClick={() => setTab("guide")}>Começar</button><button className={tab === "health" ? "is-active" : ""} onClick={() => setTab("health")}>Diagnóstico {issues.length ? `(${issues.length})` : "✓"}</button></div>
        {tab === "guide" ? (
          <div className="guide-content">
            <ol><li><strong>Crie uma sessão</strong><span>Use o botão Sessão ou um template pronto.</span></li><li><strong>Monte o fluxo</strong><span>Crie caixas e arraste o ponto lateral para conectar.</span></li><li><strong>Narre</strong><span>Inicie a sessão e marque os acontecimentos no canvas.</span></li><li><strong>Feche</strong><span>Abra o roteiro, imprima em PDF e exporte seu projeto.</span></li></ol>
            <div className="shortcut-grid"><kbd>Ctrl K</kbd><span>Buscar</span><kbd>Ctrl S</kbd><span>Salvar</span><kbd>Ctrl Z</kbd><span>Desfazer</span><kbd>Ctrl D</kbd><span>Duplicar</span><kbd>Home</kbd><span>Ver tudo</span><kbd>Espaço</kbd><span>Mover mapa</span></div>
          </div>
        ) : (
          <div className="health-content">
            <div className={errors ? "health-summary has-error" : "health-summary"}><Icons.shield /><div><strong>{errors ? `${errors} erro(s) encontrado(s)` : "Projeto íntegro"}</strong><span>{state.nodes.length} caixas · {state.regions.length} regiões · {state.connections.length} conexões</span></div></div>
            {issues.length ? <ul>{issues.map((issue, index) => <li className={issue.severity} key={`${issue.message}-${index}`}>{issue.message}</li>)}</ul> : <p>Nenhum problema estrutural encontrado. Backups e exportação continuam recomendados.</p>}
          </div>
        )}
      </section>
    </div>
  );
}
