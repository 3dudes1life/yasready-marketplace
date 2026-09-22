PRAGMA foreign_keys = ON;

-- v0.5.0 Publishing Handshake: one-way, provenance-preserving import from Publishing | YasReady.
ALTER TABLE books ADD COLUMN source_revision TEXT;
ALTER TABLE books ADD COLUMN production_sync_status TEXT NOT NULL DEFAULT 'unlinked';
ALTER TABLE books ADD COLUMN production_synced_at TEXT;
ALTER TABLE books ADD COLUMN marketplace_ready_at TEXT;

ALTER TABLE editions ADD COLUMN publishing_source_edition_id TEXT;
ALTER TABLE editions ADD COLUMN production_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE editions ADD COLUMN artifact_ref TEXT;
ALTER TABLE editions ADD COLUMN artifact_hash TEXT;
ALTER TABLE editions ADD COLUMN production_synced_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_editions_publishing_source_unique ON editions(publishing_source_edition_id) WHERE publishing_source_edition_id IS NOT NULL;

ALTER TABLE listings ADD COLUMN author_approved_at TEXT;
ALTER TABLE listings ADD COLUMN last_readiness_check_at TEXT;

ALTER TABLE publishing_imports ADD COLUMN source_revision TEXT;
ALTER TABLE publishing_imports ADD COLUMN book_id TEXT REFERENCES books(id);
ALTER TABLE publishing_imports ADD COLUMN disposition TEXT;
ALTER TABLE publishing_imports ADD COLUMN latest_received_at TEXT;

CREATE TABLE IF NOT EXISTS publishing_book_links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES authors(id),
  book_id TEXT NOT NULL UNIQUE REFERENCES books(id),
  publishing_source_id TEXT NOT NULL UNIQUE,
  source_schema_version TEXT NOT NULL,
  source_revision TEXT,
  latest_payload_hash TEXT NOT NULL,
  production_status TEXT NOT NULL DEFAULT 'received',
  last_received_at TEXT NOT NULL,
  last_applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_publishing_book_links_user ON publishing_book_links(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS publishing_edition_links (
  id TEXT PRIMARY KEY,
  publishing_book_link_id TEXT NOT NULL REFERENCES publishing_book_links(id),
  edition_id TEXT NOT NULL UNIQUE REFERENCES editions(id),
  publishing_source_edition_id TEXT NOT NULL UNIQUE,
  source_revision TEXT,
  production_status TEXT NOT NULL DEFAULT 'received',
  artifact_ref TEXT,
  artifact_hash TEXT,
  last_received_at TEXT NOT NULL,
  last_applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_publishing_edition_links_book ON publishing_edition_links(publishing_book_link_id);

CREATE TABLE IF NOT EXISTS publishing_sync_changes (
  id TEXT PRIMARY KEY,
  import_id TEXT NOT NULL REFERENCES publishing_imports(id),
  book_id TEXT REFERENCES books(id),
  edition_id TEXT REFERENCES editions(id),
  entity_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  ownership TEXT NOT NULL CHECK(ownership IN ('publishing','marketplace')),
  old_value_json TEXT,
  incoming_value_json TEXT,
  disposition TEXT NOT NULL CHECK(disposition IN ('applied','preserved','needs_review','unchanged')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_publishing_changes_book ON publishing_sync_changes(book_id, created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_launch_events (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  action TEXT NOT NULL,
  readiness_json TEXT NOT NULL,
  selected_edition_ids_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marketplace_launch_events_book ON marketplace_launch_events(book_id, created_at DESC);
