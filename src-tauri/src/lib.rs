use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, State};
use uuid::Uuid;
use walkdir::WalkDir;

struct Database(Mutex<Connection>);
struct BackupDirectory(PathBuf);

const MAX_ARCHIVE_BYTES: usize = 100 * 1024 * 1024;
const SNAPSHOT_INTERVAL: Duration = Duration::from_secs(10 * 60);
const MAX_SNAPSHOTS_PER_PROJECT: usize = 10;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Project {
    id: String,
    title: String,
    description: String,
    color: String,
    updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CanvasRegion {
    id: String,
    project_id: String,
    parent_region_id: Option<String>,
    title: String,
    kind: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    color: String,
    min_detail_scale: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CanvasNode {
    id: String,
    project_id: String,
    region_id: Option<String>,
    source_node_id: Option<String>,
    title: String,
    body: String,
    instance_notes: String,
    kind: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    color: String,
    image_src: Option<String>,
    tags: Vec<String>,
    important: bool,
    created_at: i64,
    updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CanvasConnection {
    id: String,
    project_id: String,
    from_node_id: String,
    to_node_id: String,
    label: String,
    relation: String,
    color: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceData {
    project: Project,
    nodes: Vec<CanvasNode>,
    regions: Vec<CanvasRegion>,
    connections: Vec<CanvasConnection>,
    session_progress: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeTrack {
    id: String,
    title: String,
    path: String,
    category: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupInfo {
    id: String,
    project_id: String,
    title: String,
    created_at: i64,
    node_count: usize,
    region_count: usize,
    latest: bool,
}

fn safe_file_part(value: &str) -> String {
    let clean: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect();
    if clean.is_empty() {
        "project".to_string()
    } else {
        clean
    }
}

fn atomic_write(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let temporary = path.with_extension(format!(
        "{}.tmp",
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("file")
    ));
    let previous = path.with_extension(format!(
        "{}.previous",
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("file")
    ));
    fs::write(&temporary, contents).map_err(|error| error.to_string())?;
    if path.exists() {
        if previous.exists() {
            fs::remove_file(&previous).map_err(|error| error.to_string())?;
        }
        fs::rename(path, &previous).map_err(|error| error.to_string())?;
    }
    if let Err(error) = fs::rename(&temporary, path) {
        if previous.exists() {
            let _ = fs::rename(&previous, path);
        }
        return Err(error.to_string());
    }
    if previous.exists() {
        fs::remove_file(previous).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn ensure_archive_size(contents: &str) -> Result<(), String> {
    if contents.len() > MAX_ARCHIVE_BYTES {
        return Err("O arquivo ultrapassa o limite de 100 MB.".to_string());
    }
    Ok(())
}

fn read_limited_file(path: &Path) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    if metadata.len() as usize > MAX_ARCHIVE_BYTES {
        return Err("O arquivo ultrapassa o limite de 100 MB.".to_string());
    }
    fs::read_to_string(path).map_err(|error| error.to_string())
}

fn archive_metadata(file_name: String, contents: &str) -> Result<BackupInfo, String> {
    let value: serde_json::Value =
        serde_json::from_str(contents).map_err(|_| "Backup inválido.".to_string())?;
    if value.get("format").and_then(|item| item.as_str()) != Some("rpg-canvas-studio")
        || value.get("version").and_then(|item| item.as_u64()) != Some(1)
    {
        return Err("Backup incompatível.".to_string());
    }
    let workspace = value
        .get("workspace")
        .and_then(|item| item.as_object())
        .ok_or_else(|| "Backup sem conteúdo.".to_string())?;
    let project = workspace
        .get("project")
        .and_then(|item| item.as_object())
        .ok_or_else(|| "Backup sem projeto.".to_string())?;
    Ok(BackupInfo {
        latest: file_name.contains("--latest.rpgbackup"),
        id: file_name,
        project_id: project
            .get("id")
            .and_then(|item| item.as_str())
            .unwrap_or_default()
            .to_string(),
        title: project
            .get("title")
            .and_then(|item| item.as_str())
            .unwrap_or("Projeto")
            .to_string(),
        created_at: value
            .get("exportedAt")
            .and_then(|item| item.as_i64())
            .unwrap_or_default(),
        node_count: workspace
            .get("nodes")
            .and_then(|item| item.as_array())
            .map_or(0, Vec::len),
        region_count: workspace
            .get("regions")
            .and_then(|item| item.as_array())
            .map_or(0, Vec::len),
    })
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn initialize_database(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .execute_batch(include_str!("../migrations/001_initial.sql"))
        .map_err(|error| error.to_string())?;
    let has_tags: i64 = connection
        .query_row("SELECT COUNT(*) FROM pragma_table_info('nodes') WHERE name = 'tags_json'", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if has_tags == 0 {
        connection.execute("ALTER TABLE nodes ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'", [])
            .map_err(|error| error.to_string())?;
    }
    Ok(connection)
}

#[tauri::command]
fn list_projects(database: State<Database>) -> Result<Vec<Project>, String> {
    let connection = database.0.lock().map_err(|error| error.to_string())?;
    let mut statement = connection.prepare(
        "SELECT id, title, description, color, updated_at FROM projects ORDER BY updated_at DESC"
    ).map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                color: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_workspace(
    project_id: String,
    database: State<Database>,
) -> Result<Option<WorkspaceData>, String> {
    let connection = database.0.lock().map_err(|error| error.to_string())?;
    let project = connection
        .query_row(
            "SELECT id, title, description, color, updated_at FROM projects WHERE id = ?1",
            [&project_id],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    color: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;
    let Some(project) = project else {
        return Ok(None);
    };

    let mut regions_statement = connection.prepare(
        "SELECT id, project_id, parent_region_id, title, kind, x, y, width, height, color, min_detail_scale FROM regions WHERE project_id = ?1"
    ).map_err(|error| error.to_string())?;
    let regions = regions_statement
        .query_map([&project_id], |row| {
            Ok(CanvasRegion {
                id: row.get(0)?,
                project_id: row.get(1)?,
                parent_region_id: row.get(2)?,
                title: row.get(3)?,
                kind: row.get(4)?,
                x: row.get(5)?,
                y: row.get(6)?,
                width: row.get(7)?,
                height: row.get(8)?,
                color: row.get(9)?,
                min_detail_scale: row.get(10)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut nodes_statement = connection.prepare(
        "SELECT id, project_id, region_id, source_node_id, title, body, instance_notes, kind, x, y, width, height, color, image_src, tags_json, important, created_at, updated_at FROM nodes WHERE project_id = ?1"
    ).map_err(|error| error.to_string())?;
    let nodes = nodes_statement
        .query_map([&project_id], |row| {
            Ok(CanvasNode {
                id: row.get(0)?,
                project_id: row.get(1)?,
                region_id: row.get(2)?,
                source_node_id: row.get(3)?,
                title: row.get(4)?,
                body: row.get(5)?,
                instance_notes: row.get(6)?,
                kind: row.get(7)?,
                x: row.get(8)?,
                y: row.get(9)?,
                width: row.get(10)?,
                height: row.get(11)?,
                color: row.get(12)?,
                image_src: row.get(13)?,
                tags: serde_json::from_str(&row.get::<_, String>(14)?).unwrap_or_default(),
                important: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut edges_statement = connection.prepare(
        "SELECT id, project_id, from_node_id, to_node_id, label, relation, color FROM connections WHERE project_id = ?1"
    ).map_err(|error| error.to_string())?;
    let connections = edges_statement
        .query_map([&project_id], |row| {
            Ok(CanvasConnection {
                id: row.get(0)?,
                project_id: row.get(1)?,
                from_node_id: row.get(2)?,
                to_node_id: row.get(3)?,
                label: row.get(4)?,
                relation: row.get(5)?,
                color: row.get(6)?,
            })
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    let mut progress_statement = connection
        .prepare("SELECT node_id, state FROM session_progress WHERE project_id = ?1")
        .map_err(|error| error.to_string())?;
    let session_progress = progress_statement
        .query_map([&project_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<std::collections::HashMap<_, _>, _>>()
        .map_err(|error| error.to_string())?;

    Ok(Some(WorkspaceData {
        project,
        nodes,
        regions,
        connections,
        session_progress,
    }))
}

#[tauri::command]
fn save_workspace(workspace: WorkspaceData, database: State<Database>) -> Result<(), String> {
    let mut connection = database.0.lock().map_err(|error| error.to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|error| error.to_string())?;
    let created_at: i64 = transaction
        .query_row(
            "SELECT COALESCE((SELECT created_at FROM projects WHERE id = ?1), ?2)",
            params![workspace.project.id, now_ms()],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    transaction.execute(
        "INSERT INTO projects(id, title, description, color, created_at, updated_at) VALUES(?1,?2,?3,?4,?5,?6)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, description=excluded.description, color=excluded.color, updated_at=excluded.updated_at",
        params![workspace.project.id, workspace.project.title, workspace.project.description, workspace.project.color, created_at, workspace.project.updated_at],
    ).map_err(|error| error.to_string())?;

    transaction
        .execute(
            "DELETE FROM connections WHERE project_id = ?1",
            [&workspace.project.id],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "DELETE FROM session_progress WHERE project_id = ?1",
            [&workspace.project.id],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "DELETE FROM nodes WHERE project_id = ?1",
            [&workspace.project.id],
        )
        .map_err(|error| error.to_string())?;
    transaction
        .execute(
            "DELETE FROM regions WHERE project_id = ?1",
            [&workspace.project.id],
        )
        .map_err(|error| error.to_string())?;

    for region in &workspace.regions {
        transaction.execute(
            "INSERT INTO regions(id,project_id,parent_region_id,title,kind,x,y,width,height,color,min_detail_scale) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
            params![region.id, region.project_id, region.parent_region_id, region.title, region.kind, region.x, region.y, region.width, region.height, region.color, region.min_detail_scale],
        ).map_err(|error| error.to_string())?;
    }
    for node in &workspace.nodes {
        transaction.execute(
            "INSERT INTO nodes(id,project_id,region_id,source_node_id,title,body,instance_notes,kind,x,y,width,height,color,image_src,tags_json,important,created_at,updated_at)
             VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18)",
            params![node.id, node.project_id, node.region_id, Option::<String>::None, node.title, node.body, node.instance_notes, node.kind,
                node.x, node.y, node.width, node.height, node.color, node.image_src, serde_json::to_string(&node.tags).unwrap_or_else(|_| "[]".to_string()), node.important, node.created_at, node.updated_at],
        ).map_err(|error| error.to_string())?;
    }
    for node in &workspace.nodes {
        if let Some(source_node_id) = &node.source_node_id {
            transaction
                .execute(
                    "UPDATE nodes SET source_node_id = ?1 WHERE id = ?2",
                    params![source_node_id, node.id],
                )
                .map_err(|error| error.to_string())?;
        }
    }
    for edge in &workspace.connections {
        transaction.execute(
            "INSERT INTO connections(id,project_id,from_node_id,to_node_id,label,relation,color) VALUES(?1,?2,?3,?4,?5,?6,?7)",
            params![edge.id, edge.project_id, edge.from_node_id, edge.to_node_id, edge.label, edge.relation, edge.color],
        ).map_err(|error| error.to_string())?;
    }
    for (node_id, state) in &workspace.session_progress {
        transaction.execute(
            "INSERT INTO session_progress(project_id,node_id,state,visited_at) VALUES(?1,?2,?3,?4)",
            params![workspace.project.id, node_id, state, now_ms()],
        ).map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())
}

#[tauri::command]
fn write_project_archive(path: String, archive: String) -> Result<(), String> {
    ensure_archive_size(&archive)?;
    let requested = PathBuf::from(path);
    let target = if requested.extension().is_none() {
        requested.with_extension("rpgcanvas")
    } else {
        requested
    };
    let extension = target
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if !extension.eq_ignore_ascii_case("rpgcanvas") {
        return Err("Use a extensão .rpgcanvas.".to_string());
    }
    atomic_write(&target, &archive)
}

#[tauri::command]
fn read_project_archive(path: String) -> Result<String, String> {
    let target = PathBuf::from(path);
    let extension = target
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if !extension.eq_ignore_ascii_case("rpgcanvas") && !extension.eq_ignore_ascii_case("json") {
        return Err("Selecione um arquivo .rpgcanvas.".to_string());
    }
    read_limited_file(&target)
}

#[tauri::command]
fn save_project_backup(
    project_id: String,
    title: String,
    archive: String,
    backups: State<BackupDirectory>,
) -> Result<(), String> {
    ensure_archive_size(&archive)?;
    let parsed = archive_metadata("check.rpgbackup".to_string(), &archive)?;
    if parsed.project_id != project_id || parsed.title != title {
        return Err("Os dados do backup não correspondem ao projeto.".to_string());
    }
    fs::create_dir_all(&backups.0).map_err(|error| error.to_string())?;
    let safe_id = safe_file_part(&project_id);
    let latest_path = backups.0.join(format!("{safe_id}--latest.rpgbackup"));
    atomic_write(&latest_path, &archive)?;

    let prefix = format!("{safe_id}--");
    let mut snapshots: Vec<(PathBuf, SystemTime)> = fs::read_dir(&backups.0)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with(&prefix) || name.contains("--latest.") || !name.ends_with(".rpgbackup") {
                return None;
            }
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((entry.path(), modified))
        })
        .collect();
    snapshots.sort_by(|a, b| b.1.cmp(&a.1));
    let needs_snapshot = snapshots
        .first()
        .and_then(|(_, modified)| modified.elapsed().ok())
        .map_or(true, |elapsed| elapsed >= SNAPSHOT_INTERVAL);
    if needs_snapshot {
        let snapshot = backups.0.join(format!("{safe_id}--{}.rpgbackup", now_ms()));
        atomic_write(&snapshot, &archive)?;
        snapshots.insert(0, (snapshot, SystemTime::now()));
    }
    for (path, _) in snapshots.into_iter().skip(MAX_SNAPSHOTS_PER_PROJECT) {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn list_project_backups(backups: State<BackupDirectory>) -> Result<Vec<BackupInfo>, String> {
    fs::create_dir_all(&backups.0).map_err(|error| error.to_string())?;
    let mut items = Vec::new();
    for entry in fs::read_dir(&backups.0).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if !file_name.ends_with(".rpgbackup") {
            continue;
        }
        let contents = match read_limited_file(&entry.path()) {
            Ok(contents) => contents,
            Err(_) => continue,
        };
        if let Ok(info) = archive_metadata(file_name, &contents) {
            items.push(info);
        }
    }
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(items)
}

#[tauri::command]
fn read_project_backup(
    file_name: String,
    backups: State<BackupDirectory>,
) -> Result<String, String> {
    let requested = Path::new(&file_name);
    if requested.file_name().and_then(|value| value.to_str()) != Some(file_name.as_str())
        || !file_name.ends_with(".rpgbackup")
    {
        return Err("Identificador de backup inválido.".to_string());
    }
    read_limited_file(&backups.0.join(file_name))
}

#[tauri::command]
fn scan_music_folder(path: String) -> Result<Vec<NativeTrack>, String> {
    let root = Path::new(&path);
    if !root.is_dir() {
        return Err("A pasta selecionada não existe.".to_string());
    }
    let namespace = Uuid::NAMESPACE_URL;
    let mut tracks = Vec::new();
    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() {
            continue;
        }
        let file_path = entry.path();
        let is_mp3 = file_path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.eq_ignore_ascii_case("mp3"))
            .unwrap_or(false);
        if !is_mp3 {
            continue;
        }
        let title = file_path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("Música")
            .to_string();
        let category = file_path
            .parent()
            .and_then(|parent| parent.file_name())
            .and_then(|value| value.to_str())
            .unwrap_or("Sem categoria")
            .to_string();
        let canonical = file_path.to_string_lossy().to_string();
        tracks.push(NativeTrack {
            id: format!("track_{}", Uuid::new_v5(&namespace, canonical.as_bytes())),
            title,
            path: canonical,
            category,
        });
    }
    tracks.sort_by(|a, b| a.category.cmp(&b.category).then(a.title.cmp(&b.title)));
    Ok(tracks)
}

trait OptionalRow<T> {
    fn optional(self) -> rusqlite::Result<Option<T>>;
}

impl<T> OptionalRow<T> for rusqlite::Result<T> {
    fn optional(self) -> rusqlite::Result<Option<T>> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            let database = initialize_database(&app_data.join("rpg-canvas-studio.sqlite"))
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::Other, error))?;
            app.manage(Database(Mutex::new(database)));
            app.manage(BackupDirectory(app_data.join("backups")));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_projects,
            load_workspace,
            save_workspace,
            write_project_archive,
            read_project_archive,
            save_project_backup,
            list_project_backups,
            read_project_backup,
            scan_music_folder
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar RPG Canvas Studio");
}
