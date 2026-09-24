import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Project, WorkspaceData } from "../domain/types";
import { createDemoWorkspace, demoProjects } from "./seed";
import {
  MAX_ARCHIVE_BYTES,
  parseProjectArchive,
  prepareImportedWorkspace,
  safeProjectFileName,
  serializeProjectArchive,
  validateWorkspaceData,
} from "./projectArchive";

const PROJECTS_KEY = "rpg-canvas-studio:projects";
const BACKUP_INDEX_KEY = "rpg-canvas-studio:backup-index:v1";
const BACKUP_PREFIX = "rpg-canvas-studio:backup:v1:";
const SNAPSHOT_INTERVAL = 10 * 60 * 1000;
const MAX_SNAPSHOTS_PER_PROJECT = 10;
const workspaceKey = (id: string) => `rpg-canvas-studio:workspace:${id}`;

export interface BackupInfo {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  nodeCount: number;
  regionCount: number;
  latest: boolean;
}

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function projectArchive(workspace: WorkspaceData): string {
  return serializeProjectArchive(workspace);
}

function browserBackupKey(id: string): string {
  return `${BACKUP_PREFIX}${id}`;
}

function readBrowserBackupIndex(): BackupInfo[] {
  try {
    const raw = localStorage.getItem(BACKUP_INDEX_KEY);
    return raw ? JSON.parse(raw) as BackupInfo[] : [];
  } catch {
    return [];
  }
}

function writeBrowserBackup(workspace: WorkspaceData, archive: string): void {
  const now = Date.now();
  const latestId = `latest-${workspace.project.id}`;
  let index = readBrowserBackupIndex().filter((backup) => backup.id !== latestId);
  localStorage.setItem(browserBackupKey(latestId), archive);
  index.push({
    id: latestId,
    projectId: workspace.project.id,
    title: workspace.project.title,
    createdAt: now,
    nodeCount: workspace.nodes.length,
    regionCount: workspace.regions.length,
    latest: true,
  });

  const snapshots = index
    .filter((backup) => backup.projectId === workspace.project.id && !backup.latest)
    .sort((a, b) => b.createdAt - a.createdAt);
  if (!snapshots.length || now - snapshots[0].createdAt >= SNAPSHOT_INTERVAL) {
    const id = `snapshot-${workspace.project.id}-${now}`;
    localStorage.setItem(browserBackupKey(id), archive);
    index.push({
      id,
      projectId: workspace.project.id,
      title: workspace.project.title,
      createdAt: now,
      nodeCount: workspace.nodes.length,
      regionCount: workspace.regions.length,
      latest: false,
    });
  }

  const retainedIds = new Set<string>();
  const byProject = new Map<string, BackupInfo[]>();
  for (const backup of index) byProject.set(backup.projectId, [...(byProject.get(backup.projectId) ?? []), backup]);
  for (const backups of byProject.values()) {
    const latest = backups.find((backup) => backup.latest);
    if (latest) retainedIds.add(latest.id);
    backups
      .filter((backup) => !backup.latest)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_SNAPSHOTS_PER_PROJECT)
      .forEach((backup) => retainedIds.add(backup.id));
  }
  for (const backup of index) {
    if (!retainedIds.has(backup.id)) localStorage.removeItem(browserBackupKey(backup.id));
  }
  index = index.filter((backup) => retainedIds.has(backup.id));
  localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(index));
}

async function saveAutomaticBackup(workspace: WorkspaceData, archive: string): Promise<void> {
  try {
    if (isDesktopApp()) {
      await invoke("save_project_backup", {
        projectId: workspace.project.id,
        title: workspace.project.title,
        archive,
      });
    } else {
      writeBrowserBackup(workspace, archive);
    }
  } catch (error) {
    console.error("Falha ao criar backup automático", error);
  }
}

export async function listProjects(): Promise<Project[]> {
  if (isDesktopApp()) {
    const projects = await invoke<Project[]>("list_projects");
    return projects.length ? projects : demoProjects;
  }
  const raw = localStorage.getItem(PROJECTS_KEY);
  if (!raw) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(demoProjects));
    return demoProjects;
  }
  try {
    return JSON.parse(raw) as Project[];
  } catch {
    return demoProjects;
  }
}

