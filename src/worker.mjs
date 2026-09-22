import {sellerPayable} from './lib/money.mjs';
import {stripeAllocationPlan} from './lib/providers.mjs';
import {getIdentity,publicIdentity} from './lib/auth.mjs';
import {buildBusinessExport} from './lib/business.mjs';
import {buildCampaignUrl,buildEmbedHtml,socialCopy} from './lib/marketing.mjs';
import {ingramCapabilities,buildPurchaseOrderDocument,normalizeIngramDocument} from './lib/ingram.mjs';
import {createExpressAccount,createAccountLink,retrieveAccount,createCheckoutSession,verifyStripeSignature,createRefund,createTransfer} from './lib/stripe-server.mjs';
import {allocateRefund,sellerBalance,refundStatus,commerceReadiness,prorateMinor} from './lib/commerce.mjs';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',...headers}});
const safeJson=async request=>{try{return await request.json()}catch{return null}};
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const clampQty=n=>Math.max(1,Math.min(25,Number(n)||1));

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
      id:r.book_id,slug:r.slug,title:r.title,subtitle:r.subtitle,description:r.description,longDescription:r.long_description,coverUrl:r.cover_url,category:r.primary_category,
      author:{id:r.author_id,name:r.author_name,handle:r.author_handle,avatarUrl:r.author_avatar_url},listing:{id:r.listing_id,status:r.listing_status,visibility:r.visibility,publishedAt:r.published_at},editions:[]
    });
    if(r.edition_id) books.get(r.book_id).editions.push({id:r.edition_id,format:r.format,isbn:r.isbn,currency:r.currency,priceMinor:r.price_minor,status:r.edition_status,fulfillmentProvider:r.fulfillment_provider,inventoryStatus:r.inventory_status,providerPurchaseUrl:r.provider_purchase_url,providerCostMinor:r.provider_cost_minor});
  }
  return [...books.values()];
}

async function getCatalog(env,slug=null){
  const where=slug?`AND b.slug=?`:'';
  const sql=`SELECT b.id book_id,b.slug,b.title,b.subtitle,b.description,b.long_description,b.cover_url,b.primary_category,
    a.id author_id,a.display_name author_name,a.handle author_handle,a.avatar_url author_avatar_url,
    l.id listing_id,l.status listing_status,l.visibility,l.published_at,
    e.id edition_id,e.format,e.isbn,e.currency,e.price_minor,e.status edition_status,e.fulfillment_provider,e.inventory_status,e.provider_purchase_url,e.provider_cost_minor
    FROM listings l JOIN books b ON b.id=l.book_id JOIN authors a ON a.id=b.author_id
    LEFT JOIN editions e ON e.book_id=b.id
    WHERE l.status='live' AND l.visibility='public' ${where}
    ORDER BY COALESCE(l.featured_rank,9999),l.published_at DESC,b.title,e.price_minor`;
  const rows=slug?await all(env.DB.prepare(sql).bind(slug)):await all(env.DB.prepare(sql));
  return catalogFromRows(rows);
}

