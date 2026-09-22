import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizePublishingHandoff,computePublishingDiff,verifyPublishingSignature} from '../src/lib/publishing-handoff.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const raw=JSON.parse(read('../examples/publishing-handoff-update.example.json'));

test('v0.13 update package still normalizes to the stable Publishing contract',()=>{
  const p=normalizePublishingHandoff(raw);assert.equal(p.schema,'yasready.publishing.marketplace.v1');assert.equal(p.sourceRevision,'book2-production-2026-09-22-r2');assert.equal(p.editions.length,4);
});

test('v0.13 Publishing diff keeps Marketplace price ownership explicit',()=>{
  const p=normalizePublishingHandoff(raw);const paper=p.editions.find(e=>e.format==='paperback');
  const diff=computePublishingDiff({currentBook:{title:p.book.title,subtitle:p.book.subtitle,description:p.book.description,long_description:p.book.longDescription,cover_url:p.book.coverUrl,primary_category:p.book.primaryCategory},currentEditions:[{id:'paper',publishing_source_edition_id:paper.sourceEditionId,format:'paperback',isbn:paper.isbn,fulfillment_provider:'ingram',provider_title_id:null,provider_sku:null,production_status:'ready',artifact_ref:paper.artifactRef,artifact_hash:'old-hash',price_minor:1799}],incoming:{...p,editions:[paper]}});
  assert.ok(diff.some(x=>x.fieldName==='artifactHash'&&x.ownership==='publishing'));
  assert.ok(diff.some(x=>x.fieldName==='priceMinor'&&x.ownership==='marketplace'&&x.disposition==='preserved'));
});

test('v0.13 migration creates review and certification evidence tables',()=>{
  const sql=read('../migrations/0015_publishing_live_test.sql');for(const t of ['publishing_update_reviews','publishing_handshake_test_runs','publishing_handshake_test_events'])assert.match(sql,new RegExp(t));
});

test('v0.13 worker stages later production updates behind author review',()=>{
  const w=read('../src/worker.mjs');assert.match(w,/staged_for_author_review/);assert.match(w,/publishing\.update_approved/);assert.match(w,/publishing\.update_rejected/);assert.match(w,/publishing-review/);
});

test('Publishing signature verifier still validates the signed transport',async()=>{
  const payload=JSON.stringify(raw),secret='test-secret',ts=Math.floor(Date.now()/1000);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${payload}`));const sig=[...new Uint8Array(mac)].map(x=>x.toString(16).padStart(2,'0')).join('');assert.equal(await verifyPublishingSignature(payload,`t=${ts},v1=${sig}`,secret),true);
});
