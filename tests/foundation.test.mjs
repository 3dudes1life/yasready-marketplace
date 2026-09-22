import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {marketplaceFee,sellerPayable} from '../src/lib/money.mjs';
import {stripeAllocationPlan,providerCapabilities} from '../src/lib/providers.mjs';
import {normalizeIngramStatus,buildFulfillmentRequest,ingramCapabilities} from '../src/lib/ingram.mjs';
import {buildCampaignUrl,buildEmbedHtml,socialCopy} from '../src/lib/marketing.mjs';
import {buildBusinessExport,BUSINESS_EXPORT_SCHEMA} from '../src/lib/business.mjs';
import {verifyStripeSignature} from '../src/lib/stripe-server.mjs';

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');

test('5% marketplace fee computes in integer minor units',()=>assert.equal(marketplaceFee(1899,500),95));
test('seller payable keeps fulfillment and processor cost separate',()=>assert.deepEqual(sellerPayable({grossMinor:1899,fulfillmentMinor:500,stripeFeeMinor:85,feeBps:500}),{marketplaceFeeMinor:95,sellerPayableMinor:1219}));
test('multi-author cart produces one allocation per seller',()=>{const x=stripeAllocationPlan([{authorId:'a',priceMinor:1000,quantity:1},{authorId:'b',priceMinor:2000,quantity:1},{authorId:'a',priceMinor:500,quantity:2}],500);assert.equal(x.length,2);assert.equal(x.find(y=>y.authorId==='a').grossMinor,2000)});
test('Ingram normalization keeps shipping lifecycle separate from payment',()=>{assert.equal(normalizeIngramStatus('PO acknowledged'),'processing');assert.equal(normalizeIngramStatus('ASN shipped'),'shipped');assert.equal(normalizeIngramStatus('delivered'),'delivered');assert.equal(normalizeIngramStatus('rejected'),'failed')});
test('Ingram fulfillment request sends only physical editions',()=>{const r=buildFulfillmentRequest({order:{id:'O1',currency:'usd'},shipTo:{country:'US'},items:[{id:'1',format:'paperback',isbn:'1',quantity:1},{id:'2',format:'ebook',quantity:1}]});assert.equal(r.lines.length,1);assert.equal(r.lines[0].isbn,'1')});
test('provider model retains multi-seller and Ingram reporting capabilities',()=>{assert.equal(providerCapabilities.stripe.multiSellerAllocation,true);assert.equal(ingramCapabilities.salesReportingImport,true)});
test('campaign link uses marketplace book route and attribution',()=>{const url=buildCampaignUrl({origin:'https://marketplace.yasready.com',bookSlug:'fault-lines',campaign:'Book Two Launch',source:'instagram',campaignId:'abc'});assert.match(url,/\/book\/fault-lines/);assert.match(url,/utm_source=instagram/);assert.match(url,/yr_campaign=abc/)});
test('HTML embed points at Marketplace rather than provider checkout',()=>{const h=buildEmbedHtml({url:'https://marketplace.yasready.com/book/x',title:'Book',author:'Author'});assert.match(h,/marketplace\.yasready\.com/);assert.match(h,/See formats/)});
test('social copy includes canonical Marketplace URL',()=>{const c=socialCopy({title:'Book',author:'Author',url:'https://marketplace.yasready.com/book/book'});assert.match(c.launch,/marketplace\.yasready\.com/)});
test('Business export is versioned and keeps money in minor units',()=>{const e=buildBusinessExport({author:{id:'a',user_id:'u',display_name:'A'},period:{start:'s',end:'e'},totals:{grossSalesMinor:1000,sellerPayableMinor:700,orders:2,units:3}});assert.equal(e.schema,BUSINESS_EXPORT_SCHEMA);assert.equal(e.totals.grossSalesMinor,1000);assert.equal(e.author.userId,'u')});
test('production safety defaults remain fail closed',()=>{const cfg=read('../wrangler.jsonc');assert.match(cfg,/"CHECKOUT_ENABLED": "false"/);assert.match(cfg,/"STRIPE_MODE": "off"/);assert.match(cfg,/"INGRAM_MODE": "off"/);assert.match(cfg,/"PUBLISHING_IMPORT_ENABLED": "false"/);assert.match(cfg,/"INGRAM_REPORT_IMPORT_ENABLED": "false"/)});
test('shared YasReady identity is a first-class unique mapping',()=>{const sql=read('../migrations/0002_marketplace_engine.sql');assert.match(sql,/idx_authors_user_id_unique/);assert.match(sql,/publishing_imports/);assert.match(sql,/business_export_runs/)});
test('webhook replay table exists before live Stripe',()=>assert.match(read('../migrations/0002_marketplace_engine.sql'),/provider_webhook_events/));
test('external provider sales have a separate non-native channel ledger',()=>{const sql=read('../migrations/0004_external_channel_sales.sql');assert.match(sql,/external_channel_sales/);assert.match(sql,/source_provenance/)});
test('storefront serves through Cloudflare static asset binding',()=>{const cfg=read('../wrangler.jsonc');assert.match(cfg,/"binding": "ASSETS"/);assert.match(read('../src/worker.mjs'),/env\.ASSETS\.fetch/)});
test('Stripe webhook HMAC verifier accepts valid signatures',async()=>{const payload='{"id":"evt_test"}',secret='whsec_test',ts=Math.floor(Date.now()/1000);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${payload}`));const sig=[...new Uint8Array(mac)].map(x=>x.toString(16).padStart(2,'0')).join('');assert.equal(await verifyStripeSignature(payload,`t=${ts},v1=${sig}`,secret),true)});

test('Commerce Closure migration adds immutable payment/refund/transfer/state ledgers',()=>{const sql=read('../migrations/0005_commerce_pro.sql')+read('../migrations/0006_commerce_operations.sql');assert.match(sql,/payment_records/);assert.match(sql,/settlement_allocations/);assert.match(sql,/transfer_records/);assert.match(sql,/order_status_history/);assert.match(sql,/reconciliation_runs/)});
test('commerce math prorates refunds and exposes seller balance',async()=>{const {allocateRefund,sellerBalance}=await import('../src/lib/commerce.mjs');const a=allocateRefund(500,[{id:'a',authorId:'x',grossMinor:1000,refundedMinor:0},{id:'b',authorId:'y',grossMinor:1000,refundedMinor:0}]);assert.equal(a.reduce((s,x)=>s+x.grossRefundMinor,0),500);assert.equal(a.length,2);assert.deepEqual(sellerBalance({earnedMinor:2000,refundedMinor:400,transferredMinor:1000,reversedMinor:100}),{earnedMinor:2000,refundedMinor:400,netEarnedMinor:1600,paidOutMinor:900,availableMinor:700})});
test('v0.3 snapshots fulfillment costs in pending order economics',()=>{const worker=read('../src/worker.mjs');assert.match(worker,/providerCostMinor/);assert.match(worker,/estimated_fulfillment_cost_minor/);assert.match(worker,/fulfillmentMinor/)});
test('v0.3 keeps refund and payout toggles fail closed',()=>{const cfg=read('../wrangler.jsonc');assert.match(cfg,/"PAYOUTS_ENABLED": "false"/);assert.match(cfg,/"REFUNDS_ENABLED": "false"/)});
test('Commerce Closure exposes author commerce APIs',()=>{const worker=read('../src/worker.mjs');for(const route of ['/api/me/orders','/api/me/ledger','/api/me/payouts','/api/me/fulfillment']) assert.match(worker,new RegExp(route.replaceAll('/','\\/')))});
