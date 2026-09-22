PRAGMA foreign_keys = ON;

-- Sales reported by external distribution channels remain separate from native Marketplace checkout.
-- This prevents an Ingram-reported retail sale from being silently treated as a YasReady direct order.
CREATE TABLE IF NOT EXISTS external_channel_sales (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_sale_id TEXT NOT NULL,
  author_id TEXT REFERENCES authors(id),
  book_id TEXT REFERENCES books(id),
  edition_id TEXT REFERENCES editions(id),
  isbn TEXT,
  sale_date TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  gross_minor INTEGER,
  net_minor INTEGER,
  returns_minor INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  channel_name TEXT,
  territory TEXT,
  source_provenance TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  metadata_json TEXT,
  UNIQUE(provider, external_sale_id)
);

CREATE INDEX IF NOT EXISTS idx_external_sales_author_date ON external_channel_sales(author_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_external_sales_isbn ON external_channel_sales(isbn, sale_date);
CREATE INDEX IF NOT EXISTS idx_external_sales_provider ON external_channel_sales(provider, sale_date);
