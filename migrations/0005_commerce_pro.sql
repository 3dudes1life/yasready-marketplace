PRAGMA foreign_keys = ON;

-- v0.3.0 Commerce Pro: durable money, settlement, fulfillment and provider truth.
ALTER TABLE orders ADD COLUMN receipt_token TEXT;
ALTER TABLE orders ADD COLUMN customer_email TEXT;
ALTER TABLE orders ADD COLUMN customer_name TEXT;
ALTER TABLE orders ADD COLUMN shipping_name TEXT;
ALTER TABLE orders ADD COLUMN shipping_phone TEXT;
ALTER TABLE orders ADD COLUMN shipping_address_json TEXT;
ALTER TABLE orders ADD COLUMN provider_amount_subtotal_minor INTEGER;
ALTER TABLE orders ADD COLUMN provider_amount_total_minor INTEGER;
ALTER TABLE orders ADD COLUMN provider_tax_minor INTEGER;
ALTER TABLE orders ADD COLUMN provider_shipping_minor INTEGER;
ALTER TABLE orders ADD COLUMN provider_discount_minor INTEGER;
ALTER TABLE orders ADD COLUMN risk_status TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE orders ADD COLUMN updated_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_receipt_token ON orders(receipt_token) WHERE receipt_token IS NOT NULL;

ALTER TABLE order_items ADD COLUMN refunded_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN transferred_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN settlement_status TEXT NOT NULL DEFAULT 'awaiting_payment';
ALTER TABLE order_items ADD COLUMN stripe_transfer_id TEXT;
ALTER TABLE order_items ADD COLUMN actual_fulfillment_cost_minor INTEGER;
ALTER TABLE order_items ADD COLUMN actual_processor_fee_minor INTEGER;
ALTER TABLE order_items ADD COLUMN updated_at TEXT;

CREATE TABLE IF NOT EXISTS payment_records (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  external_payment_id TEXT NOT NULL,
  external_charge_id TEXT,
  balance_transaction_id TEXT,
  amount_minor INTEGER NOT NULL DEFAULT 0,
  fee_minor INTEGER,
  net_minor INTEGER,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, external_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_payment_records_order ON payment_records(order_id, created_at);

CREATE TABLE IF NOT EXISTS settlement_allocations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  author_id TEXT NOT NULL REFERENCES authors(id),
  currency TEXT NOT NULL DEFAULT 'usd',
  gross_minor INTEGER NOT NULL DEFAULT 0,
  marketplace_fee_minor INTEGER NOT NULL DEFAULT 0,
  processor_fee_minor INTEGER NOT NULL DEFAULT 0,
  fulfillment_cost_minor INTEGER NOT NULL DEFAULT 0,
  refunded_minor INTEGER NOT NULL DEFAULT 0,
  disputed_minor INTEGER NOT NULL DEFAULT 0,
  payable_minor INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'awaiting_payment',
  transfer_group TEXT,
  stripe_transfer_id TEXT,
  last_reconciled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(order_id, author_id)
);
CREATE INDEX IF NOT EXISTS idx_settlement_author ON settlement_allocations(author_id, status, created_at);

CREATE TABLE IF NOT EXISTS transfer_records (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  author_id TEXT NOT NULL REFERENCES authors(id),
  provider TEXT NOT NULL,
  external_transfer_id TEXT NOT NULL,
  source_transaction_id TEXT,
  amount_minor INTEGER NOT NULL,
  reversed_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(provider, external_transfer_id)
);
CREATE INDEX IF NOT EXISTS idx_transfer_author ON transfer_records(author_id, created_at);

CREATE TABLE IF NOT EXISTS refund_records (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL,
  external_refund_id TEXT NOT NULL,
  external_payment_id TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT,
  status TEXT NOT NULL,
  transfer_reversal_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  UNIQUE(provider, external_refund_id)
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refund_records(order_id, created_at);

CREATE TABLE IF NOT EXISTS dispute_records (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  provider TEXT NOT NULL,
  external_dispute_id TEXT NOT NULL,
  external_charge_id TEXT,
  amount_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT,
  status TEXT NOT NULL,
  evidence_due_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata_json TEXT,
  UNIQUE(provider, external_dispute_id)
);
CREATE INDEX IF NOT EXISTS idx_disputes_order ON dispute_records(order_id, status);

CREATE TABLE IF NOT EXISTS fulfillment_events (
  id TEXT PRIMARY KEY,
  fulfillment_job_id TEXT NOT NULL REFERENCES fulfillment_jobs(id),
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  normalized_status TEXT NOT NULL,
  raw_status TEXT,
  provider_event_id TEXT,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  payload_json TEXT,
  UNIQUE(provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_fulfillment_events_job ON fulfillment_events(fulfillment_job_id, occurred_at);

CREATE TABLE IF NOT EXISTS provider_connections (
  provider TEXT PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'off',
  connection_status TEXT NOT NULL DEFAULT 'not_configured',
  capabilities_json TEXT,
  last_verified_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commerce_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id),
  order_item_id TEXT REFERENCES order_items(id),
  provider TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  locked_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_commerce_jobs_ready ON commerce_jobs(status, available_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  order_id TEXT REFERENCES orders(id),
  occurred_at TEXT NOT NULL,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_order ON audit_log(order_id, occurred_at);

CREATE TABLE IF NOT EXISTS provider_documents (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  document_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id),
  external_document_id TEXT,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload_json TEXT,
  UNIQUE(provider, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_provider_docs_order ON provider_documents(provider, order_id, occurred_at);

INSERT OR REPLACE INTO provider_connections(provider,mode,connection_status,capabilities_json,updated_at)
VALUES
 ('stripe','off','not_configured','["checkout","connect_express","separate_charges_transfers","refunds","disputes","webhooks","reconciliation"]',CURRENT_TIMESTAMP),
 ('ingram','off','not_configured','["share_sell_fallback","metadata_feed","inventory_feed","cdf_edi","provider_documents","sales_reports","ips_express_checkout_eligibility"]',CURRENT_TIMESTAMP);
