import {sellerPayable} from './lib/money.mjs';
import {stripeAllocationPlan} from './lib/providers.mjs';
import {getIdentity,publicIdentity} from './lib/auth.mjs';
import {buildBusinessExport} from './lib/business.mjs';
import {buildCampaignUrl,buildEmbedHtml,socialCopy} from './lib/marketing.mjs';
import {ingramCapabilities,buildPurchaseOrderDocument,normalizeIngramDocument} from './lib/ingram.mjs';
import {ingramReadiness,normalizeInventoryRow,normalizeMetadataRow,normalizeInvoice,nextRetrySeconds,normalizeBridgeError,validatePhysicalOrder} from './lib/ingram-bridge.mjs';
import {createExpressAccount,createAccountLink,retrieveAccount,createCheckoutSession,retrieveCheckoutSession,retrievePaymentIntent,verifyStripeSignature,createRefund,createTransfer} from './lib/stripe-server.mjs';
import {allocateRefund,sellerBalance,refundStatus,commerceReadiness,prorateMinor,allocateProRata} from './lib/commerce.mjs';
import {recordOrderStatus,openCommerceException,ensureReceiptToken,materializeSettlementAllocations,createFulfillmentJobs,refreshOrderFulfillment,listAuthorOrders,getAuthorOrder,commerceHealth,audit} from './lib/commerce-ops.mjs';
import {processStripeEvent,stripeCommerceSummary} from './lib/stripe-commerce.mjs';
import {PUBLISHING_HANDOFF_SCHEMA,normalizePublishingHandoff,sha256Hex,computePublishingDiff,readinessForSale,verifyPublishingSignature,slugify} from './lib/publishing-handoff.mjs';
import {normalizeCatalogDraft,validateCatalogDraft,catalogPreview,changedCatalogFields} from './lib/catalog-management.mjs';
import {normalizeReaderProgress} from './lib/consumer.mjs';
import {normalizeCampaignDraft,campaignMetrics,marketingRecommendation,launchKit,shortLinkSlug,channelConfig} from './lib/marketing-studio.mjs';
import {buildAnalyticsBrain,subtractStats,subtractFormats} from './lib/analytics-brain.mjs';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',...headers}});
const safeJson=async request=>{try{return await request.json()}catch{return null}};
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const clampQty=n=>Math.max(1,Math.min(25,Number(n)||1));
const READER_ROUTES=['/api/reader/library','/api/reader/saved','/api/reader/recent','/api/reader/progress/:editionId','/api/reader/follow/:authorId'];

function requireAdmin(request,env){
  const secret=request.headers.get('x-yasready-admin-secret')||request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  return !!env.COMMERCE_ADMIN_SECRET&&secret===env.COMMERCE_ADMIN_SECRET;
}
function requireProviderSecret(request,env){return !!env.PROVIDER_IMPORT_SECRET&&request.headers.get('x-yasready-provider-secret')===env.PROVIDER_IMPORT_SECRET;}
function safeAddress(raw){try{return raw?JSON.parse(raw):null}catch{return null}}

async function reconcileStripeOrder(env,orderId){
  const order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(orderId).first();
  if(!order) throw new Error('order_not_found'); if(!order.stripe_payment_intent_id) throw new Error('payment_intent_missing');
  const pi=await retrievePaymentIntent(env,order.stripe_payment_intent_id),charge=typeof pi.latest_charge==='object'?pi.latest_charge:null,bt=charge&&typeof charge.balance_transaction==='object'?charge.balance_transaction:null;
  const feeMinor=Number(bt?.fee||0),netMinor=bt?.net==null?null:Number(bt.net),amountMinor=Number(pi.amount_received||pi.amount||order.total_minor||0);
  await env.DB.prepare(`INSERT INTO payment_records (id,order_id,provider,external_payment_id,external_charge_id,balance_transaction_id,amount_minor,fee_minor,net_minor,currency,status,livemode,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,external_payment_id) DO UPDATE SET external_charge_id=excluded.external_charge_id,balance_transaction_id=excluded.balance_transaction_id,amount_minor=excluded.amount_minor,fee_minor=excluded.fee_minor,net_minor=excluded.net_minor,status=excluded.status,updated_at=excluded.updated_at`).bind(uuid(),orderId,'stripe',pi.id,charge?.id||null,bt?.id||null,amountMinor,feeMinor,netMinor,String(pi.currency||order.currency||'usd'),pi.status||'succeeded',pi.livemode?1:0,now(),now()).run();
  const items=await all(env.DB.prepare(`SELECT id,gross_minor FROM order_items WHERE order_id=? ORDER BY created_at,id`).bind(orderId)),fees=allocateProRata(feeMinor,items.map(x=>({grossMinor:Number(x.gross_minor||0)})));
  for(let i=0;i<items.length;i++) await env.DB.prepare(`UPDATE order_items SET actual_processor_fee_minor=?,stripe_fee_minor=?,updated_at=? WHERE id=?`).bind(fees[i],fees[i],now(),items[i].id).run();
  let checkout=null;if(order.stripe_checkout_session_id){try{checkout=await retrieveCheckoutSession(env,order.stripe_checkout_session_id)}catch{}}
  await env.DB.prepare(`UPDATE orders SET provider_amount_subtotal_minor=COALESCE(?,provider_amount_subtotal_minor),provider_amount_total_minor=COALESCE(?,provider_amount_total_minor),provider_tax_minor=COALESCE(?,provider_tax_minor),provider_shipping_minor=COALESCE(?,provider_shipping_minor),provider_discount_minor=COALESCE(?,provider_discount_minor),last_reconciled_at=?,updated_at=? WHERE id=?`).bind(checkout?.amount_subtotal??null,checkout?.amount_total??amountMinor,checkout?.total_details?.amount_tax??null,checkout?.shipping_cost?.amount_total??null,checkout?.total_details?.amount_discount??null,now(),now(),orderId).run();
  await materializeSettlementAllocations(env,orderId); await audit(env,{actorType:'system',actorId:'stripe-reconciler',action:'stripe.reconcile',objectType:'order',objectId:orderId,orderId,metadata:{paymentIntent:pi.id,feeMinor}});
  return {orderId,paymentIntent:pi.id,chargeId:charge?.id||null,balanceTransactionId:bt?.id||null,amountMinor,feeMinor,netMinor,reconciled:true};
}

function noDb(){return json({ok:false,error:'database_not_bound',message:'Bind D1 as DB and apply migrations.'},503)}
async function all(stmt){const out=await stmt.all(); return out.results||[];}

