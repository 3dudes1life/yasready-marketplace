PRAGMA foreign_keys = ON;

-- v0.12.0 Ingram Operations Closure: operational truth around mappings, cost freshness,
-- reconciliation, dead-letter repair and production-readiness evidence.

ALTER TABLE provider_dead_letters ADD COLUMN author_id TEXT REFERENCES authors(id);
ALTER TABLE provider_dead_letters ADD COLUMN book_id TEXT REFERENCES books(id);
ALTER TABLE provider_dead_letters ADD COLUMN edition_id TEXT REFERENCES editions(id);
ALTER TABLE provider_dead_letters ADD COLUMN order_id TEXT REFERENCES orders(id);
ALTER TABLE provider_dead_letters ADD COLUMN resolution_code TEXT;
ALTER TABLE provider_dead_letters ADD COLUMN resolved_by TEXT;

ALTER TABLE provider_invoices ADD COLUMN reconciliation_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE provider_invoices ADD COLUMN reconciled_at TEXT;
ALTER TABLE provider_invoices ADD COLUMN variance_minor INTEGER;
ALTER TABLE provider_invoice_lines ADD COLUMN expected_amount_minor INTEGER;
ALTER TABLE provider_invoice_lines ADD COLUMN variance_minor INTEGER;
ALTER TABLE provider_invoice_lines ADD COLUMN reconciliation_status TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS provider_title_mappings (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'ingram',
  edition_id TEXT NOT NULL REFERENCES editions(id),
  isbn TEXT NOT NULL,
  provider_title_id TEXT,
  provider_sku TEXT,
  mapping_status TEXT NOT NULL DEFAULT 'unverified' CHECK(mapping_status IN ('unverified','verified','stale','error')),
  source TEXT NOT NULL DEFAULT 'manual',
  source_reference TEXT,
  unit_cost_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  cost_captured_at TEXT,
  metadata_verified_at TEXT,
  inventory_verified_at TEXT,
  last_verified_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider,edition_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_title_mappings_isbn ON provider_title_mappings(provider,isbn);
CREATE INDEX IF NOT EXISTS idx_provider_title_mappings_status ON provider_title_mappings(provider,mapping_status,updated_at DESC);

CREATE TABLE IF NOT EXISTS provider_cost_refresh_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'ingram',
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','completed_with_exceptions','failed')),
  source_reference TEXT,
  rows_seen INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  rows_unmatched INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  error_summary TEXT,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_cost_refresh_runs ON provider_cost_refresh_runs(provider,started_at DESC);

CREATE TABLE IF NOT EXISTS provider_reconciliation_cases (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'ingram',
  case_type TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id),
  order_item_id TEXT REFERENCES order_items(id),
  provider_invoice_id TEXT REFERENCES provider_invoices(id),
  external_reference TEXT,
  expected_minor INTEGER,
  actual_minor INTEGER,
  variance_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('info','warning','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','review','resolved','ignored')),
  detail TEXT,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolved_by TEXT,
  resolution_note TEXT,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_reconciliation_open ON provider_reconciliation_cases(provider,status,opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_reconciliation_order ON provider_reconciliation_cases(order_id,opened_at DESC);

CREATE TABLE IF NOT EXISTS provider_dead_letter_events (
  id TEXT PRIMARY KEY,
  dead_letter_id TEXT NOT NULL REFERENCES provider_dead_letters(id),
  provider TEXT NOT NULL DEFAULT 'ingram',
  action TEXT NOT NULL CHECK(action IN ('created','retry','resolve','ignore','reopened')),
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  note TEXT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_dead_letter_events ON provider_dead_letter_events(dead_letter_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS provider_readiness_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'ingram',
  operations_schema TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('not_ready','prepared','live_ready')),
  passed_required INTEGER NOT NULL DEFAULT 0,
  total_required INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_readiness_runs ON provider_readiness_runs(provider,completed_at DESC);

CREATE TABLE IF NOT EXISTS provider_readiness_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES provider_readiness_runs(id),
  check_code TEXT NOT NULL,
  label TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1,
  passed INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  evidence_json TEXT,
  UNIQUE(run_id,check_code)
);

UPDATE fulfillment_jobs SET bridge_version='0.12.0' WHERE provider='ingram';
