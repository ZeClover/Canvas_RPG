import { readThemeFields, type ThemeFields } from "../../domain/themeFields";
import { ListEditor } from "./ListEditor";

interface ThemeSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function ThemeSection({ fields, onUpdate }: ThemeSectionProps) {
  const theme = readThemeFields(fields);

  function patch(partial: Partial<ThemeFields>) {
    onUpdate({ ...fields, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">TEMA</span>
      <ListEditor label="Motivos recorrentes" value={theme.motifs} placeholder="espelhos quebrados, promessas não cumpridas" onChange={(next) => patch({ motifs: next })} />
      <label>Notas<textarea value={theme.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="Onde e como esse tema deveria aparecer…" /></label>
      <div className="inspector-tip">Conecte este tema a cenas, quests e NPCs pelas relações abaixo para lembrar onde ele já apareceu.</div>
    </div>
  );
}
