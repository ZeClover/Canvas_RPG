// Presentation Mode: what's safe to put on a shared screen for players,
// derived entirely from `visibility` — the exact same field and the exact
// same rules Player Knowledge View already uses (gm_only never shows,
// partial only confirms existence, revealed shows everything). Never a
// second "is this player-safe" flag to keep in sync.

import { readSceneFields } from "./sceneFields";
import type { Entity } from "./types";

export type PresentationState = "gm_only" | "partial" | "revealed";

export interface PresentationContent {
  title: string;
  imageSrc: string | null;
  body: string;
  state: PresentationState;
}

export function presentationContent(entity: Entity): PresentationContent {
  const title = entity.title || "Sem título";
  if (entity.visibility === "gm_only") return { title, imageSrc: null, body: "", state: "gm_only" };
  if (entity.visibility === "partial") return { title, imageSrc: null, body: "", state: "partial" };
  const body = entity.kind === "scene" ? (readSceneFields(entity.fields).readAloud || entity.summary) : entity.summary;
  return { title, imageSrc: entity.imageSrc, body, state: "revealed" };
}
