import { readSessionFields, type SessionFields } from "../../domain/sessionFields";
import { Icons } from "../Icons";

interface SessionSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function SessionSection({ fields, onUpdate }: SessionSectionProps) {
  const session = readSessionFields(fields);

  function patch(partial: Partial<SessionFields>) {
    onUpdate({ ...fields, ...partial });
  }

  return (
    <div className="kind-section">
      {session.finalizedAt && (
        <div className="session-finalized-banner"><Icons.shield /> Sessão finalizada em {new Date(session.finalizedAt).toLocaleString("pt-BR")}</div>
      )}
      <div className="compact-grid">
        <label className="compact-field">Número<input value={session.number} onChange={(e) => patch({ number: e.target.value })} placeholder="18" /></label>
        <label className="compact-field">Data<input value={session.date} onChange={(e) => patch({ date: e.target.value })} placeholder="12/03" /></label>
        <label className="compact-field">Duração<input value={session.duration} onChange={(e) => patch({ duration: e.target.value })} placeholder="3h" /></label>
        <label className="compact-field">Desenvolvimento<input type="number" value={session.developmentPoints} onChange={(e) => patch({ developmentPoints: Number(e.target.value) })} /></label>
      </div>
      <label>Notas<textarea value={session.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="O que aconteceu…" /></label>
      <label>Consequências<textarea value={session.consequences} onChange={(e) => patch({ consequences: e.target.value })} /></label>
      <label>Recursos usados<input value={session.resourcesUsed} onChange={(e) => patch({ resourcesUsed: e.target.value })} placeholder="madeira, ouro…" /></label>
      <label>Transcrição<textarea value={session.transcript} onChange={(e) => patch({ transcript: e.target.value })} placeholder="Cole aqui ou importe depois." /></label>

      {!session.finalizedAt && (
        <button type="button" className="primary-button" style={{ width: "100%" }} onClick={() => patch({ finalizedAt: Date.now() })}>
          <Icons.shield /> Finalizar sessão
        </button>
      )}
      <div className="inspector-tip">Use as relações (seção abaixo) para ligar personagens presentes, NPCs, locais, cenas e quests desta sessão.</div>
    </div>
  );
}
