// Resource & Survival Engine data — scoped to kind "resource". Stock is a
// number the GM updates by hand after a session; "critical" is computed
// from stock vs. criticalThreshold, never stored, so it can't go stale.

export interface ResourceFields {
  stock: number;
  unit: string;
  criticalThreshold: number;
  regenNote: string;
  notes: string;
}

export function defaultResourceFields(): ResourceFields {
  return { stock: 0, unit: "", criticalThreshold: 10, regenNote: "", notes: "" };
}

export function readResourceFields(fields: Record<string, unknown>): ResourceFields {
  const defaults = defaultResourceFields();
  const source = fields as Partial<ResourceFields>;
  return {
    stock: typeof source.stock === "number" && Number.isFinite(source.stock) ? source.stock : defaults.stock,
    unit: typeof source.unit === "string" ? source.unit : defaults.unit,
    criticalThreshold: typeof source.criticalThreshold === "number" && Number.isFinite(source.criticalThreshold) ? source.criticalThreshold : defaults.criticalThreshold,
    regenNote: typeof source.regenNote === "string" ? source.regenNote : defaults.regenNote,
    notes: typeof source.notes === "string" ? source.notes : defaults.notes,
  };
}

export function isResourceCritical(fields: ResourceFields): boolean {
  return fields.stock <= fields.criticalThreshold;
}
