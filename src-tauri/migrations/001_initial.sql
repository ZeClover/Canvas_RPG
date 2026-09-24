PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#a78bfa',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  color TEXT NOT NULL,
  min_detail_scale REAL NOT NULL DEFAULT 0.08
);

CREATE INDEX IF NOT EXISTS idx_regions_project ON regions(project_id);
CREATE INDEX IF NOT EXISTS idx_regions_parent ON regions(parent_region_id);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  region_id TEXT REFERENCES regions(id) ON DELETE SET NULL,
  source_node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  instance_notes TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'free',
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  color TEXT NOT NULL,
  image_src TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  important INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_project_region ON nodes(project_id, region_id);
CREATE INDEX IF NOT EXISTS idx_nodes_source ON nodes(source_node_id);
CREATE INDEX IF NOT EXISTS idx_nodes_updated ON nodes(project_id, updated_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS node_spatial USING rtree(
  rowid,
  min_x, max_x,
  min_y, max_y
);

CREATE TRIGGER IF NOT EXISTS nodes_spatial_insert AFTER INSERT ON nodes BEGIN
  INSERT OR REPLACE INTO node_spatial(rowid, min_x, max_x, min_y, max_y)
  VALUES (new.rowid, new.x, new.x + new.width, new.y, new.y + new.height);
END;

CREATE TRIGGER IF NOT EXISTS nodes_spatial_update AFTER UPDATE OF x, y, width, height ON nodes BEGIN
  UPDATE node_spatial SET min_x = new.x, max_x = new.x + new.width, min_y = new.y, max_y = new.y + new.height
  WHERE rowid = new.rowid;
END;

CREATE TRIGGER IF NOT EXISTS nodes_spatial_delete AFTER DELETE ON nodes BEGIN
  DELETE FROM node_spatial WHERE rowid = old.rowid;
END;

CREATE VIRTUAL TABLE IF NOT EXISTS node_search USING fts5(
  title,
  body,
  kind,
  content='nodes',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS nodes_search_insert AFTER INSERT ON nodes BEGIN
  INSERT INTO node_search(rowid, title, body, kind) VALUES (new.rowid, new.title, new.body, new.kind);
END;

CREATE TRIGGER IF NOT EXISTS nodes_search_update AFTER UPDATE OF title, body, kind ON nodes BEGIN
  INSERT INTO node_search(node_search, rowid, title, body, kind) VALUES ('delete', old.rowid, old.title, old.body, old.kind);
  INSERT INTO node_search(rowid, title, body, kind) VALUES (new.rowid, new.title, new.body, new.kind);
END;

CREATE TRIGGER IF NOT EXISTS nodes_search_delete AFTER DELETE ON nodes BEGIN
  INSERT INTO node_search(node_search, rowid, title, body, kind) VALUES ('delete', old.rowid, old.title, old.body, old.kind);
END;

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  relation TEXT NOT NULL DEFAULT 'flow',
  color TEXT NOT NULL DEFAULT '#8290ad'
);

CREATE INDEX IF NOT EXISTS idx_connections_project ON connections(project_id);
CREATE INDEX IF NOT EXISTS idx_connections_from ON connections(from_node_id);
CREATE INDEX IF NOT EXISTS idx_connections_to ON connections(to_node_id);

CREATE TABLE IF NOT EXISTS session_progress (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK(state IN ('pending', 'active', 'completed')),
  visited_at INTEGER NOT NULL,
  PRIMARY KEY(project_id, node_id)
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  node_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  thumbnail_path TEXT,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS music_folders (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  last_scanned_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS music_tracks (
  id TEXT PRIMARY KEY,
  folder_id TEXT REFERENCES music_folders(id) ON DELETE CASCADE,
  path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Sem categoria',
  duration_seconds REAL,
  modified_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_music_category ON music_tracks(category, title);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS change_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT,
  created_at INTEGER NOT NULL
);
