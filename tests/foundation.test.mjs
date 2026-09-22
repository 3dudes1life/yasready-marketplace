import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {marketplaceFee,sellerPayable} from '../src/lib/money.mjs';
import {stripeAllocationPlan,providerCapabilities} from '../src/lib/providers.mjs';
import {normalizeIngramStatus,buildFulfillmentRequest,ingramCapabilities} from '../src/lib/ingram.mjs';
import {buildCampaignUrl,buildEmbedHtml,socialCopy} from '../src/lib/marketing.mjs';
import {buildBusinessExport,BUSINESS_EXPORT_SCHEMA} from '../src/lib/business.mjs';
import {verifyStripeSignature} from '../src/lib/stripe-server.mjs';
import {ingramReadiness,normalizeInventoryRow,normalizeMetadataRow,normalizeInvoice,nextRetrySeconds,validatePhysicalOrder} from '../src/lib/ingram-bridge.mjs';

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


test('v0.4 GitHub Pages bootstrap is project-path safe',()=>{const h=read('../index.html'),m=read('../src/main.js'),a=read('../src/lib/analytics.js');assert.match(h,/src="\.\/src\/main\.js"/);assert.match(h,/href="\.\/src\/styles\.css"/);assert.match(m,/async function renderQr/);assert.doesNotMatch(m,/import '\.\/styles\.css'/);assert.match(a,/import\.meta\.env\?\./);assert.match(read('../404.html'),/yasready-marketplace/)});
test('v0.4 Ingram Bridge migration adds feed, invoice, retry and dead-letter truth',()=>{const sql=read('../migrations/0007_ingram_bridge.sql');for(const name of ['fulfillment_attempts','provider_sync_cursors','provider_inventory_snapshots','provider_metadata_snapshots','provider_invoices','provider_invoice_lines','provider_dead_letters'])assert.match(sql,new RegExp(name))});
test('v0.4 Ingram readiness stays fail closed without approved transport',()=>{const x=ingramReadiness({INGRAM_MODE:'cdf_edi',INGRAM_SUBMISSION_ENABLED:'false'});assert.equal(x.connected,true);assert.equal(x.canSubmit,false);assert.equal(x.reason,'submission_gate_off')});
test('v0.4 inventory and metadata normalizers require ISBN and preserve provider truth',()=>{assert.deepEqual(normalizeInventoryRow({isbn:'978-1-23',availability:'In Stock',unitCostMinor:525}).availability,'available');assert.equal(normalizeMetadataRow({isbn:'978123',title:'Book'}).title,'Book');assert.throws(()=>normalizeInventoryRow({availability:'available'}),/isbn_required/)});
test('v0.4 invoice normalization stays tied to order reference',()=>{const x=normalizeInvoice({orderReference:'YR-1',invoiceId:'INV-1',totalMinor:900,lines:[{orderItemId:'OI-1',amountMinor:700}]});assert.equal(x.orderReference,'YR-1');assert.equal(x.lines[0].amountMinor,700)});
test('v0.4 validates physical orders before provider document preparation',()=>{const good=validatePhysicalOrder({order:{id:'O1'},items:[{id:'I1',format:'paperback',isbn:'9781',quantity:1}],shipTo:{address1:'1 Main',city:'X',postalCode:'1',country:'US'}});assert.equal(good.ok,true);const bad=validatePhysicalOrder({order:{id:'O1'},items:[{id:'I1',format:'paperback',quantity:1}],shipTo:{country:'US'}});assert.equal(bad.ok,false);assert.ok(bad.errors.some(x=>x.startsWith('isbn_required')))});
test('v0.4 retry backoff is bounded',()=>{assert.equal(nextRetrySeconds(1),60);assert.equal(nextRetrySeconds(2),120);assert.equal(nextRetrySeconds(20),21600)});
test('v0.4 keeps every Ingram action fail closed by default',()=>{const cfg=read('../wrangler.jsonc');for(const flag of ['INGRAM_SUBMISSION_ENABLED','INGRAM_METADATA_IMPORT_ENABLED','INGRAM_INVENTORY_IMPORT_ENABLED','INGRAM_INVOICE_IMPORT_ENABLED','INGRAM_RETRY_ENABLED'])assert.match(cfg,new RegExp(`"${flag}": "false"`))});
test('v0.4 exposes provider operations without inventing a private Ingram endpoint',()=>{const w=read('../src/worker.mjs');for(const route of ['/api/providers/ingram/readiness','/api/providers/ingram/metadata/import','/api/providers/ingram/inventory/import','/api/providers/ingram/invoice/import','/api/admin/ingram/queue','/api/admin/ingram/dead-letters'])assert.match(w,new RegExp(route.replaceAll('/','\\/')));assert.doesNotMatch(w,/api\.ingram|ingramspark\.com\/api/i)});

