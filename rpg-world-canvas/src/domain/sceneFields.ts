// Scene Composer data — a scene is a ready-to-run narrative unit: what
// the GM reads aloud, the mood to set, and what can go wrong. Who's
// present is expressed via the existing "involves"/"happens_at"
// relations, same discipline as everything else — not a parallel list.

export interface SceneFields {
  mood: string;
  readAloud: string;
  sensoryDetails: string[];
  complications: string;
  musicNote: string;
}

export function defaultSceneFields(): SceneFields {
  return { mood: "", readAloud: "", sensoryDetails: [], complications: "", musicNote: "" };
}

export function readSceneFields(fields: Record<string, unknown>): SceneFields {
  const defaults = defaultSceneFields();
  const source = fields as Partial<SceneFields>;
  return {
    mood: typeof source.mood === "string" ? source.mood : defaults.mood,
    readAloud: typeof source.readAloud === "string" ? source.readAloud : defaults.readAloud,
    sensoryDetails: Array.isArray(source.sensoryDetails) ? source.sensoryDetails.filter((item): item is string => typeof item === "string") : defaults.sensoryDetails,
    complications: typeof source.complications === "string" ? source.complications : defaults.complications,
    musicNote: typeof source.musicNote === "string" ? source.musicNote : defaults.musicNote,
  };
}
