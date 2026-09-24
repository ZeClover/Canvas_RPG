import { useSyncExternalStore } from "react";
import type { WorkspaceState, WorkspaceStore } from "./workspaceStore";

export function useWorkspace(store: WorkspaceStore): WorkspaceState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

