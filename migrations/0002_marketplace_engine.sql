PRAGMA foreign_keys = ON;

-- Shared YasReady account identity: Marketplace never owns passwords.
CREATE UNIQUE INDEX IF NOT EXISTS idx_authors_user_id_unique ON authors(user_id) WHERE user_id IS NOT NULL;
ALTER TABLE authors ADD COLUMN handle TEXT;
ALTER TABLE authors ADD COLUMN bio TEXT;
ALTER TABLE authors ADD COLUMN avatar_url TEXT;
ALTER TABLE authors ADD COLUMN website_url TEXT;
ALTER TABLE authors ADD COLUMN marketplace_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE authors ADD COLUMN last_seen_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_authors_handle_unique ON authors(handle) WHERE handle IS NOT NULL;

-- The public sale record sits above editions so one Book can expose every format.
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL UNIQUE REFERENCES books(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','live','unlisted','paused')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','direct','private')),
  seo_title TEXT,
  seo_description TEXT,
  share_image_url TEXT,
  featured_rank INTEGER,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status, visibility, published_at);

-- Optional provider purchase URLs let physical editions use Share & Sell before deep CDF/EDI access.
ALTER TABLE editions ADD COLUMN provider_purchase_url TEXT;
ALTER TABLE editions ADD COLUMN provider_cost_minor INTEGER;
ALTER TABLE editions ADD COLUMN weight_ounces REAL;
ALTER TABLE editions ADD COLUMN last_inventory_sync_at TEXT;

-- Digital delivery can later unlock ebook/audiobook purchases without changing the order model.
CREATE TABLE IF NOT EXISTS customer_entitlements (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  edition_id TEXT NOT NULL REFERENCES editions(id),
  order_item_id TEXT NOT NULL UNIQUE REFERENCES order_items(id),
  entitlement_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_entitlements_customer ON customer_entitlements(customer_id, status);

-- Stripe/provider webhook replay safety. Raw payloads are intentionally not stored by default.
CREATE TABLE IF NOT EXISTS provider_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  processing_status TEXT NOT NULL DEFAULT 'received',
  received_at TEXT NOT NULL,
  processed_at TEXT,
  error_summary TEXT,
  UNIQUE(provider, external_event_id)
);

-- Marketing assets are generated from Marketplace URLs, not copied from a third-party checkout URL.
CREATE TABLE IF NOT EXISTS marketing_assets (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  campaign_id TEXT REFERENCES campaigns(id),
  asset_type TEXT NOT NULL,
  label TEXT,
  config_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_marketing_assets_author ON marketing_assets(author_id, book_id);

-- One-way future Publishing handoff. Disabled until Publishing is intentionally connected.
CREATE TABLE IF NOT EXISTS publishing_imports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  publishing_source_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  received_at TEXT NOT NULL,
  applied_at TEXT,
  error_summary TEXT,
  UNIQUE(publishing_source_id, payload_hash)
);

-- Precomputed export runs create an auditable seam for Business | YasReady later.
CREATE TABLE IF NOT EXISTS business_export_runs (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  summary_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_business_exports_author ON business_export_runs(author_id, generated_at);

-- Reviews are Marketplace-owned consumer signals, independent from retailer reviews.
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id),
  customer_id TEXT REFERENCES customers(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  verified_purchase INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_reviews_book ON reviews(book_id, status, published_at);
