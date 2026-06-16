PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  vcs_type TEXT NOT NULL DEFAULT 'none' CHECK (vcs_type IN ('git', 'none')),
  remote_url TEXT,
  last_commit_at TEXT,
  last_opened_at TEXT,
  archive_completeness INTEGER NOT NULL DEFAULT 0 CHECK (archive_completeness BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL UNIQUE,
  md_path TEXT NOT NULL,
  sections_state TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('local_file', 'local_dir', 'link')),
  title TEXT NOT NULL,
  path_or_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS git_cache (
  project_id INTEGER PRIMARY KEY,
  branch TEXT,
  ahead INTEGER NOT NULL DEFAULT 0 CHECK (ahead >= 0),
  behind INTEGER NOT NULL DEFAULT 0 CHECK (behind >= 0),
  dirty INTEGER NOT NULL DEFAULT 0 CHECK (dirty IN (0, 1)),
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS project_tags (
  project_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (project_id, tag_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('claude', 'chatgpt', 'claude_code', 'codex')),
  kind TEXT NOT NULL CHECK (kind IN ('link', 'import')),
  url_or_file TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_last_opened_at ON projects(last_opened_at);
CREATE INDEX IF NOT EXISTS idx_projects_last_commit_at ON projects(last_commit_at);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tags_tag_id ON project_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_chat_links_project_id ON chat_links(project_id);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('scan_roots', '[]'),
  ('theme', 'dark'),
  ('editor_cmd', 'code'),
  ('deepseek_api_key', '');
