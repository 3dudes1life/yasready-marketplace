PRAGMA foreign_keys = ON;

-- v0.3.0 operational controls and reconciliation history.
ALTER TABLE orders ADD COLUMN checkout_provider TEXT;
ALTER TABLE orders ADD COLUMN checkout_provider_reference TEXT;
ALTER TABLE orders ADD COLUMN last_reconciled_at TEXT;
ALTER TABLE orders ADD COLUMN fulfillment_locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN fulfillment_cancel_requested INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN commerce_version TEXT NOT NULL DEFAULT '0.3.0';
ALTER TABLE order_items ADD COLUMN disputed_minor INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  status_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  source TEXT NOT NULL,
  source_reference TEXT,
  occurred_at TEXT NOT NULL,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_status_history ON order_status_history(order_id, occurred_at);

CREATE TABLE IF NOT EXISTS commerce_exceptions (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  order_item_id TEXT REFERENCES order_items(id),
  author_id TEXT REFERENCES authors(id),
  provider TEXT,
  code TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  detail TEXT,
  provider_reference TEXT,
  opened_at TEXT NOT NULL,
  acknowledged_at TEXT,
  resolved_at TEXT,
  resolution_note TEXT,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_commerce_exceptions_open ON commerce_exceptions(status, severity, opened_at);
CREATE INDEX IF NOT EXISTS idx_commerce_exceptions_author ON commerce_exceptions(author_id, status, opened_at);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  reconciliation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  rows_seen INTEGER NOT NULL DEFAULT 0,
  rows_matched INTEGER NOT NULL DEFAULT 0,
  rows_exception INTEGER NOT NULL DEFAULT 0,
  summary_json TEXT
);

CREATE TABLE IF NOT EXISTS reconciliation_items (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES reconciliation_runs(id),
  order_id TEXT REFERENCES orders(id),
  order_item_id TEXT REFERENCES order_items(id),
  provider_reference TEXT,
  status TEXT NOT NULL,
  expected_minor INTEGER,
  actual_minor INTEGER,
  difference_minor INTEGER,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS settlement_holds (
  id TEXT PRIMARY KEY,
  settlement_allocation_id TEXT NOT NULL REFERENCES settlement_allocations(id),
  author_id TEXT NOT NULL REFERENCES authors(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  reason_code TEXT NOT NULL,
  amount_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  opened_at TEXT NOT NULL,
  released_at TEXT,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_settlement_holds_active ON settlement_holds(settlement_allocation_id, status);

CREATE TABLE IF NOT EXISTS shipment_packages (
  id TEXT PRIMARY KEY,
  fulfillment_job_id TEXT NOT NULL REFERENCES fulfillment_jobs(id),
  provider TEXT NOT NULL,
  provider_package_id TEXT,
  carrier TEXT,
  service_level TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  status TEXT,
  shipped_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shipment_job ON shipment_packages(fulfillment_job_id, created_at);

CREATE TABLE IF NOT EXISTS provider_cost_snapshots (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id),
  order_item_id TEXT REFERENCES order_items(id),
  cost_type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  source_reference TEXT,
  captured_at TEXT NOT NULL,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_costs_order ON provider_cost_snapshots(order_id, captured_at);

CREATE TABLE IF NOT EXISTS tax_snapshots (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  amount_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT,
  source_reference TEXT,
  captured_at TEXT NOT NULL,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS customer_receipt_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  event_type TEXT NOT NULL,
  channel TEXT,
  destination_hash TEXT,
  occurred_at TEXT NOT NULL,
  provider_reference TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS connected_account_events (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  provider TEXT NOT NULL,
  external_account_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT,
  occurred_at TEXT NOT NULL,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_connected_events_author ON connected_account_events(author_id, occurred_at);

CREATE TABLE IF NOT EXISTS provider_capability_snapshots (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  capability TEXT NOT NULL,
  availability TEXT NOT NULL,
  source_label TEXT,
  captured_at TEXT NOT NULL,
  metadata_json TEXT
);
