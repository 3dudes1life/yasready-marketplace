PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  display_name TEXT NOT NULL,
  email TEXT,
  stripe_connected_account_id TEXT,
  stripe_onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  payout_currency TEXT NOT NULL DEFAULT 'usd',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  publishing_source_id TEXT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  long_description TEXT,
  cover_url TEXT,
  primary_category TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS editions (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id),
  format TEXT NOT NULL CHECK(format IN ('ebook','paperback','hardcover','audiobook')),
  isbn TEXT,
  currency TEXT NOT NULL DEFAULT 'usd',
  price_minor INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  fulfillment_provider TEXT NOT NULL DEFAULT 'none',
  provider_title_id TEXT,
  provider_sku TEXT,
  inventory_status TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  book_id TEXT REFERENCES books(id),
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  medium TEXT,
  content TEXT,
  destination_path TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  currency TEXT NOT NULL DEFAULT 'usd',
  subtotal_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL DEFAULT 0,
  shipping_minor INTEGER NOT NULL DEFAULT 0,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  total_minor INTEGER NOT NULL,
  payment_status TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL DEFAULT 'not_started',
  campaign_id TEXT REFERENCES campaigns(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT,
  refunded_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  edition_id TEXT NOT NULL REFERENCES editions(id),
  author_id TEXT NOT NULL REFERENCES authors(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_minor INTEGER NOT NULL,
  gross_minor INTEGER NOT NULL,
  estimated_fulfillment_cost_minor INTEGER,
  stripe_fee_minor INTEGER,
  tax_allocated_minor INTEGER NOT NULL DEFAULT 0,
  marketplace_fee_minor INTEGER NOT NULL DEFAULT 0,
  seller_payable_minor INTEGER NOT NULL DEFAULT 0,
  fulfillment_provider TEXT,
  fulfillment_reference TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  order_item_id TEXT REFERENCES order_items(id),
  author_id TEXT REFERENCES authors(id),
  type TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  external_reference TEXT,
  occurred_at TEXT NOT NULL,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  stripe_transfer_id TEXT UNIQUE,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS fulfillment_jobs (
  id TEXT PRIMARY KEY,
  order_item_id TEXT NOT NULL REFERENCES order_items(id),
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  status TEXT NOT NULL,
  raw_status TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  anonymous_id TEXT,
  user_id TEXT,
  author_id TEXT,
  book_id TEXT,
  edition_id TEXT,
  order_id TEXT,
  campaign_id TEXT,
  source TEXT,
  medium TEXT,
  occurred_at TEXT NOT NULL,
  properties_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_book_time ON marketplace_events(book_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_campaign_time ON marketplace_events(campaign_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_items_author ON order_items(author_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_author ON ledger_entries(author_id, occurred_at);

CREATE TABLE IF NOT EXISTS provider_sync_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  cursor_value TEXT,
  rows_seen INTEGER NOT NULL DEFAULT 0,
  rows_written INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);
