// Project Engine data — a project's stages are the same shape as a
// quest's objectives (id/text/done), so they share the ObjectiveList
// editor. Progress is always derived from stages (done/total), never
// stored, so it can't drift out of sync with the checklist.

export interface ProjectStage {
  id: string;
  text: string;
  done: boolean;
}

export interface ProjectFields {
  goal: string;
  stages: ProjectStage[];
  blockers: string;
  deadline: string;
  notes: string;
}

export function defaultProjectFields(): ProjectFields {
  return { goal: "", stages: [], blockers: "", deadline: "", notes: "" };
}

export function readProjectFields(fields: Record<string, unknown>): ProjectFields {
  const defaults = defaultProjectFields();
  const source = fields as Partial<ProjectFields>;
  return {
    goal: typeof source.goal === "string" ? source.goal : defaults.goal,
    stages: Array.isArray(source.stages) ? source.stages : defaults.stages,
    blockers: typeof source.blockers === "string" ? source.blockers : defaults.blockers,
    deadline: typeof source.deadline === "string" ? source.deadline : defaults.deadline,
    notes: typeof source.notes === "string" ? source.notes : defaults.notes,
  };
}

export function projectProgress(fields: ProjectFields): { done: number; total: number; percent: number } {
  const done = fields.stages.filter((stage) => stage.done).length;
  const total = fields.stages.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}
