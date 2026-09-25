import { useMemo } from "react";
import { MODULE_REGISTRY, type ModuleKey } from "../../domain/modules";
import { Icons } from "../Icons";

interface ModulesPanelProps {
  enabledModules: ModuleKey[];
  onClose: () => void;
  onChange: (modules: ModuleKey[]) => void;
}

const PHASE_LABEL: Record<number, string> = {
  2: "Fase 2 — NPCs, quests e sessões",
  3: "Fase 3 — Conhecimento, mistério e automação",
  4: "Fase 4 — Mundo, projetos e economia",
  5: "Fase 5 — Cenas, presságios, ecologia e rumores",
  6: "Fase 6 — Transcrições, saúde da campanha e visão dos jogadores",
  7: "Fase 7 — Comunicação entre NPCs e facções",
};

/** Every specialized tool from Fase 2 onward is opt-in per campaign — a
 * one-shot mystery campaign might want Mystery Board + Causalidade but
 * none of the economy/settlement tracking, while a sandbox hexcrawl wants
 * the opposite. Turning a module off never deletes data: the fields bag
 * for that kind stays exactly as it was, just not shown until turned back
 * on (see domain/modules.ts). */
export function ModulesPanel({ enabledModules, onClose, onChange }: ModulesPanelProps) {
  const enabled = useMemo(() => new Set(enabledModules), [enabledModules]);
  const groups = useMemo(() => {
    const byPhase = new Map<number, typeof MODULE_REGISTRY>();
    for (const module of MODULE_REGISTRY) {
      const list = byPhase.get(module.phase);
      if (list) list.push(module);
      else byPhase.set(module.phase, [module]);
    }
    return [...byPhase.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  function toggle(key: ModuleKey, checked: boolean) {
    onChange(checked ? [...enabledModules, key] : enabledModules.filter((item) => item !== key));
  }

  return (
    <div className="dialog-backdrop tool-backdrop" onMouseDown={onClose}>
      <section className="tool-panel" onMouseDown={(event) => event.stopPropagation()} aria-label="Módulos da campanha">
        <header className="tool-panel-heading">
          <div><span className="eyebrow">CONFIGURAÇÃO</span><h2>Módulos desta campanha</h2></div>
          <button className="icon-button" aria-label="Fechar" onClick={onClose}><Icons.close /></button>
        </header>
        <p className="modules-intro">Desligar um módulo só esconde a ferramenta e a seção especializada — nada é apagado, e dá para ligar de novo a qualquer momento.</p>

        {groups.map(([phase, modules]) => (
          <div className="tool-panel-section" key={phase}>
            <span className="eyebrow">{PHASE_LABEL[phase] ?? `Fase ${phase}`}</span>
            <ul className="module-list">
              {modules.map((module) => (
                <li key={module.key} className="module-row">
                  <label>
                    <input type="checkbox" checked={enabled.has(module.key)} onChange={(event) => toggle(module.key, event.target.checked)} />
                    <span className="module-row-body">
                      <strong>{module.label}</strong>
                      <small>{module.description}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
