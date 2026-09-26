import { readSceneFields, type SceneFields } from "../../domain/sceneFields";
import { ListEditor } from "./ListEditor";

interface SceneSectionProps {
  fields: Record<string, unknown>;
  onUpdate: (fields: Record<string, unknown>) => void;
}

export function SceneSection({ fields, onUpdate }: SceneSectionProps) {
  const scene = readSceneFields(fields);

  function patch(partial: Partial<SceneFields>) {
    onUpdate({ ...fields, ...partial });
  }

  return (
    <div className="kind-section">
      <span className="eyebrow">SCENE COMPOSER</span>
      <div className="compact-grid">
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Tom / clima<input value={scene.mood} placeholder="Ex.: tenso, melancólico, cômico" onChange={(e) => patch({ mood: e.target.value })} /></label>
        <label className="compact-field" style={{ gridColumn: "1 / -1" }}>Trilha/ambiência<input value={scene.musicNote} placeholder="Ex.: chuva ao fundo, sino distante" onChange={(e) => patch({ musicNote: e.target.value })} /></label>
      </div>
      <label>Texto para ler em voz alta<textarea value={scene.readAloud} onChange={(e) => patch({ readAloud: e.target.value })} placeholder="O que o mestre lê para o grupo ao abrir a cena…" /></label>
      <ListEditor label="Detalhes sensoriais" value={scene.sensoryDetails} placeholder="cheiro de mofo, luz fraca, silêncio" onChange={(next) => patch({ sensoryDetails: next })} />
      <label>Complicações<textarea value={scene.complications} onChange={(e) => patch({ complications: e.target.value })} placeholder="O que pode dar errado ou virar a cena de rumo?" /></label>
      <div className="inspector-tip">Use as relações abaixo (tipo "envolve"/"acontece em") para ligar quem está presente e onde a cena se passa.</div>
    </div>
  );
}
