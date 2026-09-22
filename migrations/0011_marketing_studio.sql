PRAGMA foreign_keys = ON;

ALTER TABLE campaigns ADD COLUMN objective TEXT NOT NULL DEFAULT 'sales';
ALTER TABLE campaigns ADD COLUMN budget_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN starts_at TEXT;
ALTER TABLE campaigns ADD COLUMN ends_at TEXT;
ALTER TABLE campaigns ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE campaigns ADD COLUMN notes TEXT;

CREATE TABLE IF NOT EXISTS marketing_short_links (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  campaign_id TEXT REFERENCES campaigns(id),
  slug TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_clicked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_marketing_short_links_author ON marketing_short_links(author_id,book_id,created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_campaign_costs (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  label TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  source TEXT NOT NULL DEFAULT 'manual',
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marketing_costs_campaign ON marketing_campaign_costs(campaign_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS marketing_launch_kits (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  book_id TEXT NOT NULL REFERENCES books(id),
  campaign_id TEXT REFERENCES campaigns(id),
  objective TEXT NOT NULL DEFAULT 'launch',
  kit_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_launch_kits_book ON marketing_launch_kits(author_id,book_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS marketing_recommendations (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  book_id TEXT REFERENCES books(id),
  recommendation_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  evidence_json TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dismissed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_marketing_recommendations_author ON marketing_recommendations(author_id,status,priority DESC,created_at DESC);
