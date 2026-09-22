PRAGMA foreign_keys = ON;

-- Marketplace-owned presentation overrides preserve Publishing production truth.
ALTER TABLE listings ADD COLUMN display_title TEXT;
ALTER TABLE listings ADD COLUMN display_subtitle TEXT;
ALTER TABLE listings ADD COLUMN description_override TEXT;
ALTER TABLE listings ADD COLUMN long_description_override TEXT;
ALTER TABLE listings ADD COLUMN cover_override_url TEXT;
ALTER TABLE listings ADD COLUMN category_override TEXT;
ALTER TABLE listings ADD COLUMN excerpt TEXT;
ALTER TABLE listings ADD COLUMN editor_revision INTEGER NOT NULL DEFAULT 0;
ALTER TABLE listings ADD COLUMN last_saved_at TEXT;
ALTER TABLE listings ADD COLUMN scheduled_live_at TEXT;

ALTER TABLE authors ADD COLUMN storefront_tagline TEXT;
ALTER TABLE authors ADD COLUMN profile_revision INTEGER NOT NULL DEFAULT 0;

-- Autosave never writes directly into the live listing. One working draft per book.
CREATE TABLE IF NOT EXISTS catalog_drafts (
  book_id TEXT PRIMARY KEY REFERENCES books(id),
  author_id TEXT NOT NULL REFERENCES authors(id),
  draft_revision INTEGER NOT NULL DEFAULT 0,
  base_listing_revision INTEGER NOT NULL DEFAULT 0,
  base_author_revision INTEGER NOT NULL DEFAULT 0,
  draft_json TEXT NOT NULL,
  validation_json TEXT,
  status TEXT NOT NULL DEFAULT 'working' CHECK(status IN ('working','applied','discarded')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_catalog_drafts_author ON catalog_drafts(author_id,updated_at);

CREATE TABLE IF NOT EXISTS catalog_change_history (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  listing_revision INTEGER NOT NULL,
  change_type TEXT NOT NULL,
  changed_fields_json TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_history_book ON catalog_change_history(book_id,created_at DESC);

CREATE TABLE IF NOT EXISTS catalog_validation_runs (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  draft_revision INTEGER NOT NULL,
  valid INTEGER NOT NULL DEFAULT 0,
  errors_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_validation_book ON catalog_validation_runs(book_id,created_at DESC);
