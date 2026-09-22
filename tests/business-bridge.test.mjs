import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BUSINESS_BRIDGE_SCHEMA,BUSINESS_CHANGE_SCHEMA,
  normalizeBusinessCursor,normalizeBusinessLimit,normalizeBusinessAck,
  normalizeBusinessChange,buildBusinessSnapshot,buildBusinessChangeBatch,businessBridgeCapabilities
} from '../src/lib/business-bridge.mjs';

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');

test('v0.14 Business bridge uses a new versioned schema',()=>{
  assert.equal(BUSINESS_BRIDGE_SCHEMA,'yasready.marketplace.business.v2');
  assert.equal(BUSINESS_CHANGE_SCHEMA,'yasready.marketplace.business.change.v1');
});

test('Business cursor and limit normalization are bounded',()=>{
  assert.equal(normalizeBusinessCursor('-5'),0);
  assert.equal(normalizeBusinessCursor('42'),42);
  assert.equal(normalizeBusinessLimit('9999'),500);
  assert.equal(normalizeBusinessLimit('0'),1);
});

test('Business acknowledgement requires a positive sequence',()=>{
  assert.throws(()=>normalizeBusinessAck({throughSequence:0}),/through_sequence_required/);
  assert.deepEqual(normalizeBusinessAck({throughSequence:12,consumerKey:'yasready-business'}),{throughSequence:12,consumerKey:'yasready-business'});
});

test('Business snapshot preserves money in integer minor units and central identity',()=>{
  const out=buildBusinessSnapshot({author:{id:'a',user_id:'u',display_name:'Author'},period:{start:'s',end:'e'},totals:{grossSalesMinor:12345,refundsMinor:345,sellerPayableMinor:9000,orders:2,units:3,currency:'usd'},throughSequence:77});
  assert.equal(out.schema,BUSINESS_BRIDGE_SCHEMA);
  assert.equal(out.identity.yasreadyUserId,'u');
  assert.equal(out.commerce.grossSalesMinor,12345);
  assert.equal(out.sync.throughSequence,77);
  assert.equal(out.provenance.canonicalMoneyUnit,'minor');
});

test('Business change batches expose monotonic sequence cursors',()=>{
  const rows=[{seq:6,change_id:'c6',event_type:'ledger.inserted',object_type:'ledger_entry',object_id:'l1',occurred_at:'t',payload_json:'{"amountMinor":500}'},{seq:9,change_id:'c9',event_type:'payout.updated',object_type:'payout',object_id:'p1',occurred_at:'t2',payload_json:'{}'}];
  const out=buildBusinessChangeBatch({author:{id:'a',userId:'u'},after:5,rows});
  assert.equal(out.sync.after,5);assert.equal(out.sync.nextCursor,9);assert.equal(out.changes.length,2);assert.equal(out.changes[0].schema,BUSINESS_CHANGE_SCHEMA);
});

test('Malformed change payloads remain visible instead of disappearing',()=>{
  const x=normalizeBusinessChange({seq:1,change_id:'c',event_type:'x',object_type:'y',object_id:'z',occurred_at:'t',payload_json:'{bad'});
  assert.equal(x.payload.parseError,true);
});

test('Business service capability remains fail closed by default',()=>{
  const c=businessBridgeCapabilities({BUSINESS_BRIDGE_ENABLED:'false'});
  assert.equal(c.enabled,false);assert.equal(c.status,'architecture_ready');assert.equal(c.supports.incrementalChanges,true);
});

test('v0.14 migration adds sync events consumers runs and accounting triggers',()=>{
  const sql=read('../migrations/0016_business_intelligence_bridge.sql');
  for(const token of ['business_sync_events','business_sync_consumers','business_sync_runs','trg_business_ledger_insert','trg_business_external_sale_insert','trg_business_marketing_cost_insert','trg_business_analytics_run_insert']) assert.match(sql,new RegExp(token));
});

test('v0.14 worker exposes author preview and secret-gated Business service routes',()=>{
  const w=read('../src/worker.mjs');
  for(const route of ['/api/me/business-bridge/status','/api/me/business-bridge/snapshot','/api/me/business-bridge/changes','/api/internal/business/snapshot','/api/internal/business/changes','/api/internal/business/ack']) assert.match(w,new RegExp(route.replaceAll('/','\\/')));
  assert.match(w,/BUSINESS_BRIDGE_SECRET/);assert.match(w,/BUSINESS_BRIDGE_ENABLED/);
});

test('Business snapshot captures cursor before aggregate queries to avoid lost changes',()=>{
  const w=read('../src/worker.mjs'),fn=w.slice(w.indexOf('async function businessSnapshotForAuthor'),w.indexOf('async function businessChangesForAuthor'));
  assert.ok(fn.indexOf('MAX(seq)')<fn.indexOf('Promise.all'));
});

test('Business defaults are off in tracked configuration',()=>{
  const cfg=read('../wrangler.jsonc');assert.match(cfg,/"BUSINESS_BRIDGE_ENABLED": "false"/);assert.match(cfg,/yasready\.marketplace\.business\.v2/);
});

test('Author UI has a dedicated Business bridge workspace and v2 contract',()=>{
  const main=read('../src/main.js');assert.match(main,/function businessView/);assert.match(main,/Business Intelligence Bridge/);assert.match(main,/yasready\.marketplace\.business\.v2/);assert.match(main,/Snapshot once\. Then ask only what changed/);
});
