PRAGMA foreign_keys = ON;

-- Marketplace | YasReady v0.14.0 — Business Intelligence Bridge
-- Business consumes a versioned, incremental commercial feed rather than querying Marketplace tables.
CREATE TABLE IF NOT EXISTS business_sync_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  change_id TEXT NOT NULL UNIQUE,
  author_id TEXT NOT NULL REFERENCES authors(id),
  event_type TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  occurred_at TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_business_sync_author_seq ON business_sync_events(author_id,seq);
CREATE INDEX IF NOT EXISTS idx_business_sync_author_time ON business_sync_events(author_id,occurred_at);

CREATE TABLE IF NOT EXISTS business_sync_consumers (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  consumer_key TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(author_id,consumer_key)
);
CREATE INDEX IF NOT EXISTS idx_business_consumers_author ON business_sync_consumers(author_id,status,updated_at DESC);

CREATE TABLE IF NOT EXISTS business_sync_runs (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES authors(id),
  consumer_key TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  from_sequence INTEGER NOT NULL DEFAULT 0,
  through_sequence INTEGER NOT NULL DEFAULT 0,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  acknowledged_at TEXT,
  summary_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_business_sync_runs_author ON business_sync_runs(author_id,generated_at DESC);

-- Money truth. Ledger entries are append-only and are the safest incremental source.
CREATE TRIGGER IF NOT EXISTS trg_business_ledger_insert
AFTER INSERT ON ledger_entries
WHEN NEW.author_id IS NOT NULL
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'ledger.inserted', 'ledger_entry', NEW.id, NEW.occurred_at,
    json_object('type',NEW.type,'amountMinor',NEW.amount_minor,'currency',NEW.currency,'orderId',NEW.order_id,'orderItemId',NEW.order_item_id,'editionId',(SELECT edition_id FROM order_items WHERE id=NEW.order_item_id),'bookId',(SELECT e.book_id FROM order_items oi JOIN editions e ON e.id=oi.edition_id WHERE oi.id=NEW.order_item_id),'format',(SELECT e.format FROM order_items oi JOIN editions e ON e.id=oi.edition_id WHERE oi.id=NEW.order_item_id),'quantity',(SELECT quantity FROM order_items WHERE id=NEW.order_item_id),'campaignId',(SELECT campaign_id FROM orders WHERE id=NEW.order_id),'externalReference',NEW.external_reference)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_settlement_insert
AFTER INSERT ON settlement_allocations
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'settlement.created', 'settlement', NEW.id, NEW.created_at,
    json_object('orderId',NEW.order_id,'grossMinor',NEW.gross_minor,'marketplaceFeeMinor',NEW.marketplace_fee_minor,'processorFeeMinor',NEW.processor_fee_minor,'fulfillmentCostMinor',NEW.fulfillment_cost_minor,'refundedMinor',NEW.refunded_minor,'disputedMinor',NEW.disputed_minor,'payableMinor',NEW.payable_minor,'currency',NEW.currency,'status',NEW.status)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_settlement_update
AFTER UPDATE ON settlement_allocations
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'settlement.updated', 'settlement', NEW.id, NEW.updated_at,
    json_object('orderId',NEW.order_id,'grossMinor',NEW.gross_minor,'marketplaceFeeMinor',NEW.marketplace_fee_minor,'processorFeeMinor',NEW.processor_fee_minor,'fulfillmentCostMinor',NEW.fulfillment_cost_minor,'refundedMinor',NEW.refunded_minor,'disputedMinor',NEW.disputed_minor,'payableMinor',NEW.payable_minor,'currency',NEW.currency,'status',NEW.status,'stripeTransferId',NEW.stripe_transfer_id)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_transfer_insert
AFTER INSERT ON transfer_records
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'transfer.created', 'transfer', NEW.id, NEW.created_at,
    json_object('orderId',NEW.order_id,'provider',NEW.provider,'externalTransferId',NEW.external_transfer_id,'amountMinor',NEW.amount_minor,'reversedMinor',NEW.reversed_minor,'currency',NEW.currency,'status',NEW.status)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_transfer_update
AFTER UPDATE ON transfer_records
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'transfer.updated', 'transfer', NEW.id, NEW.updated_at,
    json_object('orderId',NEW.order_id,'provider',NEW.provider,'externalTransferId',NEW.external_transfer_id,'amountMinor',NEW.amount_minor,'reversedMinor',NEW.reversed_minor,'currency',NEW.currency,'status',NEW.status)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_payout_insert
AFTER INSERT ON payouts
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'payout.created', 'payout', NEW.id, NEW.created_at,
    json_object('stripeTransferId',NEW.stripe_transfer_id,'amountMinor',NEW.amount_minor,'currency',NEW.currency,'status',NEW.status,'periodStart',NEW.period_start,'periodEnd',NEW.period_end,'paidAt',NEW.paid_at)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_payout_update
AFTER UPDATE ON payouts
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'payout.updated', 'payout', NEW.id, COALESCE(NEW.paid_at,NEW.created_at),
    json_object('stripeTransferId',NEW.stripe_transfer_id,'amountMinor',NEW.amount_minor,'currency',NEW.currency,'status',NEW.status,'periodStart',NEW.period_start,'periodEnd',NEW.period_end,'paidAt',NEW.paid_at)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_external_sale_insert
AFTER INSERT ON external_channel_sales
WHEN NEW.author_id IS NOT NULL
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'external_sale.imported', 'external_sale', NEW.id, NEW.imported_at,
    json_object('provider',NEW.provider,'externalSaleId',NEW.external_sale_id,'bookId',NEW.book_id,'editionId',NEW.edition_id,'isbn',NEW.isbn,'saleDate',NEW.sale_date,'quantity',NEW.quantity,'grossMinor',NEW.gross_minor,'netMinor',NEW.net_minor,'returnsMinor',NEW.returns_minor,'currency',NEW.currency,'channelName',NEW.channel_name,'territory',NEW.territory,'sourceProvenance',NEW.source_provenance)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_marketing_cost_insert
AFTER INSERT ON marketing_campaign_costs
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'marketing.cost_recorded', 'marketing_cost', NEW.id, NEW.occurred_at,
    json_object('campaignId',NEW.campaign_id,'label',NEW.label,'amountMinor',NEW.amount_minor,'source',NEW.source)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_campaign_insert
AFTER INSERT ON campaigns
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'campaign.created', 'campaign', NEW.id, NEW.created_at,
    json_object('bookId',NEW.book_id,'name',NEW.name,'source',NEW.source,'medium',NEW.medium,'objective',NEW.objective,'budgetMinor',NEW.budget_minor,'status',NEW.status)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_campaign_update
AFTER UPDATE ON campaigns
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'campaign.updated', 'campaign', NEW.id, CURRENT_TIMESTAMP,
    json_object('bookId',NEW.book_id,'name',NEW.name,'source',NEW.source,'medium',NEW.medium,'objective',NEW.objective,'budgetMinor',NEW.budget_minor,'status',NEW.status)
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_business_analytics_run_insert
AFTER INSERT ON analytics_brain_runs
BEGIN
  INSERT INTO business_sync_events (change_id,author_id,event_type,object_type,object_id,occurred_at,payload_json)
  VALUES (
    'biz:' || lower(hex(randomblob(16))), NEW.author_id, 'analytics.refreshed', 'analytics_brain_run', NEW.id, NEW.created_at,
    json_object('periodDays',NEW.period_days,'periodStart',NEW.period_start,'periodEnd',NEW.period_end,'brainVersion',NEW.brain_version)
  );
END;