async function getAuthorBooks(env,authorId){
  const rows=await all(env.DB.prepare(`SELECT b.id book_id,b.slug,b.title,b.subtitle,b.description,b.cover_url,b.primary_category,b.status book_status,b.publishing_source_id,
    l.id listing_id,l.status listing_status,l.visibility,l.published_at,
    e.id edition_id,e.format,e.isbn,e.currency,e.price_minor,e.status edition_status,e.fulfillment_provider,e.inventory_status,e.provider_purchase_url,e.provider_cost_minor
    FROM books b LEFT JOIN listings l ON l.book_id=b.id LEFT JOIN editions e ON e.book_id=b.id WHERE b.author_id=? ORDER BY b.updated_at DESC,e.format`).bind(authorId));
  const grouped=new Map();
  for(const r of rows){
    if(!grouped.has(r.book_id)) grouped.set(r.book_id,{id:r.book_id,slug:r.slug,title:r.title,subtitle:r.subtitle,description:r.description,coverUrl:r.cover_url,category:r.primary_category,status:r.book_status,publishingSourceId:r.publishing_source_id,listing:r.listing_id?{id:r.listing_id,status:r.listing_status,visibility:r.visibility,publishedAt:r.published_at}:null,editions:[]});
    if(r.edition_id) grouped.get(r.book_id).editions.push({id:r.edition_id,format:r.format,isbn:r.isbn,currency:r.currency,priceMinor:r.price_minor,status:r.edition_status,fulfillmentProvider:r.fulfillment_provider,inventoryStatus:r.inventory_status,providerPurchaseUrl:r.provider_purchase_url,providerCostMinor:r.provider_cost_minor});
  }
  return [...grouped.values()];
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
  const views=Number(viewsRow?.views||0),orders=Number(totals?.orders||0);
  return {period:{days:Number(days)||30,start,end:now()},totals:{orders,units:Number(totals?.units||0),grossSalesMinor:Number(totals?.gross_sales_minor||0),marketplaceFeesMinor:Number(totals?.marketplace_fees_minor||0),processorFeesMinor:Number(totals?.processor_fees_minor||0),fulfillmentCostMinor:Number(totals?.fulfillment_cost_minor||0),refundsMinor:Number(totals?.refunds_minor||0),disputedMinor:Number(totals?.disputed_minor||0),transferredMinor:Number(totals?.transferred_minor||0),sellerPayableMinor:Number(totals?.seller_payable_minor||0),views,conversionRate:views?Number(((orders/views)*100).toFixed(2)):0,currency:'usd'},formats:formats.map(x=>({format:x.format,units:Number(x.units),grossMinor:Number(x.gross_minor)})),campaigns:campaigns.map(x=>({campaign:x.campaign,source:x.source,orders:Number(x.orders),grossMinor:Number(x.gross_minor)})),externalChannels:externalChannels.map(x=>({provider:x.provider,channel:x.channel,units:Number(x.units),grossMinor:Number(x.gross_minor),netMinor:Number(x.net_minor),returnsMinor:Number(x.returns_minor)})),recentOrders};
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

async function api(request,env){
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/health') return json({ok:true,version:'0.3.0',commerce:commerceReadiness(env),mode:env.MARKETPLACE_MODE||'demo',authMode:env.YASREADY_AUTH_MODE||'demo',checkoutEnabled:env.CHECKOUT_ENABLED==='true',stripeMode:env.STRIPE_MODE||'off',ingramMode:env.INGRAM_MODE||'off',database:!!env.DB});
  if(!env.DB && path!=='/api/providers/ingram/status' && path!=='/api/providers/stripe/status') return noDb();

  if(path==='/api/catalog'&&request.method==='GET') return json({ok:true,books:await getCatalog(env)});
  if(path.startsWith('/api/catalog/')&&request.method==='GET'){
    const slug=decodeURIComponent(path.slice('/api/catalog/'.length)); const books=await getCatalog(env,slug); return books[0]?json({ok:true,book:books[0]}):json({ok:false,error:'book_not_found'},404);
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
    return json({ok:true,identity:publicIdentity(auth.identity),author:{id:author.id,displayName:author.display_name,email:author.email,handle:author.handle,avatarUrl:author.avatar_url,stripeOnboardingStatus:author.stripe_onboarding_status,marketplaceStatus:author.marketplace_status},sharedAccount:true});
  }

  if(path.startsWith('/api/me/')){
    const auth=await requireIdentity(request,env); if(auth.response) return auth.response; const author=await ensureAuthor(env,auth.identity);

    if(path==='/api/me/overview'&&request.method==='GET'){
      const [books,stats]=await Promise.all([getAuthorBooks(env,author.id),authorStats(env,author.id,30)]);
      return json({ok:true,author,books,stats,sharedIdentity:publicIdentity(auth.identity)});
    }
    if(path==='/api/me/books'&&request.method==='GET') return json({ok:true,books:await getAuthorBooks(env,author.id)});
    if(path==='/api/me/stats'&&request.method==='GET') return json({ok:true,...await authorStats(env,author.id,url.searchParams.get('days')||30)});

    if(path==='/api/me/campaigns'&&request.method==='GET'){
      const rows=await all(env.DB.prepare(`SELECT c.*,b.title,b.slug FROM campaigns c LEFT JOIN books b ON b.id=c.book_id WHERE c.author_id=? ORDER BY c.created_at DESC`).bind(author.id));
      return json({ok:true,campaigns:rows});
    }
    if(path==='/api/me/campaigns'&&request.method==='POST'){
      const body=await safeJson(request); if(!body?.bookId||!body?.name||!body?.source) return json({ok:false,error:'book_name_source_required'},400);
      const book=await env.DB.prepare(`SELECT id,slug,title FROM books WHERE id=? AND author_id=?`).bind(body.bookId,author.id).first(); if(!book) return json({ok:false,error:'book_not_owned'},403);
      const id=uuid(); const medium=body.medium||'referral'; const destinationPath=`/book/${book.slug}`;
      await env.DB.prepare(`INSERT INTO campaigns (id,author_id,book_id,name,source,medium,content,destination_path,active,created_at) VALUES (?,?,?,?,?,?,?,?,1,?)`).bind(id,author.id,book.id,String(body.name).slice(0,120),String(body.source).slice(0,80),String(medium).slice(0,80),body.content?String(body.content).slice(0,120):null,destinationPath,now()).run();
      const shareUrl=buildCampaignUrl({origin:env.PUBLIC_APP_URL||url.origin,bookSlug:book.slug,campaign:body.name,source:body.source,medium,campaignId:id});
      await env.DB.prepare(`INSERT INTO marketing_assets (id,author_id,book_id,campaign_id,asset_type,label,config_json,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(uuid(),author.id,book.id,id,'campaign_link',body.name,JSON.stringify({shareUrl}),now()).run();
      return json({ok:true,campaign:{id,bookId:book.id,name:body.name,source:body.source,medium,shareUrl}},201);
    }
    if(path.startsWith('/api/me/marketing-kit/')&&request.method==='GET'){
      const bookId=decodeURIComponent(path.slice('/api/me/marketing-kit/'.length));
      const book=await env.DB.prepare(`SELECT b.*,a.display_name author_name FROM books b JOIN authors a ON a.id=b.author_id WHERE b.id=? AND b.author_id=?`).bind(bookId,author.id).first(); if(!book) return json({ok:false,error:'book_not_owned'},404);
      const canonical=`${env.PUBLIC_APP_URL||url.origin}/book/${encodeURIComponent(book.slug)}`;
      const embed=buildEmbedHtml({url:canonical,title:book.title,author:book.author_name,coverUrl:book.cover_url||'',priceLabel:'See formats'});
      return json({ok:true,book:{id:book.id,title:book.title,slug:book.slug},canonicalUrl:canonical,embedHtml:embed,socialCopy:socialCopy({title:book.title,author:book.author_name,url:canonical}),assetTypes:['canonical_link','campaign_link','qr_code','html_book_card','buy_button','social_copy','email_copy']});
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
      const exportData=buildBusinessExport({author,period:stats.period,totals:stats.totals,formats:stats.formats,campaigns:stats.campaigns,channels:stats.externalChannels});
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
    if(path==='/api/me/fulfillment'&&request.method==='GET'){
      const rows=await all(env.DB.prepare(`SELECT fj.*,o.id order_id,b.title,e.format,e.isbn FROM fulfillment_jobs fj JOIN order_items oi ON oi.id=fj.order_item_id JOIN orders o ON o.id=oi.order_id JOIN editions e ON e.id=oi.edition_id JOIN books b ON b.id=e.book_id WHERE oi.author_id=? ORDER BY fj.created_at DESC LIMIT 100`).bind(author.id));
      return json({ok:true,jobs:rows});
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

  if(path==='/api/providers/ingram/fulfillment/export'&&request.method==='POST'){
    if(!requireProviderSecret(request,env))return json({ok:false,error:'unauthorized_provider_export'},401);if(env.INGRAM_MODE==='off')return json({ok:false,error:'ingram_not_enabled'},503);
    const body=await safeJson(request),orderId=body?.orderId;if(!orderId)return json({ok:false,error:'order_id_required'},400);const order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(orderId).first();if(!order)return json({ok:false,error:'order_not_found'},404);if(!['paid','succeeded','partially_refunded'].includes(order.payment_status))return json({ok:false,error:'order_not_paid'},409);
    const items=await all(env.DB.prepare(`SELECT oi.id,oi.quantity,e.format,e.isbn,e.provider_sku providerSku FROM order_items oi JOIN editions e ON e.id=oi.edition_id WHERE oi.order_id=? AND oi.fulfillment_provider='ingram'`).bind(orderId)),shipTo=safeAddress(order.shipping_address_json);if(!shipTo)return json({ok:false,error:'shipping_address_missing'},409);
    try{const document=buildPurchaseOrderDocument({order,items,shipTo,accountId:env.INGRAM_ACCOUNT_ID||null}),key=`ingram-po:${orderId}`;await env.DB.prepare(`INSERT OR IGNORE INTO provider_documents (id,provider,document_type,direction,order_id,external_document_id,idempotency_key,status,occurred_at,payload_json) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'ingram','purchase_order','outbound',orderId,null,key,'ready',now(),JSON.stringify(document)).run();await audit(env,{actorType:'system',actorId:'ingram-bridge',action:'ingram.po.prepared',objectType:'order',objectId:orderId,orderId,metadata:{lineCount:document.lines.length}});return json({ok:true,document,transport:env.INGRAM_MODE,note:'Normalized PO envelope is ready. Transport remains partner-contract specific.'})}catch(err){return json({ok:false,error:'ingram_export_failed',message:String(err.message||err)},400)}
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

  if(path==='/api/providers/ingram/status') return json({ok:true,mode:env.INGRAM_MODE||'off',connected:(env.INGRAM_MODE||'off')!=='off',reportImportEnabled:env.INGRAM_REPORT_IMPORT_ENABLED==='true',fulfillmentImportEnabled:env.INGRAM_FULFILLMENT_IMPORT_ENABLED==='true',capabilities:ingramCapabilities,note:'CDF/EDI and IPS Express Checkout are modeled as eligibility/contract-gated provider paths; no private Ingram access is assumed.'});
  if(path==='/api/providers/stripe/status') return json({ok:true,mode:env.STRIPE_MODE||'off',checkoutEnabled:env.CHECKOUT_ENABLED==='true',capabilities:['checkout','connect_onboarding','signed_webhooks','separate_charges_transfers','refunds','disputes','payout_gates','reconciliation']});
  if(path==='/api/economics/calculate'&&request.method==='POST'){const b=await safeJson(request);return json({ok:true,...sellerPayable(b||{})});}
  return json({ok:false,error:'not_found'},404);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')) return api(request,env);
    if(env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Marketplace | YasReady · v0.3.0',{headers:{'content-type':'text/plain;charset=utf-8'}});
  }
};
