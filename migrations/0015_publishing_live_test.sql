PRAGMA foreign_keys = ON;

-- v0.13.0 Publishing Handshake Live Test
-- Existing-book production updates are staged for author review instead of mutating a live catalog silently.
CREATE TABLE IF NOT EXISTS publishing_update_reviews (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL UNIQUE REFERENCES publishing_imports(id),
  publishing_book_link_id TEXT NOT NULL REFERENCES publishing_book_links(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  author_id TEXT NOT NULL REFERENCES authors(id),
  source_revision TEXT,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  diff_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','rejected','superseded')),
  received_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by_user_id TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_publishing_update_reviews_author ON publishing_update_reviews(author_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publishing_update_reviews_book ON publishing_update_reviews(book_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS publishing_handshake_test_runs (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'local',
  target_url TEXT,
  source_book_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('running','passed','failed','partial')),
  scenarios_json TEXT NOT NULL,
  result_json TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_publishing_handshake_test_runs_status ON publishing_handshake_test_runs(status,started_at DESC);

CREATE TABLE IF NOT EXISTS publishing_handshake_test_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES publishing_handshake_test_runs(id),
  scenario_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('passed','failed','skipped')),
  detail TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_publishing_handshake_test_events_run ON publishing_handshake_test_events(run_id,created_at);