async function writeEvent(env,event){
  if(!env.DB) return;
  await env.DB.prepare(`INSERT OR IGNORE INTO marketplace_events (id,event_type,anonymous_id,user_id,author_id,book_id,edition_id,order_id,campaign_id,source,medium,occurred_at,properties_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(event.id||uuid(),event.type,event.anonymousId||null,event.userId||null,event.authorId||null,event.bookId||null,event.editionId||null,event.orderId||null,event.campaignId||null,event.source||event.properties?.utm_source||null,event.medium||event.properties?.utm_medium||null,event.occurredAt||now(),JSON.stringify(event.properties||{})).run();
}

async function requireIdentity(request,env){
  try{return {identity:await getIdentity(request,env)}}catch(err){return {response:json({ok:false,error:'unauthorized',message:String(err.message||err)},401)}}
}

async function ensureAuthor(env,identity){
  let author=await env.DB.prepare(`SELECT * FROM authors WHERE user_id=? LIMIT 1`).bind(identity.userId).first();
  if(!author){
    const id=uuid();
    const handle=`author-${id.slice(0,8)}`;
    await env.DB.prepare(`INSERT INTO authors (id,user_id,display_name,email,handle,avatar_url,marketplace_status,last_seen_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind(id,identity.userId,identity.name||'YasReady Author',identity.email||null,handle,identity.avatarUrl||null,'active',now()).run();
    author=await env.DB.prepare(`SELECT * FROM authors WHERE id=?`).bind(id).first();
  } else {
    await env.DB.prepare(`UPDATE authors SET email=COALESCE(?,email), display_name=CASE WHEN display_name IS NULL OR display_name='' THEN ? ELSE display_name END, avatar_url=COALESCE(?,avatar_url), last_seen_at=?, updated_at=? WHERE id=?`)
      .bind(identity.email||null,identity.name||'YasReady Author',identity.avatarUrl||null,now(),now(),author.id).run();
    author=await env.DB.prepare(`SELECT * FROM authors WHERE id=?`).bind(author.id).first();
  }
  return author;
}

function catalogFromRows(rows){
  const books=new Map();
  for(const r of rows){
    if(!books.has(r.book_id)) books.set(r.book_id,{
      id:r.book_id,slug:r.slug,title:r.display_title||r.title,subtitle:r.display_subtitle??r.subtitle,description:r.description_override??r.description,longDescription:r.long_description_override??r.long_description,coverUrl:r.cover_override_url??r.cover_url,category:r.category_override??r.primary_category,excerpt:r.excerpt||null,series:r.series_name||null,seriesNumber:r.series_number==null?null:Number(r.series_number),
      author:{id:r.author_id,name:r.author_name,handle:r.author_handle,avatarUrl:r.author_avatar_url,bio:r.author_bio||null,websiteUrl:r.author_website_url||null,storefrontTagline:r.storefront_tagline||null},
      listing:{id:r.listing_id,status:r.listing_status,visibility:r.visibility,publishedAt:r.published_at,scheduledLiveAt:r.scheduled_live_at||null,revision:Number(r.editor_revision||0)},editions:[]
    });
    if(r.edition_id) books.get(r.book_id).editions.push({id:r.edition_id,format:r.format,isbn:r.isbn,currency:r.currency,priceMinor:r.price_minor,status:r.edition_status,fulfillmentProvider:r.fulfillment_provider,inventoryStatus:r.inventory_status,providerPurchaseUrl:r.provider_purchase_url,providerCostMinor:r.provider_cost_minor,publishingSourceEditionId:r.publishing_source_edition_id,productionStatus:r.production_status,artifactRef:r.artifact_ref,artifactHash:r.artifact_hash,productionSyncedAt:r.production_synced_at});
  }
  return [...books.values()];
}


async function ensureCustomer(env,identity){
  let customer=await env.DB.prepare(`SELECT * FROM customers WHERE user_id=? LIMIT 1`).bind(identity.userId).first();
  if(!customer){
    const id=uuid();
    await env.DB.prepare(`INSERT INTO customers (id,user_id,email,display_name,avatar_url,last_seen_at,created_at) VALUES (?,?,?,?,?,?,?)`).bind(id,identity.userId,identity.email||null,identity.name||'YasReady Reader',identity.avatarUrl||null,now(),now()).run();
    customer=await env.DB.prepare(`SELECT * FROM customers WHERE id=?`).bind(id).first();
  }else{
    await env.DB.prepare(`UPDATE customers SET email=COALESCE(?,email),display_name=COALESCE(?,display_name),avatar_url=COALESCE(?,avatar_url),last_seen_at=? WHERE id=?`).bind(identity.email||null,identity.name||null,identity.avatarUrl||null,now(),customer.id).run();
    customer=await env.DB.prepare(`SELECT * FROM customers WHERE id=?`).bind(customer.id).first();
  }
  return customer;
}

async function readerLibrary(env,customerId){
  const rows=await all(env.DB.prepare(`SELECT ce.id entitlement_id,ce.status entitlement_status,ce.granted_at,e.id edition_id,e.format,e.price_minor,b.id book_id,b.slug,b.title,b.subtitle,b.cover_url,b.series_name,b.series_number,a.display_name author_name,a.handle author_handle,rp.percent,rp.progress_kind,rp.seconds_position,rp.locator_json,rp.completed_at,rp.updated_at progress_updated_at FROM customer_entitlements ce JOIN editions e ON e.id=ce.edition_id JOIN books b ON b.id=e.book_id JOIN authors a ON a.id=b.author_id LEFT JOIN reader_progress rp ON rp.customer_id=ce.customer_id AND rp.edition_id=ce.edition_id WHERE ce.customer_id=? AND ce.status='active' ORDER BY COALESCE(rp.updated_at,ce.granted_at) DESC`).bind(customerId));
  return rows.map(r=>({...r,percent:Number(r.percent||0),locator:safeAddress(r.locator_json)}));
}

async function readerSaved(env,customerId){
  const ids=await all(env.DB.prepare(`SELECT book_id,created_at FROM customer_saved_books WHERE customer_id=? ORDER BY created_at DESC`).bind(customerId));
  if(!ids.length)return [];
  const books=await getCatalog(env);const byId=new Map(books.map(b=>[b.id,b]));return ids.map(x=>({...byId.get(x.book_id),savedAt:x.created_at})).filter(x=>x.id);
}

async function readerRecent(env,customerId){
  const ids=await all(env.DB.prepare(`SELECT book_id,last_viewed_at,view_count FROM customer_recent_books WHERE customer_id=? ORDER BY last_viewed_at DESC LIMIT 20`).bind(customerId));
  if(!ids.length)return [];
  const books=await getCatalog(env);const byId=new Map(books.map(b=>[b.id,b]));return ids.map(x=>({...byId.get(x.book_id),lastViewedAt:x.last_viewed_at,viewCount:Number(x.view_count||0)})).filter(x=>x.id);
}

async function getCatalog(env,slug=null){
  const where=slug?`AND b.slug=?`:'';
  const sql=`SELECT b.id book_id,b.slug,b.title,b.subtitle,b.description,b.long_description,b.cover_url,b.primary_category,b.series_name,b.series_number,
    a.id author_id,a.display_name author_name,a.handle author_handle,a.avatar_url author_avatar_url,a.bio author_bio,a.website_url author_website_url,a.storefront_tagline,
    l.id listing_id,l.status listing_status,l.visibility,l.published_at,l.scheduled_live_at,l.editor_revision,l.display_title,l.display_subtitle,l.description_override,l.long_description_override,l.cover_override_url,l.category_override,l.excerpt,
    e.id edition_id,e.format,e.isbn,e.currency,e.price_minor,e.status edition_status,e.fulfillment_provider,e.inventory_status,e.provider_purchase_url,e.provider_cost_minor,e.publishing_source_edition_id,e.production_status,e.artifact_ref,e.artifact_hash,e.production_synced_at
    FROM listings l JOIN books b ON b.id=l.book_id JOIN authors a ON a.id=b.author_id
    LEFT JOIN editions e ON e.book_id=b.id
    WHERE l.status='live' AND l.visibility='public' ${where}
    ORDER BY COALESCE(l.featured_rank,9999),l.published_at DESC,b.title,e.price_minor`;
  const rows=slug?await all(env.DB.prepare(sql).bind(slug)):await all(env.DB.prepare(sql));
  return catalogFromRows(rows);
}

async function getAuthorBooks(env,authorId){
  const rows=await all(env.DB.prepare(`SELECT b.id book_id,b.slug,b.title,b.subtitle,b.description,b.long_description,b.cover_url,b.primary_category,b.status book_status,b.publishing_source_id,b.source_revision,b.production_sync_status,b.production_synced_at,
    l.id listing_id,l.status listing_status,l.visibility,l.published_at,l.author_approved_at,l.last_readiness_check_at,l.scheduled_live_at,l.editor_revision,l.display_title,l.display_subtitle,l.description_override,l.long_description_override,l.cover_override_url,l.category_override,l.excerpt,l.seo_title,l.seo_description,l.last_saved_at,
    e.id edition_id,e.format,e.isbn,e.currency,e.price_minor,e.status edition_status,e.fulfillment_provider,e.inventory_status,e.provider_purchase_url,e.provider_cost_minor,e.publishing_source_edition_id,e.production_status,e.artifact_ref,e.artifact_hash,e.production_synced_at
    FROM books b LEFT JOIN listings l ON l.book_id=b.id LEFT JOIN editions e ON e.book_id=b.id WHERE b.author_id=? ORDER BY b.updated_at DESC,e.format`).bind(authorId));
  const grouped=new Map();
  for(const r of rows){
    if(!grouped.has(r.book_id)) grouped.set(r.book_id,{id:r.book_id,slug:r.slug,title:r.display_title||r.title,sourceTitle:r.title,subtitle:r.display_subtitle??r.subtitle,sourceSubtitle:r.subtitle,description:r.description_override??r.description,longDescription:r.long_description_override??r.long_description,coverUrl:r.cover_override_url??r.cover_url,category:r.category_override??r.primary_category,excerpt:r.excerpt||null,status:r.book_status,publishingSourceId:r.publishing_source_id,sourceRevision:r.source_revision,productionSyncStatus:r.production_sync_status,productionSyncedAt:r.production_synced_at,listing:r.listing_id?{id:r.listing_id,status:r.listing_status,visibility:r.visibility,publishedAt:r.published_at,authorApprovedAt:r.author_approved_at,lastReadinessCheckAt:r.last_readiness_check_at,scheduledLiveAt:r.scheduled_live_at,editorRevision:Number(r.editor_revision||0),seoTitle:r.seo_title,seoDescription:r.seo_description,lastSavedAt:r.last_saved_at}:null,editions:[]});
    if(r.edition_id) grouped.get(r.book_id).editions.push({id:r.edition_id,format:r.format,isbn:r.isbn,currency:r.currency,priceMinor:r.price_minor,status:r.edition_status,fulfillmentProvider:r.fulfillment_provider,inventoryStatus:r.inventory_status,providerPurchaseUrl:r.provider_purchase_url,providerCostMinor:r.provider_cost_minor,publishingSourceEditionId:r.publishing_source_edition_id,productionStatus:r.production_status,artifactRef:r.artifact_ref,artifactHash:r.artifact_hash,productionSyncedAt:r.production_synced_at});
  }
  return [...grouped.values()];
}

async function catalogEditorState(env,author,bookId){
  const book=await env.DB.prepare(`SELECT * FROM books WHERE id=? AND author_id=?`).bind(bookId,author.id).first();if(!book)return null;
  let listing=await env.DB.prepare(`SELECT * FROM listings WHERE book_id=?`).bind(bookId).first();
  if(!listing){const id=uuid();await env.DB.prepare(`INSERT INTO listings (id,book_id,status,visibility,created_at,updated_at) VALUES (?,?,'draft','public',?,?)`).bind(id,bookId,now(),now()).run();listing=await env.DB.prepare(`SELECT * FROM listings WHERE id=?`).bind(id).first();}
  const editions=await all(env.DB.prepare(`SELECT * FROM editions WHERE book_id=? ORDER BY format`).bind(bookId));
  const current={book:{...book,displayTitle:listing.display_title,displaySubtitle:listing.display_subtitle,description:listing.description_override??book.description,longDescription:listing.long_description_override??book.long_description,coverUrl:listing.cover_override_url??book.cover_url,primaryCategory:listing.category_override??book.primary_category,excerpt:listing.excerpt},listing:{...listing,seoTitle:listing.seo_title,seoDescription:listing.seo_description,launchAt:listing.scheduled_live_at},author:{...author,displayName:author.display_name,websiteUrl:author.website_url,storefrontTagline:author.storefront_tagline},editions:editions.map(e=>({...e,priceMinor:Number(e.price_minor||0)}))};
  const stored=await env.DB.prepare(`SELECT * FROM catalog_drafts WHERE book_id=? AND author_id=?`).bind(bookId,author.id).first();
  let draft,draftRevision=0,validation=null;
  if(stored){try{draft=JSON.parse(stored.draft_json);validation=stored.validation_json?JSON.parse(stored.validation_json):null}catch{draft=null}draftRevision=Number(stored.draft_revision||0)}
  if(!draft) draft=normalizeCatalogDraft({},current);
  if(!validation) validation=validateCatalogDraft(draft,{book,editions:current.editions.map(e=>({id:e.id,format:e.format,isbn:e.isbn,productionStatus:e.production_status}))});
  return {book,listing,editions,current,draft,draftRevision,listingRevision:Number(listing.editor_revision||0),authorRevision:Number(author.profile_revision||0),validation};
}

async function saveCatalogDraft(env,author,bookId,body={}){
  const state=await catalogEditorState(env,author,bookId);if(!state)return null;
  const expected=body.baseDraftRevision==null?state.draftRevision:Number(body.baseDraftRevision);
  if(expected!==state.draftRevision){const err=new Error('stale_catalog_draft');err.status=409;err.currentDraftRevision=state.draftRevision;throw err;}
  const draft=normalizeCatalogDraft(body.draft||{},state.current);
  const validation=validateCatalogDraft(draft,{book:state.book,editions:state.editions.map(e=>({id:e.id,format:e.format,isbn:e.isbn,productionStatus:e.production_status}))});
  const next=state.draftRevision+1,stamp=now();
  await env.DB.prepare(`INSERT INTO catalog_drafts (book_id,author_id,draft_revision,base_listing_revision,base_author_revision,draft_json,validation_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'working',?,?) ON CONFLICT(book_id) DO UPDATE SET draft_revision=excluded.draft_revision,base_listing_revision=excluded.base_listing_revision,base_author_revision=excluded.base_author_revision,draft_json=excluded.draft_json,validation_json=excluded.validation_json,status='working',updated_at=excluded.updated_at,applied_at=NULL`).bind(bookId,author.id,next,state.listingRevision,state.authorRevision,JSON.stringify(draft),JSON.stringify(validation),stamp,stamp).run();
  await env.DB.prepare(`INSERT INTO catalog_validation_runs (id,author_id,book_id,draft_revision,valid,errors_json,warnings_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(uuid(),author.id,bookId,next,validation.valid?1:0,JSON.stringify(validation.errors),JSON.stringify(validation.warnings),stamp).run();
  return {draft,draftRevision:next,baseListingRevision:state.listingRevision,baseAuthorRevision:state.authorRevision,validation,savedAt:stamp};
}

async function applyCatalogDraft(env,author,bookId){
  const state=await catalogEditorState(env,author,bookId);if(!state)return null;
  const stored=await env.DB.prepare(`SELECT * FROM catalog_drafts WHERE book_id=? AND author_id=?`).bind(bookId,author.id).first();if(!stored){const err=new Error('catalog_draft_missing');err.status=409;throw err;}
  if(Number(stored.base_listing_revision||0)!==state.listingRevision){const err=new Error('listing_changed_since_draft');err.status=409;throw err;}
  if(Number(stored.base_author_revision||0)!==state.authorRevision){const err=new Error('author_profile_changed_since_draft');err.status=409;throw err;}
  const draft=JSON.parse(stored.draft_json),validation=validateCatalogDraft(draft,{book:state.book,editions:state.editions.map(e=>({id:e.id,format:e.format,isbn:e.isbn,productionStatus:e.production_status}))});
  if(!validation.valid){const err=new Error('catalog_draft_invalid');err.status=409;err.validation=validation;throw err;}
  const beforeDraft=normalizeCatalogDraft({},state.current),before=catalogPreview({draft:beforeDraft,productionBook:state.book,productionEditions:state.editions});
  const after=catalogPreview({draft,productionBook:state.book,productionEditions:state.editions});
  const changed=changedCatalogFields(beforeDraft,draft),stamp=now();
  if(!changed.length){await env.DB.prepare(`UPDATE catalog_drafts SET status='applied',applied_at=?,updated_at=? WHERE book_id=?`).bind(stamp,stamp,bookId).run();return {revision:state.listingRevision,changedFields:[],validation,preview:after,appliedAt:stamp,noOp:true};}
  const nextRevision=state.listingRevision+1,authorChanged=changed.some(x=>x.startsWith('author.')),nextAuthorRevision=state.authorRevision+(authorChanged?1:0);
  const statements=[
    env.DB.prepare(`UPDATE listings SET display_title=?,display_subtitle=?,description_override=?,long_description_override=?,cover_override_url=?,category_override=?,excerpt=?,visibility=?,seo_title=?,seo_description=?,scheduled_live_at=?,editor_revision=?,last_saved_at=?,updated_at=? WHERE book_id=?`).bind(draft.book.displayTitle,draft.book.displaySubtitle,draft.book.description,draft.book.longDescription,draft.book.coverUrl,draft.book.primaryCategory,draft.book.excerpt,draft.listing.visibility,draft.listing.seoTitle,draft.listing.seoDescription,draft.listing.launchAt,nextRevision,stamp,stamp,bookId),
    env.DB.prepare(`UPDATE catalog_drafts SET status='applied',applied_at=?,base_listing_revision=?,base_author_revision=?,updated_at=? WHERE book_id=?`).bind(stamp,nextRevision,nextAuthorRevision,stamp,bookId),
    env.DB.prepare(`INSERT INTO catalog_change_history (id,author_id,book_id,listing_revision,change_type,changed_fields_json,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(uuid(),author.id,bookId,nextRevision,'author_apply',JSON.stringify(changed),JSON.stringify(beforeDraft),JSON.stringify(draft),stamp)
  ];
  if(authorChanged) statements.push(env.DB.prepare(`UPDATE authors SET display_name=?,bio=?,website_url=?,storefront_tagline=?,profile_revision=?,updated_at=? WHERE id=?`).bind(draft.author.displayName,draft.author.bio,draft.author.websiteUrl,draft.author.storefrontTagline,nextAuthorRevision,stamp,author.id));
  for(const e of draft.editions) statements.push(env.DB.prepare(`UPDATE editions SET price_minor=?,status=?,updated_at=? WHERE id=? AND book_id=?`).bind(e.priceMinor,e.status,stamp,e.id,bookId));
  await env.DB.batch(statements);
  await audit(env,{actorType:'author',actorId:author.id,action:'catalog.draft_applied',objectType:'book',objectId:bookId,metadata:{revision:nextRevision,changedFields:changed}});
  return {revision:nextRevision,authorRevision:nextAuthorRevision,changedFields:changed,validation,preview:after,appliedAt:stamp};
}

function periodStart(days){const d=new Date();d.setUTCDate(d.getUTCDate()-Math.max(1,Math.min(365,Number(days)||30)));return d.toISOString();}
async function authorStats(env,authorId,days=30){
  const start=periodStart(days);
  const paid=`('paid','succeeded','partially_refunded')`;
  const totals=await env.DB.prepare(`SELECT COUNT(DISTINCT o.id) orders,COALESCE(SUM(oi.quantity),0) units,COALESCE(SUM(oi.gross_minor),0) gross_sales_minor,COALESCE(SUM(oi.marketplace_fee_minor),0) marketplace_fees_minor,COALESCE(SUM(COALESCE(oi.actual_processor_fee_minor,oi.stripe_fee_minor)),0) processor_fees_minor,COALESCE(SUM(COALESCE(oi.actual_fulfillment_cost_minor,oi.estimated_fulfillment_cost_minor)),0) fulfillment_cost_minor,COALESCE(SUM(oi.refunded_minor),0) refunds_minor,COALESCE(SUM(oi.disputed_minor),0) disputed_minor,COALESCE(SUM(oi.transferred_minor),0) transferred_minor,COALESCE(SUM(oi.seller_payable_minor),0) seller_payable_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.author_id=? AND o.created_at>=? AND o.payment_status IN ('paid','succeeded','partially_refunded')`).bind(authorId,start).first();
  const formats=await all(env.DB.prepare(`SELECT e.format,COALESCE(SUM(oi.quantity),0) units,COALESCE(SUM(oi.gross_minor),0) gross_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN editions e ON e.id=oi.edition_id WHERE oi.author_id=? AND o.created_at>=? AND o.payment_status IN ('paid','succeeded','partially_refunded') GROUP BY e.format ORDER BY gross_minor DESC`).bind(authorId,start));
  const viewsRow=await env.DB.prepare(`SELECT COUNT(*) views FROM marketplace_events me JOIN books b ON b.id=me.book_id WHERE b.author_id=? AND me.occurred_at>=? AND me.event_type IN ('book_viewed','campaign_landing')`).bind(authorId,start).first();
  const campaigns=await all(env.DB.prepare(`SELECT COALESCE(c.name,'Direct / unknown') campaign,COALESCE(c.source,'direct') source,COUNT(DISTINCT o.id) orders,COALESCE(SUM(oi.gross_minor),0) gross_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN campaigns c ON c.id=o.campaign_id WHERE oi.author_id=? AND o.created_at>=? AND o.payment_status IN ('paid','succeeded','partially_refunded') GROUP BY c.id,c.name,c.source ORDER BY gross_minor DESC LIMIT 12`).bind(authorId,start));
  const recentOrders=await all(env.DB.prepare(`SELECT o.id,o.created_at,o.payment_status,o.fulfillment_status,o.risk_status,b.title,e.format,oi.quantity,oi.gross_minor,oi.refunded_minor,oi.seller_payable_minor,oi.transferred_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN editions e ON e.id=oi.edition_id JOIN books b ON b.id=e.book_id WHERE oi.author_id=? ORDER BY o.created_at DESC LIMIT 12`).bind(authorId));
  const externalChannels=await all(env.DB.prepare(`SELECT provider,COALESCE(channel_name,provider) channel,COALESCE(SUM(quantity),0) units,COALESCE(SUM(gross_minor),0) gross_minor,COALESCE(SUM(net_minor),0) net_minor,COALESCE(SUM(returns_minor),0) returns_minor FROM external_channel_sales WHERE author_id=? AND sale_date>=? GROUP BY provider,channel_name ORDER BY gross_minor DESC`).bind(authorId,start));
  const views=Number(viewsRow?.views||0),orders=Number(totals?.orders||0),marketing=await authorMarketingSummary(env,authorId,start);
  return {period:{days:Number(days)||30,start,end:now()},totals:{orders,units:Number(totals?.units||0),grossSalesMinor:Number(totals?.gross_sales_minor||0),marketplaceFeesMinor:Number(totals?.marketplace_fees_minor||0),processorFeesMinor:Number(totals?.processor_fees_minor||0),fulfillmentCostMinor:Number(totals?.fulfillment_cost_minor||0),refundsMinor:Number(totals?.refunds_minor||0),disputedMinor:Number(totals?.disputed_minor||0),transferredMinor:Number(totals?.transferred_minor||0),sellerPayableMinor:Number(totals?.seller_payable_minor||0),views,conversionRate:views?Number(((orders/views)*100).toFixed(2)):0,currency:'usd'},formats:formats.map(x=>({format:x.format,units:Number(x.units),grossMinor:Number(x.gross_minor)})),campaigns:campaigns.map(x=>({campaign:x.campaign,source:x.source,orders:Number(x.orders),grossMinor:Number(x.gross_minor)})),externalChannels:externalChannels.map(x=>({provider:x.provider,channel:x.channel,units:Number(x.units),grossMinor:Number(x.gross_minor),netMinor:Number(x.net_minor),returnsMinor:Number(x.returns_minor)})),marketing,recentOrders};
}


async function analyticsDailyRows(env,authorId,start){
  const sales=await all(env.DB.prepare(`SELECT substr(o.created_at,1,10) metric_date,COUNT(DISTINCT o.id) orders,COALESCE(SUM(oi.quantity),0) units,COALESCE(SUM(oi.gross_minor),0) gross_minor,COALESCE(SUM(oi.refunded_minor),0) refunds_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.author_id=? AND o.created_at>=? AND o.payment_status IN ('paid','succeeded','partially_refunded') GROUP BY substr(o.created_at,1,10) ORDER BY metric_date`).bind(authorId,start));
  const views=await all(env.DB.prepare(`SELECT substr(me.occurred_at,1,10) metric_date,COUNT(*) views FROM marketplace_events me JOIN books b ON b.id=me.book_id WHERE b.author_id=? AND me.occurred_at>=? AND me.event_type IN ('book_viewed','campaign_landing') GROUP BY substr(me.occurred_at,1,10) ORDER BY metric_date`).bind(authorId,start));
  const by=new Map();for(const r of sales)by.set(r.metric_date,{date:r.metric_date,orders:Number(r.orders||0),units:Number(r.units||0),grossMinor:Number(r.gross_minor||0),refundsMinor:Number(r.refunds_minor||0),views:0});for(const r of views){const x=by.get(r.metric_date)||{date:r.metric_date,orders:0,units:0,grossMinor:0,refundsMinor:0,views:0};x.views=Number(r.views||0);by.set(r.metric_date,x)}return [...by.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

async function analyticsBookRows(env,authorId,start){
  const rows=await all(env.DB.prepare(`SELECT b.id book_id,COALESCE(l.display_title,b.title) title,COUNT(DISTINCT o.id) orders,COALESCE(SUM(oi.quantity),0) units,COALESCE(SUM(oi.gross_minor),0) gross_minor,COALESCE(SUM(oi.refunded_minor),0) refunds_minor,COALESCE(SUM(oi.marketplace_fee_minor),0) marketplace_fees_minor,COALESCE(SUM(COALESCE(oi.actual_processor_fee_minor,oi.stripe_fee_minor)),0) processor_fees_minor,COALESCE(SUM(COALESCE(oi.actual_fulfillment_cost_minor,oi.estimated_fulfillment_cost_minor)),0) fulfillment_cost_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN editions e ON e.id=oi.edition_id JOIN books b ON b.id=e.book_id LEFT JOIN listings l ON l.book_id=b.id WHERE oi.author_id=? AND o.created_at>=? AND o.payment_status IN ('paid','succeeded','partially_refunded') GROUP BY b.id,COALESCE(l.display_title,b.title) ORDER BY gross_minor DESC`).bind(authorId,start));
  return rows.map(r=>({bookId:r.book_id,title:r.title,orders:Number(r.orders||0),units:Number(r.units||0),grossMinor:Number(r.gross_minor||0),refundsMinor:Number(r.refunds_minor||0),marketplaceFeesMinor:Number(r.marketplace_fees_minor||0),processorFeesMinor:Number(r.processor_fees_minor||0),fulfillmentCostMinor:Number(r.fulfillment_cost_minor||0)}));
}

async function analyticsBrainForAuthor(env,authorId,days=30){
  days=Math.max(7,Math.min(180,Number(days)||30));
  const [current,wide]=await Promise.all([authorStats(env,authorId,days),authorStats(env,authorId,days*2)]);
  const previous=subtractStats(wide.totals,current.totals),previousFormats=subtractFormats(wide.formats,current.formats);
  const [daily,books]=await Promise.all([analyticsDailyRows(env,authorId,current.period.start),analyticsBookRows(env,authorId,current.period.start)]);
  const brain=buildAnalyticsBrain({current:current.totals,previous,formats:current.formats,marketing:current.marketing,daily,books});
  const states=await all(env.DB.prepare(`SELECT signal_key,status,dismissed_at,snoozed_until,note FROM analytics_signal_state WHERE author_id=?`).bind(authorId));const stateMap=new Map(states.map(x=>[x.signal_key,x]));
  brain.signals=brain.signals.map(x=>({...x,state:stateMap.get(x.key)?.status||'open',dismissedAt:stateMap.get(x.key)?.dismissed_at||null,snoozedUntil:stateMap.get(x.key)?.snoozed_until||null}));
  brain.attention=brain.signals.find(x=>x.state==='open')||brain.signals[0]||null;
  return {...brain,period:current.period,previousFormats,externalChannels:current.externalChannels,marketing:current.marketing};
}

async function persistAnalyticsBrain(env,authorId,brain){
  const stamp=now(),id=uuid();
  await env.DB.prepare(`INSERT INTO analytics_brain_runs (id,author_id,period_days,period_start,period_end,brain_version,result_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id,authorId,brain.period.days,brain.period.start,brain.period.end,brain.version,JSON.stringify(brain),stamp).run();
  for(const s of brain.signals) await env.DB.prepare(`INSERT INTO analytics_signal_state (author_id,signal_key,status,first_seen_at,last_seen_at) VALUES (?,?,'open',?,?) ON CONFLICT(author_id,signal_key) DO UPDATE SET last_seen_at=excluded.last_seen_at`).bind(authorId,s.key,stamp,stamp).run();
  return {runId:id,createdAt:stamp};
}

async function validateCart(env,rawItems){
  const requested=(rawItems||[]).map(x=>({editionId:String(x.editionId||''),quantity:clampQty(x.quantity)})).filter(x=>x.editionId);
  if(!requested.length) throw new Error('items_required');
  const ids=[...new Set(requested.map(x=>x.editionId))];
  const placeholders=ids.map(()=>'?').join(',');
  const rows=await all(env.DB.prepare(`SELECT e.id edition_id,e.format,e.currency,e.price_minor,e.status,e.fulfillment_provider,e.inventory_status,e.isbn,e.provider_sku,e.provider_cost_minor,b.id book_id,b.title,b.author_id,a.display_name author_name,l.status listing_status FROM editions e JOIN books b ON b.id=e.book_id JOIN authors a ON a.id=b.author_id JOIN listings l ON l.book_id=b.id WHERE e.id IN (${placeholders})`).bind(...ids));
  const byId=new Map(rows.map(x=>[x.edition_id,x]));
  return requested.map(req=>{
    const row=byId.get(req.editionId); if(!row) throw new Error(`unknown_edition:${req.editionId}`);
    if(row.status!=='live'||row.listing_status!=='live') throw new Error(`edition_not_live:${req.editionId}`);
    if(row.inventory_status && ['unavailable','out_of_stock','blocked'].includes(row.inventory_status)) throw new Error(`edition_unavailable:${req.editionId}`);
    return {editionId:row.edition_id,bookId:row.book_id,title:row.title,authorId:row.author_id,authorName:row.author_name,format:row.format,currency:row.currency,priceMinor:Number(row.price_minor),quantity:req.quantity,fulfillmentProvider:row.fulfillment_provider,isbn:row.isbn,providerSku:row.provider_sku,providerCostMinor:Number(row.provider_cost_minor||0)};
  });
}

async function createPendingOrder(env,items,campaignId=null){
  const id=`YR-${Date.now().toString(36).toUpperCase()}-${uuid().slice(0,4).toUpperCase()}`;
  const subtotal=items.reduce((s,x)=>s+x.priceMinor*x.quantity,0);
  const statements=[env.DB.prepare(`INSERT INTO orders (id,currency,subtotal_minor,total_minor,payment_status,fulfillment_status,campaign_id,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id,'usd',subtotal,subtotal,'pending','not_started',campaignId||null,now())];
  const feeBps=Number(env.MARKETPLACE_FEE_BPS||500);
  for(const item of items){
    const gross=item.priceMinor*item.quantity;
    const fulfillmentMinor=Math.max(0,Number(item.providerCostMinor||0))*item.quantity;
    const econ=sellerPayable({grossMinor:gross,fulfillmentMinor,stripeFeeMinor:0,feeBps});
    statements.push(env.DB.prepare(`INSERT INTO order_items (id,order_id,edition_id,author_id,quantity,unit_price_minor,gross_minor,estimated_fulfillment_cost_minor,marketplace_fee_minor,seller_payable_minor,fulfillment_provider,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),id,item.editionId,item.authorId,item.quantity,item.priceMinor,gross,fulfillmentMinor,econ.marketplaceFeeMinor,econ.sellerPayableMinor,item.fulfillmentProvider,now()));
  }
  await env.DB.batch(statements);
  return {id,subtotalMinor:subtotal,currency:'usd'};
}


async function recordOrderState(env,{orderId,stateType,fromState=null,toState,source,sourceReference=null,metadata={}}){
  await env.DB.prepare(`INSERT INTO order_status_history (id,order_id,status_type,from_status,to_status,source,source_reference,occurred_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)`).bind(uuid(),orderId,stateType,fromState,toState,source,sourceReference,now(),JSON.stringify(metadata)).run();
}

async function materializePaidOrder(env,orderId,{paymentIntent=null,chargeId=null,customerEmail=null,paymentMethodType=null,sourceEventId=null}={}){
  const order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(orderId).first(); if(!order) throw new Error('order_not_found');
  const was=order.payment_status;
  await env.DB.prepare(`UPDATE orders SET payment_status='paid',paid_at=COALESCE(paid_at,?),stripe_payment_intent_id=COALESCE(stripe_payment_intent_id,?),customer_email=COALESCE(customer_email,?),updated_at=? WHERE id=?`).bind(now(),paymentIntent,customerEmail,now(),orderId).run();
  const items=await all(env.DB.prepare(`SELECT * FROM order_items WHERE order_id=?`).bind(orderId));
  const statements=[];
  const byAuthor=new Map();
  for(const item of items){ const x=byAuthor.get(item.author_id)||{gross:0,fee:0,fulfillment:0,payable:0}; x.gross+=Number(item.gross_minor||0); x.fee+=Number(item.marketplace_fee_minor||0); x.fulfillment+=Number(item.estimated_fulfillment_cost_minor||0); x.payable+=Number(item.seller_payable_minor||0); byAuthor.set(item.author_id,x); }
  for(const [authorId,x] of byAuthor) statements.push(env.DB.prepare(`INSERT OR IGNORE INTO settlement_allocations (id,order_id,author_id,currency,gross_minor,marketplace_fee_minor,processor_fee_minor,fulfillment_cost_minor,refunded_minor,disputed_minor,payable_minor,status,transfer_group,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),orderId,authorId,order.currency||'usd',x.gross,x.fee,0,x.fulfillment,0,0,x.payable,'earned',orderId,now(),now()));
  for(const item of items){
    const entries=[['gross_sale',Number(item.gross_minor)],['marketplace_fee',-Number(item.marketplace_fee_minor||0)],['fulfillment_reserve',-Number(item.estimated_fulfillment_cost_minor||0)],['seller_payable',Number(item.seller_payable_minor||0)]];
    for(const [type,amount] of entries) statements.push(env.DB.prepare(`INSERT OR IGNORE INTO ledger_entries (id,order_id,order_item_id,author_id,type,amount_minor,currency,external_reference,occurred_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(`${orderId}:${item.id}:${type}`,orderId,item.id,item.author_id,type,amount,order.currency||'usd',sourceEventId,now(),JSON.stringify({commerceVersion:order.commerce_version||'0.3.0'})));
    if(item.fulfillment_provider && item.fulfillment_provider!=='none' && item.fulfillment_provider!=='yasready-digital') statements.push(env.DB.prepare(`INSERT OR IGNORE INTO fulfillment_jobs (id,order_item_id,provider,status,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(`fulfill:${item.id}`,item.id,item.fulfillment_provider,'queued',now(),now()));
    statements.push(env.DB.prepare(`UPDATE order_items SET settlement_status='earned',updated_at=? WHERE id=?`).bind(now(),item.id));
  }
  if(statements.length) await env.DB.batch(statements);
  if(was!=='paid') await recordOrderState(env,{orderId,stateType:'payment',fromState:was,toState:'paid',source:'stripe',sourceReference:sourceEventId});
  return {orderId,itemCount:items.length};
}

async function commerceSummary(env,authorId){
  const earned=await env.DB.prepare(`SELECT COALESCE(SUM(CASE WHEN type='seller_payable' THEN amount_minor ELSE 0 END),0) earned,COALESCE(SUM(CASE WHEN type='refund_seller_reversal' THEN -amount_minor ELSE 0 END),0) refunded,COALESCE(SUM(CASE WHEN type='adjustment' THEN amount_minor ELSE 0 END),0) adjustments FROM ledger_entries WHERE author_id=?`).bind(authorId).first();
  const transfers=await env.DB.prepare(`SELECT COALESCE(SUM(amount_minor),0) transferred,COALESCE(SUM(reversed_minor),0) reversed FROM transfer_records WHERE author_id=? AND status IN ('pending','paid','succeeded','partially_reversed','reversed')`).bind(authorId).first();
  return sellerBalance({earnedMinor:earned?.earned,refundedMinor:earned?.refunded,adjustmentsMinor:earned?.adjustments,transferredMinor:transfers?.transferred,reversedMinor:transfers?.reversed});
}

async function uniqueBookSlug(env,base,excludeBookId=null){
  const root=slugify(base); let candidate=root, n=2;
  while(true){
    const row=excludeBookId?await env.DB.prepare(`SELECT id FROM books WHERE slug=? AND id<>?`).bind(candidate,excludeBookId).first():await env.DB.prepare(`SELECT id FROM books WHERE slug=?`).bind(candidate).first();
    if(!row) return candidate; candidate=`${root}-${n++}`;
  }
}

async function ensurePublishingAuthor(env,incoming){
  let author=await env.DB.prepare(`SELECT * FROM authors WHERE user_id=? LIMIT 1`).bind(incoming.userId).first();
  if(author) return author;
  const id=uuid(),handle=`author-${id.slice(0,8)}`;
  await env.DB.prepare(`INSERT INTO authors (id,user_id,display_name,email,handle,marketplace_status,last_seen_at) VALUES (?,?,?,?,?,?,?)`).bind(id,incoming.userId,incoming.author.displayName,incoming.author.email,handle,'active',now()).run();
  return env.DB.prepare(`SELECT * FROM authors WHERE id=?`).bind(id).first();
}

async function applyPublishingHandoff(env,raw,rawText){
  const incoming=normalizePublishingHandoff(raw),payloadHash=await sha256Hex(rawText||raw),receivedAt=now();
  const replay=await env.DB.prepare(`SELECT * FROM publishing_imports WHERE publishing_source_id=? AND payload_hash=? LIMIT 1`).bind(incoming.sourceBookId,payloadHash).first();
  if(replay) return {replayed:true,importId:replay.id,bookId:replay.book_id||null,status:replay.status,disposition:replay.disposition||'duplicate'};
  const author=await ensurePublishingAuthor(env,incoming);
  let link=await env.DB.prepare(`SELECT * FROM publishing_book_links WHERE publishing_source_id=? LIMIT 1`).bind(incoming.sourceBookId).first();
  if(link&&link.user_id!==incoming.userId) throw new Error('publishing_source_owned_by_different_user');
  const importId=uuid();
  await env.DB.prepare(`INSERT INTO publishing_imports (id,user_id,publishing_source_id,schema_version,payload_hash,status,received_at,source_revision,disposition,latest_received_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(importId,incoming.userId,incoming.sourceBookId,incoming.schema,payloadHash,'received',receivedAt,incoming.sourceRevision,'pending',receivedAt).run();
  try{
    let book,created=false;
    if(!link){
      const legacy=await env.DB.prepare(`SELECT * FROM books WHERE publishing_source_id=? AND author_id=? LIMIT 1`).bind(incoming.sourceBookId,author.id).first();
      if(legacy){const linkId=uuid();await env.DB.prepare(`INSERT INTO publishing_book_links (id,user_id,author_id,book_id,publishing_source_id,source_schema_version,source_revision,latest_payload_hash,production_status,last_received_at,last_applied_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(linkId,incoming.userId,author.id,legacy.id,incoming.sourceBookId,incoming.schema,incoming.sourceRevision,payloadHash,'linked_existing',receivedAt,null,receivedAt,receivedAt).run();link=await env.DB.prepare(`SELECT * FROM publishing_book_links WHERE id=?`).bind(linkId).first();}
    }
    if(!link){
      const bookId=uuid(),slug=await uniqueBookSlug(env,incoming.book.suggestedSlug||incoming.book.title);
      await env.DB.prepare(`INSERT INTO books (id,author_id,publishing_source_id,slug,title,subtitle,description,long_description,cover_url,primary_category,status,source_revision,production_sync_status,production_synced_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(bookId,author.id,incoming.sourceBookId,slug,incoming.book.title,incoming.book.subtitle,incoming.book.description,incoming.book.longDescription,incoming.book.coverUrl,incoming.book.primaryCategory,'draft',incoming.sourceRevision,'synced',receivedAt,receivedAt,receivedAt).run();
      await env.DB.prepare(`INSERT INTO listings (id,book_id,status,visibility,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(uuid(),bookId,'draft','public',receivedAt,receivedAt).run();
      const linkId=uuid();
      await env.DB.prepare(`INSERT INTO publishing_book_links (id,user_id,author_id,book_id,publishing_source_id,source_schema_version,source_revision,latest_payload_hash,production_status,last_received_at,last_applied_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(linkId,incoming.userId,author.id,bookId,incoming.sourceBookId,incoming.schema,incoming.sourceRevision,payloadHash,'synced',receivedAt,receivedAt,receivedAt,receivedAt).run();
      link=await env.DB.prepare(`SELECT * FROM publishing_book_links WHERE id=?`).bind(linkId).first(); created=true;
      for(const e of incoming.editions){
        const editionId=uuid();
        await env.DB.prepare(`INSERT INTO editions (id,book_id,format,isbn,currency,price_minor,status,fulfillment_provider,provider_title_id,provider_sku,inventory_status,publishing_source_edition_id,production_status,artifact_ref,artifact_hash,production_synced_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(editionId,bookId,e.format,e.isbn,e.currency,e.suggestedPriceMinor||0,'draft',e.fulfillmentProvider,e.providerTitleId,e.providerSku,e.format==='ebook'||e.format==='audiobook'?'available':'unknown',e.sourceEditionId,e.productionStatus,e.artifactRef,e.artifactHash,receivedAt,receivedAt,receivedAt).run();
        await env.DB.prepare(`INSERT INTO publishing_edition_links (id,publishing_book_link_id,edition_id,publishing_source_edition_id,source_revision,production_status,artifact_ref,artifact_hash,last_received_at,last_applied_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),link.id,editionId,e.sourceEditionId,incoming.sourceRevision,e.productionStatus,e.artifactRef,e.artifactHash,receivedAt,receivedAt,receivedAt,receivedAt).run();
      }
      book=await env.DB.prepare(`SELECT * FROM books WHERE id=?`).bind(bookId).first();
    } else {
      book=await env.DB.prepare(`SELECT * FROM books WHERE id=?`).bind(link.book_id).first(); if(!book) throw new Error('linked_book_missing');
      if(book.author_id!==author.id) throw new Error('publishing_author_mapping_conflict');
      const currentEditions=await all(env.DB.prepare(`SELECT * FROM editions WHERE book_id=?`).bind(book.id));
      const changes=computePublishingDiff({currentBook:book,currentEditions,incoming});
      await env.DB.prepare(`UPDATE books SET title=?,subtitle=?,description=?,long_description=?,cover_url=?,primary_category=?,source_revision=?,production_sync_status='synced',production_synced_at=?,updated_at=? WHERE id=?`).bind(incoming.book.title,incoming.book.subtitle,incoming.book.description,incoming.book.longDescription,incoming.book.coverUrl,incoming.book.primaryCategory,incoming.sourceRevision,receivedAt,receivedAt,book.id).run();
      const currentBySource=new Map(currentEditions.map(e=>[e.publishing_source_edition_id,e]));
      for(const e of incoming.editions){
        const cur=currentBySource.get(e.sourceEditionId);
        if(cur){
          await env.DB.prepare(`UPDATE editions SET format=?,isbn=?,fulfillment_provider=?,provider_title_id=?,provider_sku=?,production_status=?,artifact_ref=?,artifact_hash=?,production_synced_at=?,updated_at=? WHERE id=?`).bind(e.format,e.isbn,e.fulfillmentProvider,e.providerTitleId,e.providerSku,e.productionStatus,e.artifactRef,e.artifactHash,receivedAt,receivedAt,cur.id).run();
          await env.DB.prepare(`UPDATE publishing_edition_links SET source_revision=?,production_status=?,artifact_ref=?,artifact_hash=?,last_received_at=?,last_applied_at=?,updated_at=? WHERE publishing_source_edition_id=?`).bind(incoming.sourceRevision,e.productionStatus,e.artifactRef,e.artifactHash,receivedAt,receivedAt,receivedAt,e.sourceEditionId).run();
        } else {
          const editionId=uuid();
          await env.DB.prepare(`INSERT INTO editions (id,book_id,format,isbn,currency,price_minor,status,fulfillment_provider,provider_title_id,provider_sku,inventory_status,publishing_source_edition_id,production_status,artifact_ref,artifact_hash,production_synced_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(editionId,book.id,e.format,e.isbn,e.currency,e.suggestedPriceMinor||0,'draft',e.fulfillmentProvider,e.providerTitleId,e.providerSku,e.format==='ebook'||e.format==='audiobook'?'available':'unknown',e.sourceEditionId,e.productionStatus,e.artifactRef,e.artifactHash,receivedAt,receivedAt,receivedAt).run();
          await env.DB.prepare(`INSERT INTO publishing_edition_links (id,publishing_book_link_id,edition_id,publishing_source_edition_id,source_revision,production_status,artifact_ref,artifact_hash,last_received_at,last_applied_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),link.id,editionId,e.sourceEditionId,incoming.sourceRevision,e.productionStatus,e.artifactRef,e.artifactHash,receivedAt,receivedAt,receivedAt,receivedAt).run();
        }
      }
      for(const c of changes){const ed=c.sourceEditionId?await env.DB.prepare(`SELECT id FROM editions WHERE publishing_source_edition_id=?`).bind(c.sourceEditionId).first():null;await env.DB.prepare(`INSERT INTO publishing_sync_changes (id,import_id,book_id,edition_id,entity_type,field_name,ownership,old_value_json,incoming_value_json,disposition,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),importId,book.id,ed?.id||null,c.entityType,c.fieldName,c.ownership,JSON.stringify(c.oldValue),JSON.stringify(c.incomingValue),c.disposition,receivedAt).run();}
      await env.DB.prepare(`UPDATE publishing_book_links SET source_schema_version=?,source_revision=?,latest_payload_hash=?,production_status='synced',last_received_at=?,last_applied_at=?,updated_at=? WHERE id=?`).bind(incoming.schema,incoming.sourceRevision,payloadHash,receivedAt,receivedAt,receivedAt,link.id).run();
      book=await env.DB.prepare(`SELECT * FROM books WHERE id=?`).bind(book.id).first();
    }
    await env.DB.prepare(`UPDATE publishing_imports SET status='applied',applied_at=?,book_id=?,disposition=?,latest_received_at=? WHERE id=?`).bind(receivedAt,book.id,created?'created_draft':'synced_production_fields',receivedAt,importId).run();
    await audit(env,{actorType:'service',actorId:'publishing',action:created?'publishing.book_received':'publishing.book_synced',objectType:'book',objectId:book.id,metadata:{sourceBookId:incoming.sourceBookId,sourceRevision:incoming.sourceRevision,payloadHash}});
    return {replayed:false,importId,bookId:book.id,created,status:'applied',disposition:created?'created_draft':'synced_production_fields'};
  }catch(err){await env.DB.prepare(`UPDATE publishing_imports SET status='failed',error_summary=?,disposition='rejected',latest_received_at=? WHERE id=?`).bind(String(err.message||err).slice(0,500),receivedAt,importId).run();throw err;}
}

async function authorBookReadiness(env,author,bookId){
  const book=await env.DB.prepare(`SELECT * FROM books WHERE id=? AND author_id=?`).bind(bookId,author.id).first(); if(!book) return null;
  const listing=await env.DB.prepare(`SELECT * FROM listings WHERE book_id=?`).bind(bookId).first(); const editions=await all(env.DB.prepare(`SELECT * FROM editions WHERE book_id=? ORDER BY format`).bind(bookId));
  const effectiveBook={...book,title:listing?.display_title||book.title,cover_url:listing?.cover_override_url||book.cover_url};
  return {book:effectiveBook,sourceBook:book,listing,editions,readiness:readinessForSale({book:effectiveBook,listing,editions,author})};
}


async function marketingCampaignRows(env,authorId,bookId){
  const campaigns=await all(env.DB.prepare(`SELECT c.*,b.title,b.slug FROM campaigns c JOIN books b ON b.id=c.book_id WHERE c.author_id=? AND c.book_id=? ORDER BY c.created_at DESC`).bind(authorId,bookId));
  const rows=[];
  for(const c of campaigns){
    const visitsRow=await env.DB.prepare(`SELECT COUNT(*) visits FROM marketplace_events WHERE campaign_id=? AND event_type='campaign_landing'`).bind(c.id).first();
    const shortRow=await env.DB.prepare(`SELECT COALESCE(SUM(click_count),0) clicks FROM marketing_short_links WHERE campaign_id=?`).bind(c.id).first();
    const sales=await env.DB.prepare(`SELECT COUNT(DISTINCT o.id) orders,COALESCE(SUM(oi.gross_minor),0) revenue_minor,COALESCE(SUM(oi.refunded_minor),0) refunds_minor FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.campaign_id=? AND oi.author_id=? AND o.payment_status IN ('paid','succeeded','partially_refunded')`).bind(c.id,authorId).first();
    const costs=await env.DB.prepare(`SELECT COALESCE(SUM(amount_minor),0) cost_minor FROM marketing_campaign_costs WHERE campaign_id=? AND author_id=?`).bind(c.id,authorId).first();
    const metric=campaignMetrics({visits:Number(visitsRow?.visits||0),orders:Number(sales?.orders||0),revenueMinor:Number(sales?.revenue_minor||0),refundsMinor:Number(sales?.refunds_minor||0),costMinor:Number(costs?.cost_minor||c.budget_minor||0)});
    rows.push({...c,clicks:Number(shortRow?.clicks||0),label:channelConfig(c.source).label,...metric});
  }
  return rows;
}

async function authorMarketingSummary(env,authorId,start){
  const campaigns=await all(env.DB.prepare(`SELECT c.* FROM campaigns c WHERE c.author_id=? ORDER BY c.created_at DESC`).bind(authorId));
  const rows=[];
  for(const c of campaigns){
    const visits=await env.DB.prepare(`SELECT COUNT(*) n FROM marketplace_events WHERE campaign_id=? AND event_type='campaign_landing' AND occurred_at>=?`).bind(c.id,start).first();
    const sales=await env.DB.prepare(`SELECT COUNT(DISTINCT o.id) orders,COALESCE(SUM(oi.gross_minor),0) revenue_minor,COALESCE(SUM(oi.refunded_minor),0) refunds_minor FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE o.campaign_id=? AND oi.author_id=? AND o.created_at>=? AND o.payment_status IN ('paid','succeeded','partially_refunded')`).bind(c.id,authorId,start).first();
    const costs=await env.DB.prepare(`SELECT COALESCE(SUM(amount_minor),0) n FROM marketing_campaign_costs WHERE campaign_id=? AND author_id=? AND occurred_at>=?`).bind(c.id,authorId,start).first();
    rows.push({id:c.id,campaign:c.name,source:c.source,objective:c.objective||'sales',...campaignMetrics({visits:Number(visits?.n||0),orders:Number(sales?.orders||0),revenueMinor:Number(sales?.revenue_minor||0),refundsMinor:Number(sales?.refunds_minor||0),costMinor:Number(costs?.n||0)})});
  }
  const totals=rows.reduce((a,r)=>({visits:a.visits+r.visits,orders:a.orders+r.orders,revenueMinor:a.revenueMinor+r.netRevenueMinor,costMinor:a.costMinor+r.costMinor}),{visits:0,orders:0,revenueMinor:0,costMinor:0});
  return {...campaignMetrics(totals),campaigns:rows,recommendation:marketingRecommendation(rows)};
}

async function marketingStudioState(env,author,bookId,origin){
  const book=await env.DB.prepare(`SELECT b.*,COALESCE(l.display_title,b.title) display_title,COALESCE(l.cover_override_url,b.cover_url) display_cover FROM books b LEFT JOIN listings l ON l.book_id=b.id WHERE b.id=? AND b.author_id=?`).bind(bookId,author.id).first();
  if(!book)return null;
  const campaigns=await marketingCampaignRows(env,author.id,bookId);
  const recommendation=marketingRecommendation(campaigns);
  const canonical=`${origin}/book/${encodeURIComponent(book.slug)}`;
  return {book:{id:book.id,title:book.display_title||book.title,slug:book.slug,coverUrl:book.display_cover||null},campaigns,recommendation,canonicalUrl:canonical,launchKit:launchKit({title:book.display_title||book.title,author:author.display_name,url:canonical,objective:'launch'})};
}

async function marketingShortRedirect(request,env){
  if(!env.DB)return new Response('Not found',{status:404});
  const url=new URL(request.url),slug=decodeURIComponent(url.pathname.slice(3));
  const row=await env.DB.prepare(`SELECT * FROM marketing_short_links WHERE slug=? AND active=1`).bind(slug).first();
  if(!row)return new Response('Not found',{status:404});
  await env.DB.prepare(`UPDATE marketing_short_links SET click_count=click_count+1,last_clicked_at=? WHERE id=?`).bind(now(),row.id).run();
  await writeEvent(env,{type:'short_link_clicked',authorId:row.author_id,bookId:row.book_id,campaignId:row.campaign_id,source:'yasready-short-link',medium:'redirect',properties:{slug}});
  return Response.redirect(row.destination_url,302);
}

async function api(request,env){
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/health') return json({ok:true,version:'0.10.0',commerce:commerceReadiness(env),mode:env.MARKETPLACE_MODE||'demo',authMode:env.YASREADY_AUTH_MODE||'demo',checkoutEnabled:env.CHECKOUT_ENABLED==='true',stripeMode:env.STRIPE_MODE||'off',ingramMode:env.INGRAM_MODE||'off',database:!!env.DB});
  if(!env.DB && !['/api/providers/ingram/status','/api/providers/ingram/readiness','/api/providers/stripe/status'].includes(path)) return noDb();

  if(path==='/api/catalog'&&request.method==='GET') return json({ok:true,books:await getCatalog(env)});
  if(path.startsWith('/api/catalog/')&&request.method==='GET'){
    const slug=decodeURIComponent(path.slice('/api/catalog/'.length)); const books=await getCatalog(env,slug); return books[0]?json({ok:true,book:books[0]}):json({ok:false,error:'book_not_found'},404);
  }
  if(path.startsWith('/api/authors/')&&request.method==='GET'){
    const handle=decodeURIComponent(path.slice('/api/authors/'.length));const books=(await getCatalog(env)).filter(b=>b.author?.handle===handle);if(!books.length)return json({ok:false,error:'author_not_found'},404);return json({ok:true,author:books[0].author,books});
  }
  if(path.startsWith('/api/series/')&&request.method==='GET'){
    const series=decodeURIComponent(path.slice('/api/series/'.length)).replaceAll('-',' ').toLowerCase();const books=(await getCatalog(env)).filter(b=>String(b.series||'').toLowerCase()===series).sort((a,b)=>(a.seriesNumber||999)-(b.seriesNumber||999));if(!books.length)return json({ok:false,error:'series_not_found'},404);return json({ok:true,series:books[0].series,books});
  }

  if(path.startsWith('/api/receipt/')&&request.method==='GET'){
    const token=decodeURIComponent(path.slice('/api/receipt/'.length));
    const order=await env.DB.prepare(`SELECT id,receipt_token,currency,subtotal_minor,tax_minor,shipping_minor,discount_minor,total_minor,payment_status,fulfillment_status,created_at,paid_at FROM orders WHERE receipt_token=?`).bind(token).first();
    if(!order) return json({ok:false,error:'receipt_not_found'},404);
    const items=await all(env.DB.prepare(`SELECT b.title,e.format,oi.quantity,oi.unit_price_minor,oi.gross_minor FROM order_items oi JOIN editions e ON e.id=oi.edition_id JOIN books b ON b.id=e.book_id WHERE oi.order_id=? ORDER BY oi.created_at`).bind(order.id));
    return json({ok:true,receipt:{orderId:order.id,currency:order.currency,subtotalMinor:order.subtotal_minor,taxMinor:order.tax_minor,shippingMinor:order.shipping_minor,discountMinor:order.discount_minor,totalMinor:order.total_minor,paymentStatus:order.payment_status,fulfillmentStatus:order.fulfillment_status,createdAt:order.created_at,paidAt:order.paid_at,items}});
  }

  if(path==='/api/events'&&request.method==='POST'){
    const event=await safeJson(request); if(!event?.type) return json({ok:false,error:'invalid_event'},400); await writeEvent(env,event); return json({ok:true});
  }

  if(path==='/api/session'&&request.method==='GET'){
    const auth=await requireIdentity(request,env); if(auth.response) return auth.response; const author=await ensureAuthor(env,auth.identity);
    return json({ok:true,identity:publicIdentity(auth.identity),author:{id:author.id,displayName:author.display_name,email:author.email,handle:author.handle,avatarUrl:author.avatar_url,bio:author.bio,websiteUrl:author.website_url,storefrontTagline:author.storefront_tagline,stripeOnboardingStatus:author.stripe_onboarding_status,marketplaceStatus:author.marketplace_status},sharedAccount:true});
  }

  if(path.startsWith('/api/reader/')){
    const auth=await requireIdentity(request,env); if(auth.response) return auth.response; const customer=await ensureCustomer(env,auth.identity);
    if(path==='/api/reader/session'&&request.method==='GET') return json({ok:true,identity:publicIdentity(auth.identity),customer:{id:customer.id,userId:customer.user_id,displayName:customer.display_name,email:customer.email}});
    if(path==='/api/reader/library'&&request.method==='GET') return json({ok:true,items:await readerLibrary(env,customer.id)});
    if(path==='/api/reader/saved'&&request.method==='GET') return json({ok:true,books:await readerSaved(env,customer.id)});
    if(path.match(/^\/api\/reader\/saved\/[^/]+$/)&&request.method==='POST'){
      const bookId=decodeURIComponent(path.split('/')[4]); const book=(await getCatalog(env)).find(b=>b.id===bookId); if(!book) return json({ok:false,error:'book_not_found'},404);
      await env.DB.prepare(`INSERT OR IGNORE INTO customer_saved_books (customer_id,book_id,created_at) VALUES (?,?,?)`).bind(customer.id,bookId,now()).run(); return json({ok:true,saved:true,bookId});
    }
    if(path.match(/^\/api\/reader\/saved\/[^/]+$/)&&request.method==='DELETE'){
      const bookId=decodeURIComponent(path.split('/')[4]); await env.DB.prepare(`DELETE FROM customer_saved_books WHERE customer_id=? AND book_id=?`).bind(customer.id,bookId).run(); return json({ok:true,saved:false,bookId});
    }
    if(path==='/api/reader/recent'&&request.method==='GET') return json({ok:true,books:await readerRecent(env,customer.id)});
    if(path.match(/^\/api\/reader\/recent\/[^/]+$/)&&request.method==='POST'){
      const bookId=decodeURIComponent(path.split('/')[4]); const book=(await getCatalog(env)).find(b=>b.id===bookId); if(!book) return json({ok:false,error:'book_not_found'},404);
      await env.DB.prepare(`INSERT INTO customer_recent_books (customer_id,book_id,last_viewed_at,view_count) VALUES (?,?,?,1) ON CONFLICT(customer_id,book_id) DO UPDATE SET last_viewed_at=excluded.last_viewed_at,view_count=customer_recent_books.view_count+1`).bind(customer.id,bookId,now()).run(); return json({ok:true,bookId});
    }
    if(path.match(/^\/api\/reader\/progress\/[^/]+$/)&&request.method==='PATCH'){
      const editionId=decodeURIComponent(path.split('/')[4]); const entitlement=await env.DB.prepare(`SELECT ce.id,e.format FROM customer_entitlements ce JOIN editions e ON e.id=ce.edition_id WHERE ce.customer_id=? AND ce.edition_id=? AND ce.status='active'`).bind(customer.id,editionId).first(); if(!entitlement) return json({ok:false,error:'entitlement_required'},403);
      const progress=normalizeReaderProgress(await safeJson(request)||{}); if(progress.progressKind!==String(entitlement.format).toLowerCase()) return json({ok:false,error:'progress_kind_mismatch'},400);
      await env.DB.prepare(`INSERT INTO reader_progress (customer_id,edition_id,progress_kind,percent,locator_json,seconds_position,completed_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(customer_id,edition_id) DO UPDATE SET progress_kind=excluded.progress_kind,percent=excluded.percent,locator_json=excluded.locator_json,seconds_position=excluded.seconds_position,completed_at=excluded.completed_at,updated_at=excluded.updated_at`).bind(customer.id,editionId,progress.progressKind,progress.percent,progress.locator?JSON.stringify(progress.locator):null,progress.secondsPosition,progress.completed?now():null,now()).run();
      return json({ok:true,editionId,...progress});
    }
    if(path.match(/^\/api\/reader\/follow\/[^/]+$/)&&request.method==='POST'){
      const authorId=decodeURIComponent(path.split('/')[4]); await env.DB.prepare(`INSERT OR IGNORE INTO author_follows (customer_id,author_id,created_at) VALUES (?,?,?)`).bind(customer.id,authorId,now()).run(); return json({ok:true,following:true,authorId});
    }
    if(path.match(/^\/api\/reader\/follow\/[^/]+$/)&&request.method==='DELETE'){
      const authorId=decodeURIComponent(path.split('/')[4]); await env.DB.prepare(`DELETE FROM author_follows WHERE customer_id=? AND author_id=?`).bind(customer.id,authorId).run(); return json({ok:true,following:false,authorId});
    }
    return json({ok:false,error:'reader_route_not_found'},404);
  }

  if(path.startsWith('/api/me/')){
    const auth=await requireIdentity(request,env); if(auth.response) return auth.response; const author=await ensureAuthor(env,auth.identity);

    if(path==='/api/me/overview'&&request.method==='GET'){
      const [books,stats]=await Promise.all([getAuthorBooks(env,author.id),authorStats(env,author.id,30)]);
      return json({ok:true,author,books,stats,sharedIdentity:publicIdentity(auth.identity)});
    }
    if(path==='/api/me/books'&&request.method==='GET') return json({ok:true,books:await getAuthorBooks(env,author.id)});
    if(path.match(/^\/api\/me\/books\/[^/]+\/editor$/)&&request.method==='GET'){
      const bookId=decodeURIComponent(path.split('/')[4]),state=await catalogEditorState(env,author,bookId);if(!state)return json({ok:false,error:'book_not_owned'},404);
      return json({ok:true,bookId,draft:state.draft,draftRevision:state.draftRevision,listingRevision:state.listingRevision,authorRevision:state.authorRevision,validation:state.validation,production:{title:state.book.title,subtitle:state.book.subtitle,coverUrl:state.book.cover_url,primaryCategory:state.book.primary_category},editions:state.editions.map(e=>({id:e.id,format:e.format,isbn:e.isbn,productionStatus:e.production_status,fulfillmentProvider:e.fulfillment_provider}))});
    }
    if(path.match(/^\/api\/me\/books\/[^/]+\/editor$/)&&request.method==='PATCH'){
      const bookId=decodeURIComponent(path.split('/')[4]),body=await safeJson(request)||{};
      try{const saved=await saveCatalogDraft(env,author,bookId,body);if(!saved)return json({ok:false,error:'book_not_owned'},404);return json({ok:true,bookId,...saved})}catch(err){return json({ok:false,error:String(err.message||err),currentDraftRevision:err.currentDraftRevision??null,validation:err.validation??null},err.status||400)}
    }
    if(path.match(/^\/api\/me\/books\/[^/]+\/preview$/)&&request.method==='GET'){
      const bookId=decodeURIComponent(path.split('/')[4]),state=await catalogEditorState(env,author,bookId);if(!state)return json({ok:false,error:'book_not_owned'},404);
      return json({ok:true,bookId,preview:catalogPreview({draft:state.draft,productionBook:state.book,productionEditions:state.editions}),validation:state.validation,draftRevision:state.draftRevision});
    }
    if(path.match(/^\/api\/me\/books\/[^/]+\/apply-draft$/)&&request.method==='POST'){
      const bookId=decodeURIComponent(path.split('/')[4]);try{const applied=await applyCatalogDraft(env,author,bookId);if(!applied)return json({ok:false,error:'book_not_owned'},404);return json({ok:true,bookId,...applied})}catch(err){return json({ok:false,error:String(err.message||err),validation:err.validation??null},err.status||400)}
    }
    if(path.match(/^\/api\/me\/books\/[^/]+\/history$/)&&request.method==='GET'){
      const bookId=decodeURIComponent(path.split('/')[4]),owned=await env.DB.prepare(`SELECT id FROM books WHERE id=? AND author_id=?`).bind(bookId,author.id).first();if(!owned)return json({ok:false,error:'book_not_owned'},404);
      const rows=await all(env.DB.prepare(`SELECT id,listing_revision,change_type,changed_fields_json,created_at FROM catalog_change_history WHERE book_id=? AND author_id=? ORDER BY created_at DESC LIMIT 100`).bind(bookId,author.id));return json({ok:true,bookId,history:rows.map(r=>({...r,changedFields:JSON.parse(r.changed_fields_json||'[]')}))});
    }
    if(path==='/api/me/stats'&&request.method==='GET') return json({ok:true,...await authorStats(env,author.id,url.searchParams.get('days')||30)});
    if(path==='/api/me/analytics-brain'&&request.method==='GET') return json({ok:true,brain:await analyticsBrainForAuthor(env,author.id,url.searchParams.get('days')||30)});
    if(path==='/api/me/analytics-brain/refresh'&&request.method==='POST'){
      const brain=await analyticsBrainForAuthor(env,author.id,url.searchParams.get('days')||30),saved=await persistAnalyticsBrain(env,author.id,brain);return json({ok:true,brain,...saved},201);
    }
    if(path.match(/^\/api\/me\/analytics-signals\/[^/]+\/dismiss$/)&&request.method==='POST'){
      const key=decodeURIComponent(path.split('/')[4]),stamp=now();await env.DB.prepare(`INSERT INTO analytics_signal_state (author_id,signal_key,status,first_seen_at,last_seen_at,dismissed_at) VALUES (?,?,'dismissed',?,?,?) ON CONFLICT(author_id,signal_key) DO UPDATE SET status='dismissed',dismissed_at=excluded.dismissed_at,last_seen_at=excluded.last_seen_at`).bind(author.id,key,stamp,stamp,stamp).run();return json({ok:true,signalKey:key,status:'dismissed'});
    }

    if(path==='/api/me/campaigns'&&request.method==='GET'){
      const rows=await all(env.DB.prepare(`SELECT c.*,b.title,b.slug FROM campaigns c LEFT JOIN books b ON b.id=c.book_id WHERE c.author_id=? ORDER BY c.created_at DESC`).bind(author.id));
      return json({ok:true,campaigns:rows});
    }
    if(path==='/api/me/campaigns'&&request.method==='POST'){
      const body=await safeJson(request); if(!body?.bookId||!body?.name||!body?.source) return json({ok:false,error:'book_name_source_required'},400);
      const book=await env.DB.prepare(`SELECT id,slug,title FROM books WHERE id=? AND author_id=?`).bind(body.bookId,author.id).first(); if(!book) return json({ok:false,error:'book_not_owned'},403);
      const draft=normalizeCampaignDraft(body),id=uuid(),destinationPath=`/book/${book.slug}`;
      await env.DB.prepare(`INSERT INTO campaigns (id,author_id,book_id,name,source,medium,content,destination_path,active,created_at,objective,budget_minor,starts_at,ends_at,status,notes) VALUES (?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?)`).bind(id,author.id,book.id,draft.name,draft.source,draft.medium,body.content?String(body.content).slice(0,120):null,destinationPath,now(),draft.objective,draft.budgetMinor,draft.startsAt,draft.endsAt,'active',draft.notes||null).run();
      const shareUrl=buildCampaignUrl({origin:env.PUBLIC_APP_URL||url.origin,bookSlug:book.slug,campaign:draft.name,source:draft.source,medium:draft.medium,campaignId:id});
      await env.DB.prepare(`INSERT INTO marketing_assets (id,author_id,book_id,campaign_id,asset_type,label,config_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(uuid(),author.id,book.id,id,'campaign_bundle',draft.name,JSON.stringify({shareUrl,objective:draft.objective,source:draft.source,medium:draft.medium}),now()).run();
      if(draft.budgetMinor>0) await env.DB.prepare(`INSERT INTO marketing_campaign_costs (id,author_id,campaign_id,label,amount_minor,source,occurred_at,created_at) VALUES (?,?,?,?,?,'planned_budget',?,?)`).bind(uuid(),author.id,id,'Planned campaign spend',draft.budgetMinor,now(),now()).run();
      const kit=launchKit({title:book.title,author:author.display_name,url:shareUrl,objective:draft.objective});
      await env.DB.prepare(`INSERT INTO marketing_launch_kits (id,author_id,book_id,campaign_id,objective,kit_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).bind(uuid(),author.id,book.id,id,draft.objective,JSON.stringify(kit),now(),now()).run();
      return json({ok:true,campaign:{id,bookId:book.id,name:draft.name,source:draft.source,medium:draft.medium,objective:draft.objective,budgetMinor:draft.budgetMinor,shareUrl},launchKit:kit},201);
    }
    if(path.startsWith('/api/me/marketing-studio/')&&request.method==='GET'){
      const bookId=decodeURIComponent(path.slice('/api/me/marketing-studio/'.length));const state=await marketingStudioState(env,author,bookId,env.PUBLIC_APP_URL||url.origin);return state?json({ok:true,...state}):json({ok:false,error:'book_not_owned'},404);
    }
    if(path.match(/^\/api\/me\/marketing-studio\/[^/]+\/short-links$/)&&request.method==='POST'){
      const bookId=decodeURIComponent(path.split('/')[4]),body=await safeJson(request)||{};const book=await env.DB.prepare(`SELECT id,slug FROM books WHERE id=? AND author_id=?`).bind(bookId,author.id).first();if(!book)return json({ok:false,error:'book_not_owned'},404);
      let campaign=null;if(body.campaignId){campaign=await env.DB.prepare(`SELECT * FROM campaigns WHERE id=? AND author_id=? AND book_id=?`).bind(body.campaignId,author.id,bookId).first();if(!campaign)return json({ok:false,error:'campaign_not_owned'},403)}
      const destination=campaign?buildCampaignUrl({origin:env.PUBLIC_APP_URL||url.origin,bookSlug:book.slug,campaign:campaign.name,source:campaign.source,medium:campaign.medium,campaignId:campaign.id}):`${env.PUBLIC_APP_URL||url.origin}/book/${encodeURIComponent(book.slug)}`;
      const slug=shortLinkSlug(body.name||campaign?.name||book.slug,uuid());const id=uuid();await env.DB.prepare(`INSERT INTO marketing_short_links (id,author_id,book_id,campaign_id,slug,destination_url,active,created_at) VALUES (?,?,?,?,?,?,1,?)`).bind(id,author.id,bookId,campaign?.id||null,slug,destination,now()).run();return json({ok:true,link:{id,slug,url:`${env.PUBLIC_APP_URL||url.origin}/r/${slug}`,destination}},201);
    }
    if(path.match(/^\/api\/me\/marketing-studio\/[^/]+\/costs$/)&&request.method==='POST'){
      const bookId=decodeURIComponent(path.split('/')[4]),body=await safeJson(request)||{};const campaign=await env.DB.prepare(`SELECT c.id FROM campaigns c WHERE c.id=? AND c.author_id=? AND c.book_id=?`).bind(body.campaignId,author.id,bookId).first();if(!campaign)return json({ok:false,error:'campaign_not_owned'},403);const amount=Math.max(0,Math.round(Number(body.amountMinor)||0));if(!amount)return json({ok:false,error:'positive_amount_required'},400);const id=uuid();await env.DB.prepare(`INSERT INTO marketing_campaign_costs (id,author_id,campaign_id,label,amount_minor,source,occurred_at,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id,author.id,campaign.id,String(body.label||'Campaign cost').slice(0,120),amount,'manual',body.occurredAt||now(),now()).run();return json({ok:true,cost:{id,campaignId:campaign.id,amountMinor:amount}},201);
    }
    if(path.startsWith('/api/me/marketing-kit/')&&request.method==='GET'){
      const bookId=decodeURIComponent(path.slice('/api/me/marketing-kit/'.length));
      const book=await env.DB.prepare(`SELECT b.*,a.display_name author_name,l.display_title,l.cover_override_url FROM books b JOIN authors a ON a.id=b.author_id LEFT JOIN listings l ON l.book_id=b.id WHERE b.id=? AND b.author_id=?`).bind(bookId,author.id).first(); if(!book) return json({ok:false,error:'book_not_owned'},404);
      const title=book.display_title||book.title,coverUrl=book.cover_override_url||book.cover_url||'',canonical=`${env.PUBLIC_APP_URL||url.origin}/book/${encodeURIComponent(book.slug)}`;
      const embed=buildEmbedHtml({url:canonical,title,author:book.author_name,coverUrl,priceLabel:'See formats'});
      return json({ok:true,book:{id:book.id,title,slug:book.slug},canonicalUrl:canonical,embedHtml:embed,socialCopy:socialCopy({title,author:book.author_name,url:canonical}),assetTypes:['canonical_link','campaign_link','qr_code','html_book_card','buy_button','social_copy','email_copy']});
    }
    if(path==='/api/me/orders'&&request.method==='GET') return json({ok:true,orders:await listAuthorOrders(env,author.id,{limit:url.searchParams.get('limit')||50})});
    if(path.startsWith('/api/me/orders/')&&request.method==='GET'){
      const orderId=decodeURIComponent(path.slice('/api/me/orders/'.length)); const detail=await getAuthorOrder(env,author.id,orderId); return detail?json({ok:true,...detail}):json({ok:false,error:'order_not_found'},404);
    }
    if(path==='/api/me/settlements'&&request.method==='GET') return json({ok:true,settlements:await all(env.DB.prepare(`SELECT * FROM settlement_allocations WHERE author_id=? ORDER BY created_at DESC LIMIT 200`).bind(author.id))});
    if(path==='/api/me/exceptions'&&request.method==='GET') return json({ok:true,exceptions:await all(env.DB.prepare(`SELECT * FROM commerce_exceptions WHERE author_id=? OR order_id IN (SELECT order_id FROM order_items WHERE author_id=?) ORDER BY opened_at DESC LIMIT 200`).bind(author.id,author.id))});
    if(path==='/api/me/commerce-health'&&request.method==='GET') return json({ok:true,...await commerceHealth(env,author.id)});
    if(path.startsWith('/api/me/refund-request/')&&request.method==='POST'){
      const orderId=decodeURIComponent(path.slice('/api/me/refund-request/'.length)); const owned=await env.DB.prepare(`SELECT 1 ok FROM order_items WHERE order_id=? AND author_id=? LIMIT 1`).bind(orderId,author.id).first(); if(!owned)return json({ok:false,error:'order_not_owned'},403);
      const body=await safeJson(request); const id=await openCommerceException(env,{orderId,authorId:author.id,provider:'stripe',code:'author_refund_request',title:'Author requested refund review',detail:body?.reason||'Author requested a refund review.',metadata:{requestedAmountMinor:body?.amountMinor??null}}); return json({ok:true,requestId:id,status:'queued_for_review'},202);
    }

    if(path==='/api/me/business-export'&&request.method==='GET'){
      const stats=await authorStats(env,author.id,url.searchParams.get('days')||30);
      const brain=await analyticsBrainForAuthor(env,author.id,url.searchParams.get('days')||30);
      const exportData=buildBusinessExport({author,period:stats.period,totals:stats.totals,formats:stats.formats,campaigns:stats.campaigns,channels:stats.externalChannels,marketing:stats.marketing,analytics:{version:brain.version,economics:brain.economics,comparison:brain.comparison,signals:brain.signals.map(x=>({key:x.key,category:x.category,severity:x.severity,title:x.title,state:x.state})),books:brain.books.map(x=>({bookId:x.bookId,title:x.title,contributionMinor:x.contributionMinor,contributionMargin:x.contributionMargin}))}});
      return json({ok:true,export:exportData});
    }
    if(path==='/api/me/stripe/status'&&request.method==='GET'){
      let provider=null;
      if(author.stripe_connected_account_id && ['test','live'].includes(env.STRIPE_MODE||'')){
        try{const acct=await retrieveAccount(env,author.stripe_connected_account_id); provider={id:acct.id,chargesEnabled:acct.charges_enabled,payoutsEnabled:acct.payouts_enabled,detailsSubmitted:acct.details_submitted,requirements:acct.requirements?.currently_due||[]};}catch(err){provider={error:String(err.message||err)}}
      }
      return json({ok:true,mode:env.STRIPE_MODE||'off',connectedAccountId:author.stripe_connected_account_id||null,onboardingStatus:author.stripe_onboarding_status,provider});
    }
    if(path==='/api/me/stripe/onboard'&&request.method==='POST'){
      if(!['test','live'].includes(env.STRIPE_MODE||'')||!env.STRIPE_SECRET_KEY) return json({ok:false,error:'stripe_not_configured'},503);
      let accountId=author.stripe_connected_account_id;
      if(!accountId){
        const acct=await createExpressAccount(env,{email:author.email,country:env.STRIPE_DEFAULT_COUNTRY||'US',metadata:{yasready_author_id:author.id,yasready_user_id:author.user_id}}); accountId=acct.id;
        await env.DB.prepare(`UPDATE authors SET stripe_connected_account_id=?,stripe_onboarding_status='started',updated_at=? WHERE id=?`).bind(accountId,now(),author.id).run();
      }
      const base=env.PUBLIC_APP_URL||url.origin;
      const link=await createAccountLink(env,{account:accountId,refreshUrl:`${base}/?stripe=refresh`,returnUrl:`${base}/?stripe=return`});
      return json({ok:true,url:link.url,expiresAt:link.expires_at,accountId});
    }

    if(path==='/api/me/orders'&&request.method==='GET'){
      const rows=await all(env.DB.prepare(`SELECT DISTINCT o.id,o.created_at,o.paid_at,o.payment_status,o.fulfillment_status,o.total_minor,o.refunded_minor,o.currency,o.customer_email FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE oi.author_id=? ORDER BY o.created_at DESC LIMIT 100`).bind(author.id));
      return json({ok:true,orders:rows});
    }
    if(path==='/api/me/ledger'&&request.method==='GET'){
      const rows=await all(env.DB.prepare(`SELECT id,order_id,order_item_id,type,amount_minor,currency,occurred_at,external_reference FROM ledger_entries WHERE author_id=? ORDER BY occurred_at DESC LIMIT 250`).bind(author.id));
      return json({ok:true,balance:await commerceSummary(env,author.id),entries:rows});
    }
    if(path==='/api/me/payouts'&&request.method==='GET'){
      const payouts=await all(env.DB.prepare(`SELECT * FROM payouts WHERE author_id=? ORDER BY created_at DESC LIMIT 100`).bind(author.id));
      const transfers=await all(env.DB.prepare(`SELECT * FROM transfer_records WHERE author_id=? ORDER BY created_at DESC LIMIT 100`).bind(author.id));
      return json({ok:true,balance:await commerceSummary(env,author.id),payouts,transfers});
    }
    if(path==='/api/me/fulfillment/summary'&&request.method==='GET'){
      const rows=await all(env.DB.prepare(`SELECT fj.status,COUNT(*) count FROM fulfillment_jobs fj JOIN order_items oi ON oi.id=fj.order_item_id WHERE oi.author_id=? GROUP BY fj.status ORDER BY count DESC`).bind(author.id));
      const exceptions=await env.DB.prepare(`SELECT COUNT(*) count FROM commerce_exceptions WHERE status='open' AND provider='ingram' AND (author_id=? OR order_id IN (SELECT order_id FROM order_items WHERE author_id=?))`).bind(author.id,author.id).first();
      const lastSync=await env.DB.prepare(`SELECT sync_type,status,completed_at,rows_seen,rows_written,error_summary FROM provider_sync_runs WHERE provider='ingram' ORDER BY started_at DESC LIMIT 1`).first();
      return json({ok:true,provider:'ingram',statuses:rows,openExceptions:Number(exceptions?.count||0),lastSync:lastSync||null,readiness:ingramReadiness(env)});
    }
    if(path==='/api/me/fulfillment'&&request.method==='GET'){
      const rows=await all(env.DB.prepare(`SELECT fj.*,o.id order_id,b.title,e.format,e.isbn FROM fulfillment_jobs fj JOIN order_items oi ON oi.id=fj.order_item_id JOIN orders o ON o.id=oi.order_id JOIN editions e ON e.id=oi.edition_id JOIN books b ON b.id=e.book_id WHERE oi.author_id=? ORDER BY fj.created_at DESC LIMIT 100`).bind(author.id));
      return json({ok:true,jobs:rows});
    }
    if(path==='/api/me/publishing/imports'&&request.method==='GET'){
      const imports=await all(env.DB.prepare(`SELECT pi.id,pi.publishing_source_id,pi.schema_version,pi.source_revision,pi.payload_hash,pi.status,pi.disposition,pi.received_at,pi.applied_at,pi.error_summary,pi.book_id,b.title FROM publishing_imports pi LEFT JOIN books b ON b.id=pi.book_id WHERE pi.user_id=? ORDER BY pi.received_at DESC LIMIT 100`).bind(auth.identity.userId));
      const links=await all(env.DB.prepare(`SELECT pbl.*,b.title,b.slug,l.status listing_status,l.visibility FROM publishing_book_links pbl JOIN books b ON b.id=pbl.book_id LEFT JOIN listings l ON l.book_id=b.id WHERE pbl.user_id=? ORDER BY pbl.updated_at DESC`).bind(auth.identity.userId));
      return json({ok:true,schema:PUBLISHING_HANDOFF_SCHEMA,imports,links});
    }
    if(path==='/api/me/publishing/changes'&&request.method==='GET'){
      const bookId=url.searchParams.get('bookId'); if(!bookId)return json({ok:false,error:'book_id_required'},400);
      const book=await env.DB.prepare(`SELECT id FROM books WHERE id=? AND author_id=?`).bind(bookId,author.id).first();if(!book)return json({ok:false,error:'book_not_owned'},404);
      const changes=await all(env.DB.prepare(`SELECT psc.*,pi.source_revision,pi.received_at FROM publishing_sync_changes psc JOIN publishing_imports pi ON pi.id=psc.import_id WHERE psc.book_id=? ORDER BY psc.created_at DESC LIMIT 250`).bind(bookId));
      return json({ok:true,bookId,changes});
    }
    if(path.match(/^\/api\/me\/books\/[^/]+\/readiness$/)&&request.method==='GET'){
      const bookId=decodeURIComponent(path.split('/')[4]),out=await authorBookReadiness(env,author,bookId); if(!out)return json({ok:false,error:'book_not_owned'},404);
      await env.DB.prepare(`UPDATE listings SET last_readiness_check_at=?,updated_at=? WHERE book_id=?`).bind(now(),now(),bookId).run();
      return json({ok:true,book:{id:out.book.id,title:out.book.title,slug:out.book.slug,productionSyncStatus:out.book.production_sync_status},listing:{status:out.listing?.status||'draft',visibility:out.listing?.visibility||'public'},editions:out.editions.map(e=>({id:e.id,format:e.format,isbn:e.isbn,priceMinor:e.price_minor,status:e.status,productionStatus:e.production_status,artifactRef:e.artifact_ref,fulfillmentProvider:e.fulfillment_provider})),readiness:out.readiness});
    }
    if(path.match(/^\/api\/me\/books\/[^/]+\/go-live$/)&&request.method==='POST'){
      const bookId=decodeURIComponent(path.split('/')[4]),owned=await authorBookReadiness(env,author,bookId); if(!owned)return json({ok:false,error:'book_not_owned'},404);
      const body=await safeJson(request)||{},selected=new Set(Array.isArray(body.editionIds)?body.editionIds:owned.readiness.eligibleEditionIds),prices=body.prices||{};
      for(const e of owned.editions){if(selected.has(e.id)&&prices[e.id]!=null){const price=Number(prices[e.id]);if(!Number.isInteger(price)||price<=0)return json({ok:false,error:'invalid_price',editionId:e.id},400);await env.DB.prepare(`UPDATE editions SET price_minor=?,updated_at=? WHERE id=? AND book_id=?`).bind(price,now(),e.id,bookId).run();}}
      const refreshed=await authorBookReadiness(env,author,bookId),selectedEditions=refreshed.editions.filter(e=>selected.has(e.id)),check=readinessForSale({book:refreshed.book,listing:refreshed.listing,editions:selectedEditions,author});
      await env.DB.prepare(`INSERT INTO marketplace_launch_events (id,author_id,book_id,action,readiness_json,selected_edition_ids_json,created_at) VALUES (?,?,?,?,?,?,?)`).bind(uuid(),author.id,bookId,check.ready?'go_live':'go_live_blocked',JSON.stringify(check),JSON.stringify([...selected]),now()).run();
      if(!check.ready)return json({ok:false,error:'book_not_ready',readiness:check},409);
      const stamps=now();await env.DB.prepare(`UPDATE editions SET status=CASE WHEN id IN (${[...selected].map(()=>'?').join(',')}) THEN 'live' ELSE status END,updated_at=? WHERE book_id=?`).bind(...selected,stamps,bookId).run();
      await env.DB.prepare(`UPDATE listings SET status='live',author_approved_at=COALESCE(author_approved_at,?),published_at=COALESCE(published_at,?),last_readiness_check_at=?,updated_at=? WHERE book_id=?`).bind(stamps,stamps,stamps,stamps,bookId).run();
      await env.DB.prepare(`UPDATE books SET status='live',marketplace_ready_at=COALESCE(marketplace_ready_at,?),updated_at=? WHERE id=?`).bind(stamps,stamps,bookId).run();
      await audit(env,{actorType:'author',actorId:author.id,action:'marketplace.book_go_live',objectType:'book',objectId:bookId,metadata:{editionIds:[...selected]}});
      return json({ok:true,bookId,status:'live',editionIds:[...selected],readiness:check});
    }
    if(path.match(/^\/api\/me\/books\/[^/]+\/pause$/)&&request.method==='POST'){
      const bookId=decodeURIComponent(path.split('/')[4]),book=await env.DB.prepare(`SELECT id FROM books WHERE id=? AND author_id=?`).bind(bookId,author.id).first();if(!book)return json({ok:false,error:'book_not_owned'},404);
      await env.DB.batch([env.DB.prepare(`UPDATE listings SET status='paused',updated_at=? WHERE book_id=?`).bind(now(),bookId),env.DB.prepare(`UPDATE books SET status='paused',updated_at=? WHERE id=?`).bind(now(),bookId)]);await audit(env,{actorType:'author',actorId:author.id,action:'marketplace.book_paused',objectType:'book',objectId:bookId});return json({ok:true,bookId,status:'paused'});
    }
    return json({ok:false,error:'me_route_not_found'},404);
  }

  if(path==='/api/checkout/plan'&&request.method==='POST'){
    try{const body=await safeJson(request); const items=await validateCart(env,body?.items); const feeBps=Number(env.MARKETPLACE_FEE_BPS||500); return json({ok:true,live:false,items,allocationPlan:stripeAllocationPlan(items.map(x=>({authorId:x.authorId,priceMinor:x.priceMinor,quantity:x.quantity})),feeBps),subtotalMinor:items.reduce((s,x)=>s+x.priceMinor*x.quantity,0),note:'Server-validated plan. Live Checkout remains separately gated.'});}
    catch(err){return json({ok:false,error:'cart_invalid',message:String(err.message||err)},400)}
  }
  if(path==='/api/checkout'&&request.method==='POST'){
    if(env.CHECKOUT_ENABLED!=='true'||!['test','live'].includes(env.STRIPE_MODE||'')||!env.STRIPE_SECRET_KEY) return json({ok:false,error:'checkout_not_enabled',message:'Checkout is fail-closed until Stripe is explicitly configured.'},503);
    try{
      const body=await safeJson(request); const items=await validateCart(env,body?.items); const order=await createPendingOrder(env,items,body?.campaignId||null); const base=env.PUBLIC_APP_URL||url.origin;
      const session=await createCheckoutSession(env,{orderId:order.id,items,successUrl:`${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,cancelUrl:`${base}/?checkout=cancel`,hasPhysical:items.some(x=>['paperback','hardcover'].includes(x.format))});
      await env.DB.prepare(`UPDATE orders SET stripe_checkout_session_id=?,checkout_provider='stripe',checkout_provider_reference=?,updated_at=? WHERE id=?`).bind(session.id,session.id,now(),order.id).run();
      await writeEvent(env,{type:'checkout_session_created',orderId:order.id,campaignId:body?.campaignId||null,properties:{stripeSessionId:session.id,itemCount:items.length,totalMinor:order.subtotalMinor}});
      return json({ok:true,orderId:order.id,checkoutUrl:session.url,sessionId:session.id});
    } catch(err){return json({ok:false,error:'checkout_failed',message:String(err.message||err)},400)}
  }

  if(path==='/api/webhooks/stripe'&&request.method==='POST'){
    const raw=await request.text(),sig=request.headers.get('stripe-signature')||'';
    const validPrimary=await verifyStripeSignature(raw,sig,env.STRIPE_WEBHOOK_SECRET||'');
    const validConnect=!validPrimary&&env.STRIPE_CONNECT_WEBHOOK_SECRET?await verifyStripeSignature(raw,sig,env.STRIPE_CONNECT_WEBHOOK_SECRET):false;
    if(!validPrimary&&!validConnect) return json({ok:false,error:'invalid_signature'},400);
    let event;try{event=JSON.parse(raw)}catch{return json({ok:false,error:'invalid_json'},400)}
    const inserted=await env.DB.prepare(`INSERT OR IGNORE INTO provider_webhook_events (id,provider,external_event_id,event_type,livemode,processing_status,received_at) VALUES (?,?,?,?,?,?,?)`).bind(uuid(),'stripe',event.id,event.type,event.livemode?1:0,'received',now()).run();
    if(!inserted.meta?.changes) return json({ok:true,replayed:true});
    try{const result=await processStripeEvent(env,event);await env.DB.prepare(`UPDATE provider_webhook_events SET processing_status='processed',processed_at=? WHERE provider='stripe' AND external_event_id=?`).bind(now(),event.id).run();return json({ok:true,result});}
    catch(err){await env.DB.prepare(`UPDATE provider_webhook_events SET processing_status='failed',processed_at=?,error_summary=? WHERE provider='stripe' AND external_event_id=?`).bind(now(),String(err.message||err).slice(0,500),event.id).run();return json({ok:false,error:'webhook_processing_failed'},500)}
  }

  if(path==='/api/admin/commerce/summary'&&request.method==='GET'){
    if(!requireAdmin(request,env)) return json({ok:false,error:'unauthorized'},401); return json({ok:true,...await stripeCommerceSummary(env)});
  }
  if(path.startsWith('/api/admin/orders/')&&path.endsWith('/reconcile')&&request.method==='POST'){
    if(!requireAdmin(request,env)) return json({ok:false,error:'unauthorized'},401); const orderId=decodeURIComponent(path.slice('/api/admin/orders/'.length,-'/reconcile'.length));
    try{return json({ok:true,...await reconcileStripeOrder(env,orderId)})}catch(err){await openCommerceException(env,{orderId,provider:'stripe',code:'reconciliation_failed',title:'Stripe reconciliation failed',detail:String(err.message||err)});return json({ok:false,error:'reconciliation_failed',message:String(err.message||err)},400)}
  }
  if(path.startsWith('/api/admin/orders/')&&path.endsWith('/refund')&&request.method==='POST'){
    if(!requireAdmin(request,env)) return json({ok:false,error:'unauthorized'},401); if(env.REFUNDS_ENABLED!=='true'||!['test','live'].includes(env.STRIPE_MODE||'')||!env.STRIPE_SECRET_KEY)return json({ok:false,error:'refunds_not_enabled'},503);
    const orderId=decodeURIComponent(path.slice('/api/admin/orders/'.length,-'/refund'.length)),order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(orderId).first();if(!order)return json({ok:false,error:'order_not_found'},404);if(!order.stripe_payment_intent_id)return json({ok:false,error:'payment_reference_missing'},409);
    const body=await safeJson(request),amount=body?.amountMinor==null?null:Math.max(1,Math.min(Number(body.amountMinor),Number(order.total_minor||0)));
    try{const refund=await createRefund(env,{paymentIntent:order.stripe_payment_intent_id,amount,reason:body?.reason||null,metadata:{yasready_order_id:orderId},idempotencyKey:`refund:${orderId}:${amount||'full'}:${body?.requestId||'manual'}`});await audit(env,{actorType:'admin',action:'refund.created',objectType:'order',objectId:orderId,orderId,metadata:{refundId:refund.id,amountMinor:refund.amount}});return json({ok:true,refundId:refund.id,status:refund.status,amountMinor:refund.amount,note:'Transfer recovery/reversal is reconciled separately.'},202)}catch(err){return json({ok:false,error:'refund_failed',message:String(err.message||err)},400)}
  }
  if(path.startsWith('/api/admin/settlements/')&&path.endsWith('/transfer')&&request.method==='POST'){
    if(!requireAdmin(request,env))return json({ok:false,error:'unauthorized'},401);if(env.TRANSFERS_ENABLED!=='true'||!['test','live'].includes(env.STRIPE_MODE||'')||!env.STRIPE_SECRET_KEY)return json({ok:false,error:'transfers_not_enabled'},503);
    const allocationId=decodeURIComponent(path.slice('/api/admin/settlements/'.length,-'/transfer'.length));
    const a=await env.DB.prepare(`SELECT sa.*,au.stripe_connected_account_id,au.stripe_onboarding_status,(SELECT COUNT(*) FROM settlement_holds sh WHERE sh.settlement_allocation_id=sa.id AND sh.status='active') active_holds,(SELECT external_charge_id FROM payment_records pr WHERE pr.order_id=sa.order_id AND pr.provider='stripe' ORDER BY pr.created_at DESC LIMIT 1) source_charge FROM settlement_allocations sa JOIN authors au ON au.id=sa.author_id WHERE sa.id=?`).bind(allocationId).first();
    if(!a)return json({ok:false,error:'settlement_not_found'},404);if(Number(a.active_holds||0)>0)return json({ok:false,error:'settlement_on_hold'},409);if(a.status!=='ready_to_transfer')return json({ok:false,error:'settlement_not_ready',status:a.status},409);if(!a.stripe_connected_account_id)return json({ok:false,error:'author_payout_account_missing'},409);if(a.stripe_onboarding_status!=='ready')return json({ok:false,error:'author_payout_account_not_ready',status:a.stripe_onboarding_status},409);
    try{const tr=await createTransfer(env,{amount:Number(a.payable_minor),currency:a.currency||'usd',destination:a.stripe_connected_account_id,transferGroup:a.order_id,sourceTransaction:a.source_charge||null,metadata:{yasready_order_id:a.order_id,yasready_author_id:a.author_id,yasready_settlement_id:a.id},idempotencyKey:`transfer:${a.id}:${a.payable_minor}`});await env.DB.prepare(`INSERT INTO transfer_records (id,order_id,author_id,provider,external_transfer_id,source_transaction_id,amount_minor,reversed_minor,currency,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,external_transfer_id) DO NOTHING`).bind(uuid(),a.order_id,a.author_id,'stripe',tr.id,a.source_charge||null,Number(tr.amount||a.payable_minor),0,String(tr.currency||a.currency||'usd'),'submitted',now(),now()).run();const items=await all(env.DB.prepare(`SELECT id,seller_payable_minor FROM order_items WHERE order_id=? AND author_id=? ORDER BY created_at,id`).bind(a.order_id,a.author_id)),parts=allocateProRata(Number(tr.amount||a.payable_minor),items.map(x=>({grossMinor:Number(x.seller_payable_minor||0)})));for(let i=0;i<items.length;i++)await env.DB.prepare(`UPDATE order_items SET stripe_transfer_id=?,transferred_minor=?,updated_at=? WHERE id=?`).bind(tr.id,parts[i]||0,now(),items[i].id).run();await env.DB.prepare(`UPDATE settlement_allocations SET stripe_transfer_id=?,status='transferred',updated_at=? WHERE id=?`).bind(tr.id,now(),a.id).run();await audit(env,{actorType:'admin',action:'transfer.created',objectType:'settlement',objectId:a.id,orderId:a.order_id,metadata:{transferId:tr.id,amountMinor:tr.amount}});return json({ok:true,transferId:tr.id,amountMinor:tr.amount,status:'transferred'})}catch(err){await openCommerceException(env,{orderId:a.order_id,authorId:a.author_id,provider:'stripe',code:'transfer_failed',title:'Author transfer failed',detail:String(err.message||err),providerReference:a.id});return json({ok:false,error:'transfer_failed',message:String(err.message||err)},400)}
  }

  if(path==='/api/providers/ingram/readiness'&&request.method==='GET') return json({ok:true,...ingramReadiness(env),lifecycle:['metadata','stock','purchase_order','purchase_order_ack','pick_pack','asn','invoice'],publicBasis:'Ingram CDF/EDI retailer lifecycle; transport remains agreement-specific.'});

  if(path==='/api/admin/ingram/queue'&&request.method==='GET'){
    if(!requireAdmin(request,env))return json({ok:false,error:'unauthorized'},401);
    const jobs=await all(env.DB.prepare(`SELECT fj.*,oi.order_id,oi.author_id,oi.title_snapshot,oi.format_snapshot,e.isbn,e.provider_sku FROM fulfillment_jobs fj JOIN order_items oi ON oi.id=fj.order_item_id LEFT JOIN editions e ON e.id=oi.edition_id WHERE fj.provider='ingram' ORDER BY CASE fj.status WHEN 'failed' THEN 0 WHEN 'queued' THEN 1 WHEN 'ready' THEN 2 ELSE 3 END,fj.created_at LIMIT 250`));
    return json({ok:true,jobs,readiness:ingramReadiness(env)});
  }

  if(path.startsWith('/api/admin/ingram/jobs/')&&path.endsWith('/retry')&&request.method==='POST'){
    if(!requireAdmin(request,env))return json({ok:false,error:'unauthorized'},401);
    if(env.INGRAM_RETRY_ENABLED!=='true')return json({ok:false,error:'ingram_retry_disabled'},503);
    const jobId=decodeURIComponent(path.slice('/api/admin/ingram/jobs/'.length,-'/retry'.length));
    const job=await env.DB.prepare(`SELECT * FROM fulfillment_jobs WHERE id=? AND provider='ingram'`).bind(jobId).first();if(!job)return json({ok:false,error:'fulfillment_job_not_found'},404);
    const attempt=Number(job.submission_attempts||0)+1,wait=nextRetrySeconds(attempt),next=new Date(Date.now()+wait*1000).toISOString();
    await env.DB.prepare(`UPDATE fulfillment_jobs SET status='queued',submission_attempts=?,next_retry_at=?,last_error_code=NULL,last_error_detail=NULL,updated_at=? WHERE id=?`).bind(attempt,next,now(),jobId).run();
    await env.DB.prepare(`INSERT INTO fulfillment_attempts (id,fulfillment_job_id,provider,attempt_number,transport,status,started_at,next_retry_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)`).bind(uuid(),jobId,'ingram',attempt,env.INGRAM_MODE||'off','queued',now(),next,JSON.stringify({manualRetry:true})).run();
    await audit(env,{actorType:'admin',actorId:'commerce-admin',action:'ingram.fulfillment.retry_queued',objectType:'fulfillment_job',objectId:jobId,orderId:null,metadata:{attempt,nextRetryAt:next}});
    return json({ok:true,jobId,attempt,nextRetryAt:next});
  }

  if(path==='/api/admin/ingram/dead-letters'&&request.method==='GET'){
    if(!requireAdmin(request,env))return json({ok:false,error:'unauthorized'},401);
    const rows=await all(env.DB.prepare(`SELECT * FROM provider_dead_letters WHERE provider='ingram' ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,last_seen_at DESC LIMIT 250`));
    return json({ok:true,deadLetters:rows});
  }

  if(path==='/api/providers/ingram/metadata/import'&&request.method==='POST'){
    if(env.INGRAM_METADATA_IMPORT_ENABLED!=='true')return json({ok:false,error:'ingram_metadata_import_disabled'},503);if(!requireProviderSecret(request,env))return json({ok:false,error:'unauthorized_provider_import'},401);
    const body=await safeJson(request),rows=Array.isArray(body?.rows)?body.rows:[];if(!rows.length)return json({ok:false,error:'rows_required'},400);
    const runId=uuid(),started=now();await env.DB.prepare(`INSERT INTO provider_sync_runs (id,provider,sync_type,status,started_at,rows_seen,rows_written) VALUES (?,?,?,?,?,?,?)`).bind(runId,'ingram','metadata_feed','running',started,rows.length,0).run();let written=0,failed=0;
    for(const raw of rows){try{const x=normalizeMetadataRow(raw);await env.DB.prepare(`INSERT INTO provider_metadata_snapshots (id,provider,isbn,title,author,publisher,imprint,format,cover_url,publication_date,source_reference,captured_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram',x.isbn,x.title,x.author,x.publisher,x.imprint,x.format,x.coverUrl,x.publicationDate,body.sourceReference||null,now(),JSON.stringify(raw)).run();written++;}catch(err){failed++;const e=normalizeBridgeError(err);await env.DB.prepare(`INSERT INTO provider_dead_letters (id,provider,record_type,external_reference,reason_code,reason_detail,status,first_seen_at,last_seen_at,attempts,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram','metadata',raw?.isbn||null,e.code,e.message,'open',now(),now(),1,JSON.stringify(raw)).run();}}
    await env.DB.prepare(`UPDATE provider_sync_runs SET status=?,completed_at=?,rows_written=?,error_summary=? WHERE id=?`).bind(failed?'completed_with_exceptions':'completed',now(),written,failed?`${failed} rows moved to dead-letter queue`:null,runId).run();await env.DB.prepare(`INSERT INTO provider_sync_cursors (provider,sync_type,cursor_value,last_attempt_at,last_success_at,last_run_id,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(provider,sync_type) DO UPDATE SET cursor_value=excluded.cursor_value,last_attempt_at=excluded.last_attempt_at,last_success_at=excluded.last_success_at,last_run_id=excluded.last_run_id,updated_at=excluded.updated_at`).bind('ingram','metadata_feed',body.cursor||null,now(),now(),runId,now()).run();return json({ok:true,runId,rowsSeen:rows.length,rowsWritten:written,deadLetters:failed});
  }

  if(path==='/api/providers/ingram/inventory/import'&&request.method==='POST'){
    if(env.INGRAM_INVENTORY_IMPORT_ENABLED!=='true')return json({ok:false,error:'ingram_inventory_import_disabled'},503);if(!requireProviderSecret(request,env))return json({ok:false,error:'unauthorized_provider_import'},401);
    const body=await safeJson(request),rows=Array.isArray(body?.rows)?body.rows:[];if(!rows.length)return json({ok:false,error:'rows_required'},400);
    const runId=uuid(),started=now();await env.DB.prepare(`INSERT INTO provider_sync_runs (id,provider,sync_type,status,started_at,rows_seen,rows_written) VALUES (?,?,?,?,?,?,?)`).bind(runId,'ingram','inventory_feed','running',started,rows.length,0).run();let written=0,failed=0;
    for(const raw of rows){try{const x=normalizeInventoryRow(raw);await env.DB.prepare(`INSERT INTO provider_inventory_snapshots (id,provider,isbn,provider_sku,availability,raw_availability,on_hand,unit_cost_minor,currency,source_reference,captured_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram',x.isbn,x.providerSku,x.availability,x.rawAvailability,x.onHand,x.unitCostMinor,x.currency,body.sourceReference||null,now(),JSON.stringify(raw)).run();const e=await env.DB.prepare(`SELECT id FROM editions WHERE isbn=? LIMIT 1`).bind(x.isbn).first();if(e)await env.DB.prepare(`UPDATE editions SET inventory_status=?,provider_cost_minor=COALESCE(?,provider_cost_minor),updated_at=? WHERE id=?`).bind(x.availability,x.unitCostMinor,now(),e.id).run();written++;}catch(err){failed++;const e=normalizeBridgeError(err);await env.DB.prepare(`INSERT INTO provider_dead_letters (id,provider,record_type,external_reference,reason_code,reason_detail,status,first_seen_at,last_seen_at,attempts,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram','inventory',raw?.isbn||null,e.code,e.message,'open',now(),now(),1,JSON.stringify(raw)).run();}}
    await env.DB.prepare(`UPDATE provider_sync_runs SET status=?,completed_at=?,rows_written=?,error_summary=? WHERE id=?`).bind(failed?'completed_with_exceptions':'completed',now(),written,failed?`${failed} rows moved to dead-letter queue`:null,runId).run();await env.DB.prepare(`INSERT INTO provider_sync_cursors (provider,sync_type,cursor_value,last_attempt_at,last_success_at,last_run_id,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(provider,sync_type) DO UPDATE SET cursor_value=excluded.cursor_value,last_attempt_at=excluded.last_attempt_at,last_success_at=excluded.last_success_at,last_run_id=excluded.last_run_id,updated_at=excluded.updated_at`).bind('ingram','inventory_feed',body.cursor||null,now(),now(),runId,now()).run();return json({ok:true,runId,rowsSeen:rows.length,rowsWritten:written,deadLetters:failed});
  }

  if(path==='/api/providers/ingram/invoice/import'&&request.method==='POST'){
    if(env.INGRAM_INVOICE_IMPORT_ENABLED!=='true')return json({ok:false,error:'ingram_invoice_import_disabled'},503);if(!requireProviderSecret(request,env))return json({ok:false,error:'unauthorized_provider_import'},401);
    const raw=await safeJson(request);let inv;try{inv=normalizeInvoice(raw||{})}catch(err){return json({ok:false,error:'invalid_ingram_invoice',message:String(err.message||err)},400)}
    const order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(inv.orderReference).first();if(!order)return json({ok:false,error:'order_not_found'},404);
    const providerInvoiceId=uuid(),result=await env.DB.prepare(`INSERT OR IGNORE INTO provider_invoices (id,provider,external_invoice_id,order_id,invoice_date,currency,subtotal_minor,shipping_minor,tax_minor,total_minor,status,received_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(providerInvoiceId,'ingram',inv.invoiceId,order.id,inv.invoiceDate,inv.currency,inv.subtotalMinor,inv.shippingMinor,inv.taxMinor,inv.totalMinor,'received',now(),JSON.stringify(raw||{})).run();if(Number(result.meta?.changes||0)===0)return json({ok:true,replayed:true,invoiceId:inv.invoiceId,orderId:order.id});
    for(const line of inv.lines){let orderItemId=line.orderItemId;if(!orderItemId&&line.isbn){const hit=await env.DB.prepare(`SELECT oi.id FROM order_items oi JOIN editions e ON e.id=oi.edition_id WHERE oi.order_id=? AND e.isbn=? LIMIT 1`).bind(order.id,line.isbn).first();orderItemId=hit?.id||null;}await env.DB.prepare(`INSERT INTO provider_invoice_lines (id,provider_invoice_id,line_number,order_item_id,isbn,quantity,amount_minor,shipping_minor,tax_minor,currency,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),providerInvoiceId,line.lineNumber,orderItemId,line.isbn,line.quantity,line.amountMinor,line.shippingMinor,line.taxMinor,line.currency,JSON.stringify(line)).run();if(orderItemId&&line.amountMinor!=null){await env.DB.prepare(`UPDATE order_items SET actual_fulfillment_cost_minor=?,updated_at=? WHERE id=?`).bind(line.amountMinor,now(),orderItemId).run();await env.DB.prepare(`INSERT INTO provider_cost_snapshots (id,provider,order_id,order_item_id,cost_type,amount_minor,currency,source_reference,captured_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram',order.id,orderItemId,'invoice_fulfillment',line.amountMinor,line.currency,inv.invoiceId,now(),JSON.stringify({invoiceId:inv.invoiceId})).run();}}
    await env.DB.prepare(`UPDATE fulfillment_jobs SET invoice_reference=?,updated_at=? WHERE id IN (SELECT fj.id FROM fulfillment_jobs fj JOIN order_items oi ON oi.id=fj.order_item_id WHERE oi.order_id=? AND fj.provider='ingram')`).bind(inv.invoiceId,now(),order.id).run();await materializeSettlementAllocations(env,order.id);await audit(env,{actorType:'provider',actorId:'ingram',action:'ingram.invoice',objectType:'order',objectId:order.id,orderId:order.id,metadata:{invoiceId:inv.invoiceId,totalMinor:inv.totalMinor}});return json({ok:true,orderId:order.id,invoiceId:inv.invoiceId,lines:inv.lines.length});
  }

  if(path==='/api/providers/ingram/fulfillment/export'&&request.method==='POST'){
    if(!requireProviderSecret(request,env))return json({ok:false,error:'unauthorized_provider_export'},401);if(env.INGRAM_MODE==='off')return json({ok:false,error:'ingram_not_enabled'},503);
    const body=await safeJson(request),orderId=body?.orderId;if(!orderId)return json({ok:false,error:'order_id_required'},400);const order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(orderId).first();if(!order)return json({ok:false,error:'order_not_found'},404);if(!['paid','succeeded','partially_refunded'].includes(order.payment_status))return json({ok:false,error:'order_not_paid'},409);
    const items=await all(env.DB.prepare(`SELECT oi.id,oi.quantity,e.format,e.isbn,e.provider_sku providerSku FROM order_items oi JOIN editions e ON e.id=oi.edition_id WHERE oi.order_id=? AND oi.fulfillment_provider='ingram'`).bind(orderId)),shipTo=safeAddress(order.shipping_address_json);if(!shipTo)return json({ok:false,error:'shipping_address_missing'},409);
    try{const validation=validatePhysicalOrder({order,items,shipTo});if(!validation.ok)return json({ok:false,error:'ingram_order_not_ready',details:validation.errors},409);const document=buildPurchaseOrderDocument({order,items,shipTo,accountId:env.INGRAM_ACCOUNT_ID||null}),key=`ingram-po:${orderId}`;await env.DB.prepare(`INSERT OR IGNORE INTO provider_documents (id,provider,document_type,direction,order_id,external_document_id,idempotency_key,status,occurred_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram','purchase_order','outbound',orderId,null,key,'ready',now(),JSON.stringify(document)).run();await audit(env,{actorType:'system',actorId:'ingram-bridge',action:'ingram.po.prepared',objectType:'order',objectId:orderId,orderId,metadata:{lineCount:document.lines.length}});return json({ok:true,document,transport:env.INGRAM_MODE,note:'Normalized PO envelope is ready. Transport remains partner-contract specific.'})}catch(err){return json({ok:false,error:'ingram_export_failed',message:String(err.message||err)},400)}
  }
  if(path==='/api/providers/ingram/fulfillment/event'&&request.method==='POST'){
    if(env.INGRAM_FULFILLMENT_IMPORT_ENABLED!=='true')return json({ok:false,error:'ingram_fulfillment_import_disabled'},503);if(!requireProviderSecret(request,env))return json({ok:false,error:'unauthorized_provider_import'},401);
    const body=await safeJson(request),doc=normalizeIngramDocument(body||{});if(!doc.orderReference)return json({ok:false,error:'order_reference_required'},400);const order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(doc.orderReference).first();if(!order)return json({ok:false,error:'order_not_found'},404);
    const externalId=doc.providerDocumentId||`${doc.documentType}:${doc.orderReference}:${doc.occurredAt}`,inserted=await env.DB.prepare(`INSERT OR IGNORE INTO provider_documents (id,provider,document_type,direction,order_id,external_document_id,idempotency_key,status,occurred_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram',doc.documentType,'inbound',order.id,externalId,`ingram-in:${externalId}`,'received',doc.occurredAt,JSON.stringify(body||{})).run();if(Number(inserted?.meta?.changes||0)===0)return json({ok:true,replayed:true,orderId:order.id,documentType:doc.documentType,externalId});
    const jobs=await all(env.DB.prepare(`SELECT fj.*,oi.id order_item_id,e.isbn FROM fulfillment_jobs fj JOIN order_items oi ON oi.id=fj.order_item_id JOIN editions e ON e.id=oi.edition_id WHERE oi.order_id=? AND fj.provider='ingram'`).bind(order.id)),touched=[];
    for(const job of jobs){const line=doc.lines.find(x=>String(x.orderItemId||'')===String(job.order_item_id)||String(x.isbn||'')===String(job.isbn||'')),normalized=normalizeIngramDocument({status:line?.status||doc.rawStatus}).normalizedStatus;await env.DB.prepare(`UPDATE fulfillment_jobs SET provider_order_id=COALESCE(provider_order_id,?),status=?,raw_status=?,tracking_number=COALESCE(?,tracking_number),tracking_url=COALESCE(?,tracking_url),last_synced_at=?,updated_at=? WHERE id=?`).bind(doc.providerOrderId,normalized,line?.status||doc.rawStatus,line?.trackingNumber||doc.trackingNumber,line?.trackingUrl||doc.trackingUrl,now(),now(),job.id).run();await env.DB.prepare(`INSERT OR IGNORE INTO fulfillment_events (id,fulfillment_job_id,provider,event_type,normalized_status,raw_status,provider_event_id,occurred_at,received_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),job.id,'ingram',doc.documentType,normalized,line?.status||doc.rawStatus,`${externalId}:${job.id}`,doc.occurredAt,now(),JSON.stringify(line||body||{})).run();const tracking=line?.trackingNumber||doc.trackingNumber;if(tracking)await env.DB.prepare(`INSERT INTO shipment_packages (id,fulfillment_job_id,provider,provider_package_id,carrier,service_level,tracking_number,tracking_url,status,shipped_at,delivered_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),job.id,'ingram',line?.packageId||null,line?.carrier||null,line?.serviceLevel||null,tracking,line?.trackingUrl||doc.trackingUrl,normalized,['shipped','delivered'].includes(normalized)?doc.occurredAt:null,normalized==='delivered'?doc.occurredAt:null,now(),now()).run();if(line?.costMinor!=null){await env.DB.prepare(`UPDATE order_items SET actual_fulfillment_cost_minor=?,updated_at=? WHERE id=?`).bind(Number(line.costMinor),now(),job.order_item_id).run();await env.DB.prepare(`INSERT INTO provider_cost_snapshots (id,provider,order_id,order_item_id,cost_type,amount_minor,currency,source_reference,captured_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram',order.id,job.order_item_id,'fulfillment',Number(line.costMinor),order.currency||'usd',externalId,now(),JSON.stringify({documentType:doc.documentType})).run();}touched.push({jobId:job.id,status:normalized});}
    const fulfillmentStatus=await refreshOrderFulfillment(env,order.id);await materializeSettlementAllocations(env,order.id);if(doc.normalizedStatus==='failed')await openCommerceException(env,{orderId:order.id,provider:'ingram',code:'fulfillment_failed',title:'Ingram fulfillment exception',detail:doc.rawStatus,providerReference:externalId,metadata:{documentType:doc.documentType}});await audit(env,{actorType:'provider',actorId:'ingram',action:`ingram.${doc.documentType}`,objectType:'order',objectId:order.id,orderId:order.id,metadata:{externalId,fulfillmentStatus}});return json({ok:true,orderId:order.id,fulfillmentStatus,touched,documentType:doc.documentType});
  }

  if(path==='/api/providers/ingram/sales/import'&&request.method==='POST'){
    if(env.INGRAM_REPORT_IMPORT_ENABLED!=='true') return json({ok:false,error:'ingram_report_import_disabled'},503);
    if(!env.PROVIDER_IMPORT_SECRET||request.headers.get('x-yasready-provider-secret')!==env.PROVIDER_IMPORT_SECRET) return json({ok:false,error:'unauthorized_provider_import'},401);
    const body=await safeJson(request); const rows=Array.isArray(body?.rows)?body.rows:[]; if(!rows.length) return json({ok:false,error:'rows_required'},400);
    const runId=uuid(), started=now(); await env.DB.prepare(`INSERT INTO provider_sync_runs (id,provider,sync_type,status,started_at,rows_seen,rows_written) VALUES (?,?,?,?,?,?,?)`).bind(runId,'ingram','sales_report','running',started,rows.length,0).run();
    let written=0;
    try{
      for(const row of rows){
        if(!row.externalSaleId||!row.saleDate) continue;
        let edition=null;
        if(row.editionId) edition=await env.DB.prepare(`SELECT e.id,b.id book_id,b.author_id FROM editions e JOIN books b ON b.id=e.book_id WHERE e.id=?`).bind(row.editionId).first();
        if(!edition&&row.isbn) edition=await env.DB.prepare(`SELECT e.id,b.id book_id,b.author_id FROM editions e JOIN books b ON b.id=e.book_id WHERE e.isbn=? LIMIT 1`).bind(String(row.isbn)).first();
        const result=await env.DB.prepare(`INSERT OR IGNORE INTO external_channel_sales (id,provider,external_sale_id,author_id,book_id,edition_id,isbn,sale_date,quantity,gross_minor,net_minor,returns_minor,currency,channel_name,territory,source_provenance,imported_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram',String(row.externalSaleId),edition?.author_id||null,edition?.book_id||null,edition?.id||null,row.isbn?String(row.isbn):null,String(row.saleDate),Number(row.quantity||0),row.grossMinor==null?null:Number(row.grossMinor),row.netMinor==null?null:Number(row.netMinor),Number(row.returnsMinor||0),String(row.currency||'usd').toLowerCase(),row.channelName||null,row.territory||null,body.provenance||'normalized-ingram-report',now(),JSON.stringify(row.metadata||{})).run();
        written+=Number(result.meta?.changes||0);
      }
      await env.DB.prepare(`UPDATE provider_sync_runs SET status='completed',completed_at=?,rows_written=? WHERE id=?`).bind(now(),written,runId).run();
      return json({ok:true,runId,rowsSeen:rows.length,rowsWritten:written});
    }catch(err){await env.DB.prepare(`UPDATE provider_sync_runs SET status='failed',completed_at=?,rows_written=?,error_summary=? WHERE id=?`).bind(now(),written,String(err.message||err).slice(0,500),runId).run();return json({ok:false,error:'ingram_import_failed'},500)}
  }

  if(path==='/api/integrations/publishing/status'&&request.method==='GET') return json({ok:true,schema:PUBLISHING_HANDOFF_SCHEMA,enabled:env.PUBLISHING_IMPORT_ENABLED==='true',signatureRequired:true,behavior:'one_way_production_truth_author_launch_gate'});
  if(path==='/api/integrations/publishing/handoff'&&request.method==='POST'){
    if(env.PUBLISHING_IMPORT_ENABLED!=='true') return json({ok:false,error:'publishing_import_disabled'},503);
    if(!env.PUBLISHING_IMPORT_SECRET) return json({ok:false,error:'publishing_import_secret_missing'},503);
    const rawText=await request.text(),signature=request.headers.get('x-yasready-publishing-signature')||''; if(!await verifyPublishingSignature(rawText,signature,env.PUBLISHING_IMPORT_SECRET)) return json({ok:false,error:'invalid_publishing_signature'},401);
    let body;try{body=JSON.parse(rawText)}catch{return json({ok:false,error:'invalid_json'},400)}
    try{return json({ok:true,...await applyPublishingHandoff(env,body,rawText)},202)}catch(err){return json({ok:false,error:'publishing_handoff_failed',message:String(err.message||err)},400)}
  }

  if(path==='/api/providers/ingram/status') return json({ok:true,...ingramReadiness(env),capabilities:ingramCapabilities,note:'CDF/EDI, data feeds and other Ingram transports remain eligibility/contract-gated. Marketplace prepares and consumes normalized documents without assuming private Ingram endpoints.'});
  if(path==='/api/providers/stripe/status') return json({ok:true,mode:env.STRIPE_MODE||'off',checkoutEnabled:env.CHECKOUT_ENABLED==='true',capabilities:['checkout','connect_onboarding','signed_webhooks','separate_charges_transfers','refunds','disputes','payout_gates','reconciliation']});
  if(path==='/api/economics/calculate'&&request.method==='POST'){const b=await safeJson(request);return json({ok:true,...sellerPayable(b||{})});}
  return json({ok:false,error:'not_found'},404);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')) return api(request,env);
    if(url.pathname.startsWith('/r/')) return marketingShortRedirect(request,env);
    if(env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Marketplace | YasReady · v0.10.0',{headers:{'content-type':'text/plain;charset=utf-8'}});
  }
};
