PRAGMA foreign_keys = ON;

-- v0.11: digital ownership becomes the durable bridge between Marketplace and YasReady. Books.
ALTER TABLE customer_entitlements ADD COLUMN source TEXT NOT NULL DEFAULT 'marketplace_order';
ALTER TABLE customer_entitlements ADD COLUMN updated_at TEXT;
ALTER TABLE customer_entitlements ADD COLUMN revocation_reason TEXT;

-- Cross-device progress needs optimistic concurrency so a stale phone/tablet cannot silently move a reader backwards.
ALTER TABLE reader_progress ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE reader_progress ADD COLUMN source_device_id TEXT;
ALTER TABLE reader_progress ADD COLUMN client_updated_at TEXT;

CREATE TABLE IF NOT EXISTS digital_assets (
  id TEXT PRIMARY KEY,
  edition_id TEXT NOT NULL REFERENCES editions(id),
  asset_kind TEXT NOT NULL CHECK(asset_kind IN ('epub','audiobook_manifest','cover','sample')),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','ready','blocked','retired')),
  storage_reference TEXT,
  checksum_sha256 TEXT,
  content_type TEXT,
  byte_length INTEGER,
  duration_seconds REAL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(edition_id,asset_kind,version)
);
CREATE INDEX IF NOT EXISTS idx_digital_assets_edition ON digital_assets(edition_id,status,version DESC);

-- The future app identifies an install without Marketplace owning a second login system.
CREATE TABLE IF NOT EXISTS books_app_devices (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  installation_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK(platform IN ('ios','android','web','unknown')),
  app_version TEXT,
  os_version TEXT,
  device_model TEXT,
  locale TEXT,
  push_capable INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT,
  UNIQUE(customer_id,installation_id)
);
CREATE INDEX IF NOT EXISTS idx_books_devices_customer ON books_app_devices(customer_id,last_seen_at DESC);

-- Append-only sync cursor for library/progress/save/follow changes. Deletes are represented as tombstone payloads.
CREATE TABLE IF NOT EXISTS books_app_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  change_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  change_kind TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_books_changes_customer_seq ON books_app_changes(customer_id,seq);

CREATE TABLE IF NOT EXISTS books_app_notification_preferences (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id),
  followed_author_releases INTEGER NOT NULL DEFAULT 1,
  library_updates INTEGER NOT NULL DEFAULT 1,
  marketplace_promotions INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Test commerce certification is an operational record, not a switch that can accidentally enable live money.
CREATE TABLE IF NOT EXISTS commerce_test_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'stripe',
  mode TEXT NOT NULL DEFAULT 'test',
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','passed','failed','cancelled')),
  scenarios_json TEXT NOT NULL,
  results_json TEXT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_commerce_test_runs_status ON commerce_test_runs(provider,mode,status,started_at DESC);