async function latestBackupWorkspace(projectId: string): Promise<WorkspaceData | null> {
  const backup = (await listBackups())
    .filter((candidate) => candidate.projectId === projectId)
    .sort((a, b) => Number(b.latest) - Number(a.latest) || b.createdAt - a.createdAt)[0];
  if (!backup) return null;
  return parseProjectArchive(await readBackupArchive(backup.id)).workspace;
}

export async function loadWorkspace(project: Project): Promise<WorkspaceData> {
  try {
    if (isDesktopApp()) {
      const workspace = await invoke<WorkspaceData | null>("load_workspace", { projectId: project.id });
      if (workspace) {
        const valid = validateWorkspaceData(workspace);
        void saveAutomaticBackup(valid, projectArchive(valid));
        return valid;
      }
    } else {
      const raw = localStorage.getItem(workspaceKey(project.id));
      if (raw) {
        const valid = validateWorkspaceData(JSON.parse(raw));
        void saveAutomaticBackup(valid, projectArchive(valid));
        return valid;
      }
    }
  } catch (error) {
    console.error("Falha ao abrir o projeto principal; tentando backup", error);
    const recovered = await latestBackupWorkspace(project.id);
    if (recovered) return recovered;
    throw error;
  }
  const recovered = await latestBackupWorkspace(project.id);
  if (recovered) return recovered;
  return createDemoWorkspace(project);
}

export async function saveWorkspace(workspace: WorkspaceData): Promise<void> {
  const valid = validateWorkspaceData(workspace);
  const archive = projectArchive(valid);
  if (isDesktopApp()) {
    await invoke("save_workspace", { workspace: valid });
  } else {
    localStorage.setItem(workspaceKey(valid.project.id), JSON.stringify(valid));
    const projects = await listProjects();
    const next = projects.some((project) => project.id === valid.project.id)
      ? projects.map((project) => (project.id === valid.project.id ? valid.project : project))
      : [valid.project, ...projects];
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
  }
  await saveAutomaticBackup(valid, archive);
}

export async function createProject(project: Project): Promise<void> {
  await saveWorkspace(createDemoWorkspace(project));
}

export async function exportProject(workspace: WorkspaceData): Promise<boolean> {
  const archive = projectArchive(workspace);
  const fileName = safeProjectFileName(workspace.project.title);
  if (isDesktopApp()) {
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: "Projeto RPG Canvas", extensions: ["rpgcanvas"] }],
    });
    if (!path) return false;
    await invoke("write_project_archive", { path, archive });
    await saveAutomaticBackup(workspace, archive);
    return true;
  }
  const url = URL.createObjectURL(new Blob([archive], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export async function chooseProjectArchive(): Promise<string | null> {
  if (!isDesktopApp()) return null;
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Projeto RPG Canvas", extensions: ["rpgcanvas", "json"] }],
  });
  if (!path || Array.isArray(path)) return null;
  return invoke<string>("read_project_archive", { path });
}

export async function readProjectFile(file: File): Promise<string> {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error("Este arquivo ultrapassa o limite de 100 MB.");
  return file.text();
}

export function importWorkspaceFromArchive(text: string, projects: Project[]): WorkspaceData {
  const archive = parseProjectArchive(text);
  return prepareImportedWorkspace(archive.workspace, new Set(projects.map((project) => project.id)));
}

export async function listBackups(): Promise<BackupInfo[]> {
  if (isDesktopApp()) return invoke<BackupInfo[]>("list_project_backups");
  return readBrowserBackupIndex().sort((a, b) => b.createdAt - a.createdAt);
}

export async function readBackupArchive(id: string): Promise<string> {
  if (isDesktopApp()) return invoke<string>("read_project_backup", { fileName: id });
  const archive = localStorage.getItem(browserBackupKey(id));
  if (!archive) throw new Error("O backup não está mais disponível.");
  return archive;
}

export async function restoreBackup(id: string): Promise<WorkspaceData> {
  const workspace = parseProjectArchive(await readBackupArchive(id)).workspace;
  await saveWorkspace(workspace);
  return workspace;
}
