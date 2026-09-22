PRAGMA foreign_keys = ON;

-- One YasReady identity can be both an author and a reader/customer.
ALTER TABLE customers ADD COLUMN user_id TEXT;
ALTER TABLE customers ADD COLUMN display_name TEXT;
ALTER TABLE customers ADD COLUMN avatar_url TEXT;
ALTER TABLE customers ADD COLUMN last_seen_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_id_unique ON customers(user_id) WHERE user_id IS NOT NULL;

-- Series metadata is public discovery truth. Future Publishing handoffs may populate it.
ALTER TABLE books ADD COLUMN series_name TEXT;
ALTER TABLE books ADD COLUMN series_number REAL;

CREATE TABLE IF NOT EXISTS customer_saved_books (
  customer_id TEXT NOT NULL REFERENCES customers(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(customer_id,book_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_books_customer ON customer_saved_books(customer_id,created_at DESC);

CREATE TABLE IF NOT EXISTS customer_recent_books (
  customer_id TEXT NOT NULL REFERENCES customers(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  last_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(customer_id,book_id)
);
CREATE INDEX IF NOT EXISTS idx_recent_books_customer ON customer_recent_books(customer_id,last_viewed_at DESC);

CREATE TABLE IF NOT EXISTS reader_progress (
  customer_id TEXT NOT NULL REFERENCES customers(id),
  edition_id TEXT NOT NULL REFERENCES editions(id),
  progress_kind TEXT NOT NULL CHECK(progress_kind IN ('ebook','audiobook')),
  percent REAL NOT NULL DEFAULT 0 CHECK(percent >= 0 AND percent <= 100),
  locator_json TEXT,
  seconds_position REAL,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(customer_id,edition_id)
);
CREATE INDEX IF NOT EXISTS idx_reader_progress_customer ON reader_progress(customer_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS author_follows (
  customer_id TEXT NOT NULL REFERENCES customers(id),
  author_id TEXT NOT NULL REFERENCES authors(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(customer_id,author_id)
);

CREATE TABLE IF NOT EXISTS reader_activity_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id),
  book_id TEXT REFERENCES books(id),
  edition_id TEXT REFERENCES editions(id),
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_reader_activity_customer ON reader_activity_events(customer_id,occurred_at DESC);

-- Demo/private-beta discovery metadata. Safe no-op for production titles.
UPDATE books SET series_name='Tres Amigos, Una Vida',series_number=1 WHERE id='taul-1' AND series_name IS NULL;
UPDATE books SET series_name='Tres Amigos, Una Vida',series_number=2 WHERE id='taul-2' AND series_name IS NULL;
