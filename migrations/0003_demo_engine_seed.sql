-- Demo/private-beta seed only. Replace/remove when real shared-account imports are enabled.
INSERT OR IGNORE INTO authors (id,user_id,display_name,email,handle,bio,marketplace_status)
VALUES
  ('william','demo-user-william','William T. Zakrajshek','demo@yasready.local','william-zakrajshek','Author of Tres Amigos, Una Vida.','active'),
  ('jordan','demo-user-jordan','Jordan Reyes','jordan@example.test','jordan-reyes','Fiction author used to prove multi-seller marketplace flows.','active');

INSERT OR IGNORE INTO books (id,author_id,publishing_source_id,slug,title,subtitle,description,long_description,primary_category,status)
VALUES
 ('taul-1','william','publishing-demo-book-1','tres-amigos-una-vida','Tres Amigos, Una Vida','A Throuple Love Story','Three lives collide across friendship, love, reinvention, and the messy work of building a life that does not follow the usual rules.','A relationship-first contemporary story about Michael, Juan, and Christopher as friendship becomes something larger, complicated, and worth fighting for.','LGBTQ+ Romance','live'),
 ('taul-2','william','publishing-demo-book-2','fault-lines','Fault Lines','Tres Amigos, Una Vida — Book Two','Love survives the easy moments. Fault Lines asks what happens when the ground underneath all three of them begins to move.','Book Two pushes the relationship into sharper territory: distance, family, fear, repair, and whether choosing each other is enough when everything around them changes.','LGBTQ+ Romance','live'),
 ('demo-3','jordan',NULL,'the-long-way-home','The Long Way Home','A Novel','A warm, character-driven story about returning home and discovering the place you left has been changing too.','A fictional marketplace title used to prove multi-author cart, attribution, payouts, and reporting.','Contemporary Fiction','live');

INSERT OR IGNORE INTO listings (id,book_id,status,visibility,seo_title,seo_description,published_at)
VALUES
 ('listing-taul-1','taul-1','live','public','Tres Amigos, Una Vida | YasReady','Shop Tres Amigos, Una Vida in available formats on Marketplace | YasReady',CURRENT_TIMESTAMP),
 ('listing-taul-2','taul-2','live','public','Fault Lines | YasReady','Shop Fault Lines in available formats on Marketplace | YasReady',CURRENT_TIMESTAMP),
 ('listing-demo-3','demo-3','live','public','The Long Way Home | YasReady','Shop The Long Way Home on Marketplace | YasReady',CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO editions (id,book_id,format,isbn,currency,price_minor,status,fulfillment_provider,provider_title_id,provider_sku,inventory_status,provider_cost_minor)
VALUES
 ('taul1-ebook','taul-1','ebook','9780000000001','usd',599,'live','yasready-digital',NULL,'TAUL1-EBOOK','available',0),
 ('taul1-paper','taul-1','paperback','9780000000002','usd',1699,'live','ingram',NULL,'TAUL1-PAPER','available',500),
 ('taul1-hard','taul-1','hardcover','9780000000003','usd',2499,'live','ingram',NULL,'TAUL1-HARD','available',850),
 ('taul1-audio','taul-1','audiobook',NULL,'usd',999,'draft','yasready-digital',NULL,'TAUL1-AUDIO','preparing',0),
 ('fault-ebook','taul-2','ebook','9780000000011','usd',599,'live','yasready-digital',NULL,'FAULT-EBOOK','available',0),
 ('fault-paper','taul-2','paperback','9780000000012','usd',1799,'live','ingram',NULL,'FAULT-PAPER','available',525),
 ('fault-hard','taul-2','hardcover','9780000000013','usd',2599,'draft','ingram',NULL,'FAULT-HARD','preparing',875),
 ('fault-audio','taul-2','audiobook',NULL,'usd',999,'draft','yasready-digital',NULL,'FAULT-AUDIO','planned',0),
 ('long-ebook','demo-3','ebook','9780000000021','usd',499,'live','yasready-digital',NULL,'LONG-EBOOK','available',0),
 ('long-paper','demo-3','paperback','9780000000022','usd',1599,'live','ingram',NULL,'LONG-PAPER','available',475),
 ('long-audio','demo-3','audiobook',NULL,'usd',1199,'live','yasready-digital',NULL,'LONG-AUDIO','available',0);
