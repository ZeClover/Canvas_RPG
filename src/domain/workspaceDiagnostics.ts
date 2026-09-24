import type { WorkspaceData } from "./types";

export interface DiagnosticIssue {
  severity: "error" | "warning";
  message: string;
}

export function diagnoseWorkspace(state: WorkspaceData): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const duplicateIds = (ids: string[]) => ids.filter((id, index) => ids.indexOf(id) !== index);
  const nodeIds = new Set(state.nodes.map((node) => node.id));
  const regionIds = new Set(state.regions.map((region) => region.id));
  const connectionIds = state.connections.map((edge) => edge.id);
  if (duplicateIds(state.nodes.map((node) => node.id)).length) issues.push({ severity: "error", message: "Existem caixas com IDs duplicados." });
  if (duplicateIds(state.regions.map((region) => region.id)).length) issues.push({ severity: "error", message: "Existem regiões com IDs duplicados." });
  if (duplicateIds(connectionIds).length) issues.push({ severity: "error", message: "Existem conexões com IDs duplicados." });
  for (const region of state.regions) if (region.parentRegionId && !regionIds.has(region.parentRegionId)) issues.push({ severity: "error", message: `A região “${region.title}” perdeu sua região superior.` });
  for (const node of state.nodes) {
    if (node.regionId && !regionIds.has(node.regionId)) issues.push({ severity: "error", message: `A caixa “${node.title}” aponta para uma região inexistente.` });
    if (node.sourceNodeId && !nodeIds.has(node.sourceNodeId)) issues.push({ severity: "error", message: `A referência “${node.title}” perdeu sua origem.` });
    if (new Set(node.tags).size !== node.tags.length) issues.push({ severity: "warning", message: `A caixa “${node.title}” possui etiquetas repetidas.` });
  }
  for (const edge of state.connections) if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) issues.push({ severity: "error", message: "Uma conexão aponta para uma caixa inexistente." });
  for (const session of state.regions.filter((region) => region.kind === "session")) {
    if (!state.nodes.some((node) => node.regionId === session.id)) issues.push({ severity: "warning", message: `A sessão “${session.title}” ainda está vazia.` });
  }
  return issues;
}