import {PUBLISHING_HANDOFF_SCHEMA,normalizePublishingHandoff,computePublishingDiff,readinessForSale,verifyPublishingSignature} from '../src/lib/publishing-handoff.mjs';

test('v0.5 Publishing Handshake migration keeps source links, field provenance and author launch audit',()=>{const sql=read('../migrations/0008_publishing_handshake.sql');for(const name of ['publishing_book_links','publishing_edition_links','publishing_sync_changes','marketplace_launch_events'])assert.match(sql,new RegExp(name));assert.match(sql,/author_approved_at/);assert.match(sql,/production_sync_status/)});
test('v0.5 handoff requires the shared YasReady user and source IDs',()=>{const p=normalizePublishingHandoff({schema:PUBLISHING_HANDOFF_SCHEMA,userId:'u1',sourceBookId:'pb1',book:{title:'Book'},editions:[{sourceEditionId:'pe1',format:'paperback',isbn:'978-1-23',suggestedPriceMinor:1899}]});assert.equal(p.userId,'u1');assert.equal(p.editions[0].isbn,'978123');assert.equal(p.editions[0].fulfillmentProvider,'ingram');assert.throws(()=>normalizePublishingHandoff({schema:PUBLISHING_HANDOFF_SCHEMA,book:{title:'x'},editions:[]}),/user_id_required/)});
test('v0.5 Publishing updates preserve Marketplace-owned price',()=>{const incoming=normalizePublishingHandoff({schema:PUBLISHING_HANDOFF_SCHEMA,userId:'u1',sourceBookId:'pb1',book:{title:'New Title'},editions:[{sourceEditionId:'pe1',format:'paperback',isbn:'9781',suggestedPriceMinor:1999}]});const changes=computePublishingDiff({currentBook:{title:'Old Title'},currentEditions:[{id:'e1',publishing_source_edition_id:'pe1',format:'paperback',isbn:'9781',price_minor:1699}],incoming});const price=changes.find(x=>x.fieldName==='priceMinor');assert.equal(price.ownership,'marketplace');assert.equal(price.disposition,'preserved');assert.ok(changes.some(x=>x.fieldName==='title'&&x.disposition==='applied'))});
test('v0.5 sale readiness requires a cover and positive Marketplace price',()=>{const bad=readinessForSale({book:{title:'Book'},listing:{status:'draft'},editions:[{id:'e1',format:'paperback',isbn:'9781',price_minor:0,production_status:'ready'}],author:{}});assert.equal(bad.ready,false);assert.ok(bad.errors.includes('cover_required'));assert.ok(bad.errors.includes('price_required:e1'));const good=readinessForSale({book:{title:'Book',cover_url:'https://x'},listing:{status:'draft'},editions:[{id:'e1',format:'paperback',isbn:'9781',price_minor:1899,production_status:'ready'}],author:{stripe_connected_account_id:null}});assert.equal(good.ready,true);assert.deepEqual(good.eligibleEditionIds,['e1']);assert.ok(good.warnings.includes('stripe_payout_setup_not_started'))});
test('v0.5 Publishing signature verifier accepts valid HMAC',async()=>{const payload='{"schema":"yasready.publishing.marketplace.v1"}',secret='pub_test',ts=Math.floor(Date.now()/1000);const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${payload}`));const sig=[...new Uint8Array(mac)].map(x=>x.toString(16).padStart(2,'0')).join('');assert.equal(await verifyPublishingSignature(payload,`t=${ts},v1=${sig}`,secret),true)});
test('v0.5 Publishing import and launch are both fail closed',()=>{const cfg=read('../wrangler.jsonc');assert.match(cfg,/"PUBLISHING_IMPORT_ENABLED": "false"/);assert.match(read('../src/worker.mjs'),/PUBLISHING_IMPORT_SECRET/);assert.match(read('../src/worker.mjs'),/go-live/)});

test('v0.5 uses the shared YasReady light/dark visual tokens',()=>{const css=read('../src/styles.css');assert.match(css,/--yr-brand:#C6FF00/);assert.match(css,/--yr-green:#16815c/);assert.match(css,/--yr-bg:#f4f5f8/);assert.match(css,/--yr-bg:#07090e/)});
test('v0.5 uses YasReady green for operating actions instead of legacy purple-first UI',()=>{const css=read('../src/styles.css');assert.match(css,/linear-gradient\(120deg,#127351,#1e9a6b\)/);assert.match(css,/EXACT YASREADY PLATFORM VISUAL PARITY/)});
test('v0.5 shares the YasReady appearance preference contract',()=>{const main=read('../src/main.js'),html=read('../index.html');assert.match(main,/yasready-theme/);assert.match(main,/yr-shared-theme-toggle/);assert.match(html,/localStorage\.getItem\('yasready-theme'\)/)});
test('v0.5 operating shell keeps compact YasReady density',()=>{const css=read('../src/styles.css');assert.match(css,/\.nav\{height:64px!important/);assert.match(css,/\.btn\{min-height:40px!important/);assert.match(css,/\.panel\{border-radius:15px!important/)});

test('v0.6 separates the public storefront from the author operating shell',()=>{const main=read('../src/main.js');assert.match(main,/publicChrome/);assert.match(main,/yrSidebar/);assert.match(main,/yrTopbar/);assert.match(main,/yrMobileNav/);assert.ok(/state\.view==='store'|isPublicView/.test(main))});
test('v0.6 author shell groups Marketplace work instead of crowding one top nav',()=>{const main=read('../src/main.js');for(const label of ['Workspace','Grow','Operations'])assert.match(main,new RegExp(label));for(const view of ['dashboard','books','launch','sales','marketing','commerce','fulfillment','integrations'])assert.match(main,new RegExp(`\\['${view}'`))});
test('v0.6 uses the exact shared YasReady mark asset in the shell',()=>{const main=read('../src/main.js');assert.match(main,/yasready-mark\.png/);assert.ok(fs.existsSync(new URL('../yasready-mark.png',import.meta.url)));assert.ok(fs.existsSync(new URL('../public/yasready-mark.png',import.meta.url)))});
test('v0.6 keeps author content clear of the fixed navigation rails',()=>{const css=read('../src/styles.css');assert.match(css,/--yr-sidebar:224px/);assert.match(css,/\.creator-ui \.creatorView\{margin-left:var\(--yr-sidebar\)/);assert.match(css,/\.yrTopbar\{position:fixed;left:var\(--yr-sidebar\)/)});
test('v0.6 has explicit loading and error UI states',()=>{const main=read('../src/main.js'),css=read('../src/styles.css');assert.match(main,/function loadingState/);assert.match(main,/function errorState/);assert.match(css,/\.stateSpinner/);assert.match(css,/\.skeletonGrid/)});
test('v0.6 keeps mobile author navigation usable without the desktop rail',()=>{const css=read('../src/styles.css');assert.match(css,/@media\(max-width:860px\)/);assert.match(css,/\.yrSidebar\{display:none\}/);assert.match(css,/\.yrMobileNav\{position:fixed;display:flex/)});
test('v0.6 preserves shared YasReady theme preference and Ready Lime semantics',()=>{const main=read('../src/main.js'),css=read('../src/styles.css');assert.match(main,/yasready-theme/);assert.match(css,/--yr-brand:#C6FF00/);assert.match(css,/moneyLock[^}]*var\(--yr-brand\)/s)});

import {normalizeCatalogDraft,validateCatalogDraft,catalogPreview,changedCatalogFields} from '../src/lib/catalog-management.mjs';

test('v0.7 catalog draft only accepts editions already owned by the book',()=>{
  const current={book:{title:'Book'},listing:{visibility:'public'},author:{display_name:'Author'},editions:[{id:'e1',price_minor:999,status:'draft'}]};
  const d=normalizeCatalogDraft({book:{displayTitle:'Reader Title'},editions:[{id:'e1',priceMinor:1299,status:'live'}]},current);
  assert.equal(d.book.displayTitle,'Reader Title');assert.equal(d.editions[0].priceMinor,1299);
  assert.throws(()=>normalizeCatalogDraft({editions:[{id:'other',priceMinor:100,status:'live'}]},current),/edition_not_owned/);
});

test('v0.7 catalog validation blocks live zero-price editions and bad websites',()=>{
  const d={book:{displayTitle:'Book',coverUrl:'https://example.com/cover.jpg',description:'x',primaryCategory:'Fiction'},listing:{visibility:'public'},author:{displayName:'Author',websiteUrl:'not-a-url'},editions:[{id:'e1',priceMinor:0,status:'live'}]};
  const v=validateCatalogDraft(d,{editions:[{id:'e1',format:'ebook',productionStatus:'ready'}]});
  assert.equal(v.valid,false);assert.ok(v.errors.includes('author_website_invalid'));assert.ok(v.errors.includes('price_required:e1'));
});

test('v0.7 catalog preview overlays Marketplace presentation on Publishing truth',()=>{
  const p=catalogPreview({draft:{book:{displayTitle:'Store Title',description:'Store copy'},listing:{visibility:'direct'},author:{displayName:'A'},editions:[{id:'e1',priceMinor:1299,status:'live'}]},productionBook:{title:'Production Title',cover_url:'cover.jpg'},productionEditions:[{id:'e1',format:'paperback',isbn:'9781',production_status:'ready'}]});
  assert.equal(p.title,'Store Title');assert.equal(p.coverUrl,'cover.jpg');assert.equal(p.editions[0].isbn,'9781');assert.equal(p.visibility,'direct');
});

test('v0.7 catalog field diff is explicit for audit history',()=>{
  const fields=changedCatalogFields({book:{displayTitle:'Old'},listing:{visibility:'public'}},{book:{displayTitle:'New'},listing:{visibility:'direct'}});
  assert.deepEqual(fields,['book.displayTitle','listing.visibility']);
});

test('v0.7 migration adds autosave, presentation overrides and catalog audit tables',()=>{
  const sql=read('../migrations/0009_catalog_management.sql');
  for(const token of ['catalog_drafts','catalog_change_history','catalog_validation_runs','display_title','cover_override_url','editor_revision']) assert.match(sql,new RegExp(token));
});

test('v0.7 worker exposes editor autosave preview apply and history routes',()=>{
  const w=read('../src/worker.mjs');for(const token of ['/editor','/preview','/apply-draft','/history','stale_catalog_draft','listing_changed_since_draft'])assert.match(w,new RegExp(token.replaceAll('/','\\/')));
});

test('v0.7 author UI exposes real catalog editor and preview-before-apply',()=>{
  const m=read('../src/main.js');for(const token of ['data-edit-catalog','catalogEditorModal','saveCatalogEditor','applyCatalogEditor','LIVE PREVIEW','Production fields locked'])assert.match(m,new RegExp(token));
});

test('v0.7 public catalog resolves Marketplace presentation overrides first',()=>{
  const w=read('../src/worker.mjs');assert.match(w,/display_title\|\|r\.title/);assert.match(w,/cover_override_url\?\?r\.cover_url/);assert.match(w,/description_override\?\?r\.description/);
});

test('v0.7 shared author storefront has its own concurrency revision',()=>{
  const sql=read('../migrations/0009_catalog_management.sql'),w=read('../src/worker.mjs');assert.match(sql,/profile_revision/);assert.match(sql,/base_author_revision/);assert.match(w,/author_profile_changed_since_draft/);
});

test('v0.7 blocks unsafe catalog cover URLs before apply',()=>{
  const d={book:{displayTitle:'Book',coverUrl:'javascript:bad',description:'x',primaryCategory:'Fiction'},listing:{visibility:'public'},author:{displayName:'Author'},editions:[{id:'e1',priceMinor:999,status:'live'}]};
  const v=validateCatalogDraft(d,{editions:[{id:'e1',format:'ebook',productionStatus:'ready'}]});assert.equal(v.valid,false);assert.ok(v.errors.includes('cover_url_invalid'));
});

test('v0.7 no-op draft apply does not manufacture a listing revision',()=>{assert.match(read('../src/worker.mjs'),/noOp:true/)});

import {normalizeReaderProgress,readerCanOpenEdition,groupSeries,publicAuthorFromBooks} from '../src/lib/consumer.mjs';

test('v0.8 reader progress clamps and completes cleanly',()=>{const p=normalizeReaderProgress({progressKind:'ebook',percent:101,locator:{chapter:8}});assert.equal(p.percent,100);assert.equal(p.completed,true);assert.deepEqual(p.locator,{chapter:8})});
test('v0.8 digital library only opens active ebook/audiobook entitlements',()=>{assert.equal(readerCanOpenEdition({format:'ebook',status:'active'}),true);assert.equal(readerCanOpenEdition({format:'paperback',status:'active'}),false);assert.equal(readerCanOpenEdition({format:'audiobook',status:'revoked'}),false)});
test('v0.8 series helper preserves reading order',()=>{const g=groupSeries([{id:'2',series:'S',seriesNumber:2},{id:'1',series:'S',seriesNumber:1}]);assert.deepEqual(g[0].books.map(x=>x.id),['1','2'])});
test('v0.8 author storefront derives from public catalog without a second profile system',()=>{const a=publicAuthorFromBooks([{id:'b',author:'A',authorId:'a',handle:'a',author:{id:'a',handle:'a',name:'A',bio:'Bio'}}],'a');assert.equal(a.name,'A');assert.equal(a.books.length,1)});
test('v0.8 migration adds customer identity saved recent progress and follows',()=>{const sql=read('../migrations/0010_consumer_marketplace.sql');for(const token of ['customer_saved_books','customer_recent_books','reader_progress','author_follows','user_id'])assert.match(sql,new RegExp(token))});
test('v0.8 exposes reader library saved recent progress and follow APIs',()=>{const w=read('../src/worker.mjs');for(const token of ['/api/reader/library','/api/reader/saved','/api/reader/recent','/api/reader/progress','/api/reader/follow'])assert.match(w,new RegExp(token.replaceAll('/','\\/')))});
test('v0.8 consumer UI includes discovery library saved author series and Books bridge',()=>{const m=read('../src/main.js');for(const token of ['consumerHero','libraryView','savedView','authorPageView','seriesPageView','YasReady. Books','Recently viewed'])assert.match(m,new RegExp(token.replace('.','\\.')))});
test('v0.8 consumer data remains one YasReady identity',()=>{const w=read('../src/worker.mjs');assert.match(w,/ensureCustomer\(env,auth\.identity\)/);assert.match(w,/user_id=\?/)});

// v0.9 Marketing Studio
import {normalizeCampaignDraft,campaignMetrics,marketingRecommendation,launchKit,shortLinkSlug,assetPlan} from '../src/lib/marketing-studio.mjs';

test('marketing studio normalizes channel and campaign objective',()=>{
  const c=normalizeCampaignDraft({name:' Book Launch ',source:'instagram',objective:'launch',budgetMinor:4200});
  assert.equal(c.name,'Book Launch');assert.equal(c.medium,'social');assert.equal(c.objective,'launch');assert.equal(c.budgetMinor,4200);
});

test('marketing metrics calculate conversion revenue per visit and ROAS',()=>{
  const m=campaignMetrics({visits:100,orders:10,revenueMinor:20000,costMinor:5000,refundsMinor:2000});
  assert.equal(m.conversionRate,10);assert.equal(m.netRevenueMinor,18000);assert.equal(m.revenuePerVisitMinor,180);assert.equal(m.roas,3.6);
});

test('marketing recommendation identifies high-converting channel',()=>{
  const r=marketingRecommendation([{source:'event-qr',label:'Event / QR',visits:100,orders:10,revenueMinor:15000,costMinor:1000}]);
  assert.equal(r.type,'scale_winner');assert.match(r.title,/Event/);
});

test('launch kit creates social email event and checklist assets',()=>{
  const kit=launchKit({title:'Fault Lines',author:'William',url:'https://example.com/book',objective:'launch'});
  assert.match(kit.social.launch,/Fault Lines/);assert.match(kit.email.body,/example.com/);assert.ok(kit.checklist.length>=5);
});

test('short link slug stays readable and bounded',()=>{
  const slug=shortLinkSlug('Book Two Launch','ABC123XYZ');assert.match(slug,/^book-two-launch-/);assert.ok(slug.length<40);
});

test('asset plan adapts to channel',()=>{
  assert.ok(assetPlan({source:'email',objective:'launch'}).includes('email_copy'));assert.ok(assetPlan({source:'event-qr',objective:'event'}).includes('event_card'));
});

test('v0.9 Business export carries normalized marketing intelligence',()=>{
  const marketing={visits:100,orders:8,revenueMinor:16000,costMinor:2000,conversionRate:8,roas:8};
  const out=buildBusinessExport({author:{id:'a',user_id:'u',display_name:'Author'},period:{days:30},totals:{currency:'usd'},marketing});
  assert.deepEqual(out.marketing,marketing);
});
