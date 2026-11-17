-- Web CAD model registry schema v1 — 2026-11-17.
-- This schema establishes metadata integrity, not a full identity/ACL implementation.
PRAGMA foreign_keys = ON;
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  current_revision INTEGER NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_revisions (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  document_sha256 TEXT NOT NULL CHECK (length(document_sha256) = 64),
  artifact_object_key TEXT NOT NULL,
  kernel_version TEXT,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (document_id, revision)
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY,
  sha256 TEXT NOT NULL UNIQUE CHECK (length(sha256) = 64),
  object_key TEXT NOT NULL UNIQUE,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  format TEXT NOT NULL CHECK (format IN ('CADJSON','STEP','STL','GLB','GLTF','DXF','SVG','3MF','PNG','JPEG','OTHER')),
  mime_type TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','valid','invalid','quarantined')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS model_listings (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  author_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scanning','validating','review','published','deprecated','quarantined')),
  capability_class TEXT NOT NULL DEFAULT 'MESH_ONLY' CHECK (capability_class IN ('MESH_ONLY','EXACT_IMPORTED','PARAMETRIC_NATIVE')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS model_releases (
  id INTEGER PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES model_listings(id) ON DELETE RESTRICT,
  version TEXT NOT NULL,
  source_document_id INTEGER REFERENCES documents(id) ON DELETE RESTRICT,
  source_revision INTEGER CHECK (source_revision >= 0),
  manifest_sha256 TEXT NOT NULL CHECK (length(manifest_sha256) = 64),
  license_snapshot TEXT NOT NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (listing_id,version)
);

CREATE TABLE IF NOT EXISTS release_assets (
  release_id INTEGER NOT NULL REFERENCES model_releases(id) ON DELETE RESTRICT,
  asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('source','preview','thumbnail','export')),
  PRIMARY KEY (release_id,asset_id,role)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS listing_tags (
  listing_id INTEGER NOT NULL REFERENCES model_listings(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(listing_id,tag_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  requested_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  document_id INTEGER REFERENCES documents(id) ON DELETE RESTRICT,
  source_revision INTEGER CHECK (source_revision >= 0),
  operation TEXT NOT NULL CHECK (operation IN ('import','export','thumbnail','validate')),
  target_format TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','validating','completed','failed','cancelled')),
  input_asset_id INTEGER REFERENCES assets(id) ON DELETE RESTRICT,
  output_asset_id INTEGER REFERENCES assets(id) ON DELETE RESTRICT,
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_grants (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  agent_principal_id TEXT NOT NULL,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actions_json TEXT NOT NULL CHECK (json_valid(actions_json)),
  document_ids_json TEXT NOT NULL CHECK (json_valid(document_ids_json)),
  max_commits INTEGER NOT NULL DEFAULT 0 CHECK (max_commits >= 0),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_previews (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  grant_id INTEGER NOT NULL REFERENCES agent_grants(id) ON DELETE RESTRICT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
  base_revision INTEGER NOT NULL CHECK (base_revision >= 0),
  commands_sha256 TEXT NOT NULL CHECK (length(commands_sha256) = 64),
  candidate_sha256 TEXT NOT NULL CHECK (length(candidate_sha256) = 64),
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'previewed' CHECK (status IN ('previewed','approved','rejected','committed','expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('accepted','rejected','failed')),
  request_id TEXT,
  metadata_json TEXT CHECK (metadata_json IS NULL OR json_valid(metadata_json)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_docs_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_revisions_document ON document_revisions(document_id,revision DESC);
CREATE INDEX IF NOT EXISTS idx_listings_public ON model_listings(visibility,status,category,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_releases_listing ON model_releases(listing_id,published_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status,created_at);
CREATE INDEX IF NOT EXISTS idx_grants_principal ON agent_grants(agent_principal_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_events(resource_type,resource_id,created_at);

CREATE VIRTUAL TABLE IF NOT EXISTS model_listings_fts USING fts5(
  title, description, category,
  content='model_listings', content_rowid='id', tokenize='unicode61'
);
CREATE TRIGGER IF NOT EXISTS model_listings_ai AFTER INSERT ON model_listings BEGIN
  INSERT INTO model_listings_fts(rowid,title,description,category)
  VALUES(new.id,new.title,new.description,new.category);
END;
CREATE TRIGGER IF NOT EXISTS model_listings_ad AFTER DELETE ON model_listings BEGIN
  INSERT INTO model_listings_fts(model_listings_fts,rowid,title,description,category)
  VALUES('delete',old.id,old.title,old.description,old.category);
END;
CREATE TRIGGER IF NOT EXISTS model_listings_au AFTER UPDATE ON model_listings BEGIN
  INSERT INTO model_listings_fts(model_listings_fts,rowid,title,description,category)
  VALUES('delete',old.id,old.title,old.description,old.category);
  INSERT INTO model_listings_fts(rowid,title,description,category)
  VALUES(new.id,new.title,new.description,new.category);
END;

-- Immutable releases; a new release is required for new content.
CREATE TRIGGER IF NOT EXISTS model_releases_no_update BEFORE UPDATE ON model_releases
BEGIN SELECT RAISE(ABORT,'published releases are immutable'); END;
CREATE TRIGGER IF NOT EXISTS model_releases_no_delete BEFORE DELETE ON model_releases
BEGIN SELECT RAISE(ABORT,'published releases cannot be deleted'); END;

INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
COMMIT;
