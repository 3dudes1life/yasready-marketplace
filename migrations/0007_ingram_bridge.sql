PRAGMA foreign_keys = ON;

-- v0.4.0 Ingram Bridge: contract-safe provider operations around the Commerce Closure ledger.
ALTER TABLE fulfillment_jobs ADD COLUMN provider_account_ref TEXT;
ALTER TABLE fulfillment_jobs ADD COLUMN submission_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE fulfillment_jobs ADD COLUMN next_retry_at TEXT;
ALTER TABLE fulfillment_jobs ADD COLUMN last_error_code TEXT;
ALTER TABLE fulfillment_jobs ADD COLUMN last_error_detail TEXT;
ALTER TABLE fulfillment_jobs ADD COLUMN acknowledged_at TEXT;
ALTER TABLE fulfillment_jobs ADD COLUMN shipped_at TEXT;
ALTER TABLE fulfillment_jobs ADD COLUMN delivered_at TEXT;
ALTER TABLE fulfillment_jobs ADD COLUMN invoice_reference TEXT;
ALTER TABLE fulfillment_jobs ADD COLUMN bridge_version TEXT NOT NULL DEFAULT '0.4.0';

CREATE TABLE IF NOT EXISTS fulfillment_attempts (
  id TEXT PRIMARY KEY,
  fulfillment_job_id TEXT NOT NULL REFERENCES fulfillment_jobs(id),
  provider TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  transport TEXT NOT NULL,
  request_document_id TEXT REFERENCES provider_documents(id),
  response_document_id TEXT REFERENCES provider_documents(id),
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  next_retry_at TEXT,
  error_code TEXT,
  error_detail TEXT,
  metadata_json TEXT,
  UNIQUE(fulfillment_job_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_fulfillment_attempts_job ON fulfillment_attempts(fulfillment_job_id, attempt_number DESC);

CREATE TABLE IF NOT EXISTS provider_sync_cursors (
  provider TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  cursor_value TEXT,
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_run_id TEXT REFERENCES provider_sync_runs(id),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(provider, sync_type)
);

CREATE TABLE IF NOT EXISTS provider_inventory_snapshots (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  isbn TEXT NOT NULL,
  provider_sku TEXT,
  availability TEXT NOT NULL,
  raw_availability TEXT,
  on_hand INTEGER,
  unit_cost_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  source_reference TEXT,
  captured_at TEXT NOT NULL,
  payload_json TEXT,
  UNIQUE(provider, isbn, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_provider_inventory_lookup ON provider_inventory_snapshots(provider, isbn, captured_at DESC);

CREATE TABLE IF NOT EXISTS provider_metadata_snapshots (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  isbn TEXT NOT NULL,
  title TEXT,
  author TEXT,
  publisher TEXT,
  imprint TEXT,
  format TEXT,
  cover_url TEXT,
  publication_date TEXT,
  source_reference TEXT,
  captured_at TEXT NOT NULL,
  payload_json TEXT,
  UNIQUE(provider, isbn, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_provider_metadata_lookup ON provider_metadata_snapshots(provider, isbn, captured_at DESC);

CREATE TABLE IF NOT EXISTS provider_invoices (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_invoice_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  invoice_date TEXT,
  currency TEXT NOT NULL DEFAULT 'usd',
  subtotal_minor INTEGER,
  shipping_minor INTEGER,
  tax_minor INTEGER,
  total_minor INTEGER,
  status TEXT NOT NULL DEFAULT 'received',
  received_at TEXT NOT NULL,
  payload_json TEXT,
  UNIQUE(provider, external_invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_invoices_order ON provider_invoices(order_id, received_at);

CREATE TABLE IF NOT EXISTS provider_invoice_lines (
  id TEXT PRIMARY KEY,
  provider_invoice_id TEXT NOT NULL REFERENCES provider_invoices(id),
  line_number INTEGER NOT NULL,
  order_item_id TEXT REFERENCES order_items(id),
  isbn TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_minor INTEGER,
  shipping_minor INTEGER,
  tax_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  metadata_json TEXT,
  UNIQUE(provider_invoice_id, line_number)
);

CREATE TABLE IF NOT EXISTS provider_dead_letters (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  record_type TEXT NOT NULL,
  external_reference TEXT,
  reason_code TEXT NOT NULL,
  reason_detail TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  payload_json TEXT,
  resolved_at TEXT,
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_dead_letters_open ON provider_dead_letters(provider, status, first_seen_at);

INSERT OR REPLACE INTO provider_connections(provider,mode,connection_status,capabilities_json,updated_at)
VALUES ('ingram','off','not_configured','["share_sell_fallback","metadata_feed","inventory_feed","cdf_edi","provider_documents","sales_reports","invoice_import","retry_dead_letter","fulfillment_health"]',CURRENT_TIMESTAMP);
