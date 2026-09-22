import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {marketplaceFee,sellerPayable} from '../src/lib/money.mjs';
import {stripeAllocationPlan,normalizeIngramStatus,providerCapabilities} from '../src/lib/providers.mjs';

test('5% marketplace fee computes in integer minor units',()=>assert.equal(marketplaceFee(1899,500),95));
test('seller payable keeps fulfillment and processor cost separate',()=>assert.deepEqual(sellerPayable({grossMinor:1899,fulfillmentMinor:500,stripeFeeMinor:85,feeBps:500}),{marketplaceFeeMinor:95,sellerPayableMinor:1219}));
test('multi-author cart produces one allocation per seller',()=>{const x=stripeAllocationPlan([{authorId:'a',priceMinor:1000,quantity:1},{authorId:'b',priceMinor:2000,quantity:1},{authorId:'a',priceMinor:500,quantity:2}],500);assert.equal(x.length,2);assert.equal(x.find(y=>y.authorId==='a').grossMinor,2000)});
test('Ingram provider normalization preserves fulfillment state boundary',()=>{assert.equal(normalizeIngramStatus('PO acknowledged'),'processing');assert.equal(normalizeIngramStatus('shipped'),'shipped');assert.equal(normalizeIngramStatus('rejected'),'failed')});
test('provider capabilities include stats/commerce seams from first build',()=>{assert.equal(providerCapabilities.stripe.multiSellerAllocation,true);assert.equal(providerCapabilities.ingram.salesReportingImport,true)});
test('production safety defaults are fail closed',()=>{const cfg=fs.readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');assert.match(cfg,/"CHECKOUT_ENABLED": "false"/);assert.match(cfg,/"STRIPE_MODE": "off"/);assert.match(cfg,/"INGRAM_MODE": "off"/)});
test('schema treats analytics as first-class data',()=>{const sql=fs.readFileSync(new URL('../migrations/0001_foundation.sql',import.meta.url),'utf8');for(const table of ['marketplace_events','campaigns','ledger_entries','provider_sync_runs','fulfillment_jobs']) assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`))});
