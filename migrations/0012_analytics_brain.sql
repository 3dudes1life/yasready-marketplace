-- Marketplace | YasReady v0.10.0 — Analytics Brain
CREATE TABLE IF NOT EXISTS analytics_brain_runs (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  period_days INTEGER NOT NULL DEFAULT 30,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  brain_version TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(author_id) REFERENCES authors(id)
);
CREATE INDEX IF NOT EXISTS idx_analytics_brain_runs_author ON analytics_brain_runs(author_id,created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_signal_state (
  author_id TEXT NOT NULL,
  signal_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  dismissed_at TEXT,
  snoozed_until TEXT,
  note TEXT,
  PRIMARY KEY(author_id,signal_key),
  FOREIGN KEY(author_id) REFERENCES authors(id)
);
CREATE INDEX IF NOT EXISTS idx_analytics_signal_state_status ON analytics_signal_state(author_id,status,last_seen_at DESC);

CREATE TABLE IF NOT EXISTS analytics_daily_rollups (
  author_id TEXT NOT NULL,
  metric_date TEXT NOT NULL,
  book_id TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  orders INTEGER NOT NULL DEFAULT 0,
  units INTEGER NOT NULL DEFAULT 0,
  gross_minor INTEGER NOT NULL DEFAULT 0,
  refunds_minor INTEGER NOT NULL DEFAULT 0,
  marketplace_fees_minor INTEGER NOT NULL DEFAULT 0,
  processor_fees_minor INTEGER NOT NULL DEFAULT 0,
  fulfillment_cost_minor INTEGER NOT NULL DEFAULT 0,
  marketing_spend_minor INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(author_id,metric_date,book_id),
  FOREIGN KEY(author_id) REFERENCES authors(id)
);
