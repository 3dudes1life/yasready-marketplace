import {sellerPayable} from './lib/money.mjs';
import {stripeAllocationPlan} from './lib/providers.mjs';
import {getIdentity,publicIdentity} from './lib/auth.mjs';
import {buildBusinessExport} from './lib/business.mjs';
import {buildCampaignUrl,buildEmbedHtml,socialCopy} from './lib/marketing.mjs';
import {ingramCapabilities} from './lib/ingram.mjs';
import {createExpressAccount,createAccountLink,retrieveAccount,createCheckoutSession,verifyStripeSignature} from './lib/stripe-server.mjs';

const json=(data,status=200,headers={})=>new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',...headers}});
const safeJson=async request=>{try{return await request.json()}catch{return null}};
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const clampQty=n=>Math.max(1,Math.min(25,Number(n)||1));

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
  const totals=await env.DB.prepare(`SELECT COUNT(DISTINCT o.id) orders,COALESCE(SUM(oi.quantity),0) units,COALESCE(SUM(oi.gross_minor),0) gross_sales_minor,COALESCE(SUM(oi.marketplace_fee_minor),0) marketplace_fees_minor,COALESCE(SUM(oi.stripe_fee_minor),0) processor_fees_minor,COALESCE(SUM(oi.estimated_fulfillment_cost_minor),0) fulfillment_cost_minor,COALESCE(SUM(oi.seller_payable_minor),0) seller_payable_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.author_id=? AND o.created_at>=? AND o.payment_status IN ('paid','succeeded','authorized')`).bind(authorId,start).first();
  const formats=await all(env.DB.prepare(`SELECT e.format,COALESCE(SUM(oi.quantity),0) units,COALESCE(SUM(oi.gross_minor),0) gross_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN editions e ON e.id=oi.edition_id WHERE oi.author_id=? AND o.created_at>=? AND o.payment_status IN ('paid','succeeded','authorized') GROUP BY e.format ORDER BY gross_minor DESC`).bind(authorId,start));
  const viewsRow=await env.DB.prepare(`SELECT COUNT(*) views FROM marketplace_events me JOIN books b ON b.id=me.book_id WHERE b.author_id=? AND me.occurred_at>=? AND me.event_type IN ('book_viewed','campaign_landing')`).bind(authorId,start).first();
  const campaigns=await all(env.DB.prepare(`SELECT COALESCE(c.name,'Direct / unknown') campaign,COALESCE(c.source,'direct') source,COUNT(DISTINCT o.id) orders,COALESCE(SUM(oi.gross_minor),0) gross_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id LEFT JOIN campaigns c ON c.id=o.campaign_id WHERE oi.author_id=? AND o.created_at>=? AND o.payment_status IN ('paid','succeeded','authorized') GROUP BY c.id,c.name,c.source ORDER BY gross_minor DESC LIMIT 12`).bind(authorId,start));
  const recentOrders=await all(env.DB.prepare(`SELECT o.id,o.created_at,o.payment_status,o.fulfillment_status,b.title,e.format,oi.quantity,oi.gross_minor,oi.seller_payable_minor FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN editions e ON e.id=oi.edition_id JOIN books b ON b.id=e.book_id WHERE oi.author_id=? ORDER BY o.created_at DESC LIMIT 12`).bind(authorId));
  const externalChannels=await all(env.DB.prepare(`SELECT provider,COALESCE(channel_name,provider) channel,COALESCE(SUM(quantity),0) units,COALESCE(SUM(gross_minor),0) gross_minor,COALESCE(SUM(net_minor),0) net_minor,COALESCE(SUM(returns_minor),0) returns_minor FROM external_channel_sales WHERE author_id=? AND sale_date>=? GROUP BY provider,channel_name ORDER BY gross_minor DESC`).bind(authorId,start));
  const views=Number(viewsRow?.views||0), orders=Number(totals?.orders||0);
  return {period:{days,start,end:now()},totals:{orders,units:Number(totals?.units||0),grossSalesMinor:Number(totals?.gross_sales_minor||0),marketplaceFeesMinor:Number(totals?.marketplace_fees_minor||0),processorFeesMinor:Number(totals?.processor_fees_minor||0),fulfillmentCostMinor:Number(totals?.fulfillment_cost_minor||0),sellerPayableMinor:Number(totals?.seller_payable_minor||0),views,conversionRate:views?Number(((orders/views)*100).toFixed(2)):0,currency:'usd'},formats:formats.map(x=>({format:x.format,units:Number(x.units),grossMinor:Number(x.gross_minor)})),campaigns:campaigns.map(x=>({campaign:x.campaign,source:x.source,orders:Number(x.orders),grossMinor:Number(x.gross_minor)})),externalChannels:externalChannels.map(x=>({provider:x.provider,channel:x.channel,units:Number(x.units),grossMinor:Number(x.gross_minor),netMinor:Number(x.net_minor),returnsMinor:Number(x.returns_minor)})),recentOrders};
}

async function validateCart(env,rawItems){
  const requested=(rawItems||[]).map(x=>({editionId:String(x.editionId||''),quantity:clampQty(x.quantity)})).filter(x=>x.editionId);
  if(!requested.length) throw new Error('items_required');
  const ids=[...new Set(requested.map(x=>x.editionId))];
  const placeholders=ids.map(()=>'?').join(',');
  const rows=await all(env.DB.prepare(`SELECT e.id edition_id,e.format,e.currency,e.price_minor,e.status,e.fulfillment_provider,e.inventory_status,e.isbn,e.provider_sku,b.id book_id,b.title,b.author_id,a.display_name author_name,l.status listing_status FROM editions e JOIN books b ON b.id=e.book_id JOIN authors a ON a.id=b.author_id JOIN listings l ON l.book_id=b.id WHERE e.id IN (${placeholders})`).bind(...ids));
  const byId=new Map(rows.map(x=>[x.edition_id,x]));
  return requested.map(req=>{
    const row=byId.get(req.editionId); if(!row) throw new Error(`unknown_edition:${req.editionId}`);
    if(row.status!=='live'||row.listing_status!=='live') throw new Error(`edition_not_live:${req.editionId}`);
    if(row.inventory_status && ['unavailable','out_of_stock','blocked'].includes(row.inventory_status)) throw new Error(`edition_unavailable:${req.editionId}`);
    return {editionId:row.edition_id,bookId:row.book_id,title:row.title,authorId:row.author_id,authorName:row.author_name,format:row.format,currency:row.currency,priceMinor:Number(row.price_minor),quantity:req.quantity,fulfillmentProvider:row.fulfillment_provider,isbn:row.isbn,providerSku:row.provider_sku};
  });
}

async function createPendingOrder(env,items,campaignId=null){
  const id=`YR-${Date.now().toString(36).toUpperCase()}-${uuid().slice(0,4).toUpperCase()}`;
  const subtotal=items.reduce((s,x)=>s+x.priceMinor*x.quantity,0);
  const statements=[env.DB.prepare(`INSERT INTO orders (id,currency,subtotal_minor,total_minor,payment_status,fulfillment_status,campaign_id,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(id,'usd',subtotal,subtotal,'pending','not_started',campaignId||null,now())];
  const feeBps=Number(env.MARKETPLACE_FEE_BPS||500);
  for(const item of items){
    const gross=item.priceMinor*item.quantity;
    const econ=sellerPayable({grossMinor:gross,fulfillmentMinor:0,stripeFeeMinor:0,feeBps});
    statements.push(env.DB.prepare(`INSERT INTO order_items (id,order_id,edition_id,author_id,quantity,unit_price_minor,gross_minor,marketplace_fee_minor,seller_payable_minor,fulfillment_provider,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),id,item.editionId,item.authorId,item.quantity,item.priceMinor,gross,econ.marketplaceFeeMinor,econ.sellerPayableMinor,item.fulfillmentProvider,now()));
  }
  await env.DB.batch(statements);
  return {id,subtotalMinor:subtotal,currency:'usd'};
}

async function api(request,env){
  const url=new URL(request.url), path=url.pathname;
  if(path==='/api/health') return json({ok:true,version:'0.2.0',mode:env.MARKETPLACE_MODE||'demo',authMode:env.YASREADY_AUTH_MODE||'demo',checkoutEnabled:env.CHECKOUT_ENABLED==='true',stripeMode:env.STRIPE_MODE||'off',ingramMode:env.INGRAM_MODE||'off',database:!!env.DB});
  if(!env.DB && path!=='/api/providers/ingram/status' && path!=='/api/providers/stripe/status') return noDb();

  if(path==='/api/catalog'&&request.method==='GET') return json({ok:true,books:await getCatalog(env)});
  if(path.startsWith('/api/catalog/')&&request.method==='GET'){
    const slug=decodeURIComponent(path.slice('/api/catalog/'.length)); const books=await getCatalog(env,slug); return books[0]?json({ok:true,book:books[0]}):json({ok:false,error:'book_not_found'},404);
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
    if(path==='/api/me/business-export'&&request.method==='GET'){
      const stats=await authorStats(env,author.id,url.searchParams.get('days')||30);
      const exportData=buildBusinessExport({author,period:stats.period,totals:{...stats.totals,refundsMinor:0},formats:stats.formats,campaigns:stats.campaigns,channels:stats.externalChannels});
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
      const session=await createCheckoutSession(env,{orderId:order.id,items,successUrl:`${base}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,cancelUrl:`${base}/?checkout=cancel`});
      await env.DB.prepare(`UPDATE orders SET stripe_checkout_session_id=? WHERE id=?`).bind(session.id,order.id).run();
      await writeEvent(env,{type:'checkout_session_created',orderId:order.id,campaignId:body?.campaignId||null,properties:{stripeSessionId:session.id,itemCount:items.length,totalMinor:order.subtotalMinor}});
      return json({ok:true,orderId:order.id,checkoutUrl:session.url,sessionId:session.id});
    } catch(err){return json({ok:false,error:'checkout_failed',message:String(err.message||err)},400)}
  }

  if(path==='/api/webhooks/stripe'&&request.method==='POST'){
    const raw=await request.text(); const sig=request.headers.get('stripe-signature')||'';
    if(!await verifyStripeSignature(raw,sig,env.STRIPE_WEBHOOK_SECRET||'')) return json({ok:false,error:'invalid_signature'},400);
    const event=JSON.parse(raw);
    const inserted=await env.DB.prepare(`INSERT OR IGNORE INTO provider_webhook_events (id,provider,external_event_id,event_type,livemode,processing_status,received_at) VALUES (?,?,?,?,?,?,?)`).bind(uuid(),'stripe',event.id,event.type,event.livemode?1:0,'received',now()).run();
    if(!inserted.meta?.changes) return json({ok:true,replayed:true});
    try{
      const obj=event.data?.object||{}; const orderId=obj.metadata?.yasready_order_id||obj.client_reference_id||null;
      if(orderId && ['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
        const status=obj.payment_status==='paid'||event.type==='checkout.session.async_payment_succeeded'?'paid':'authorized';
        await env.DB.prepare(`UPDATE orders SET payment_status=?,paid_at=COALESCE(paid_at,?),stripe_payment_intent_id=COALESCE(stripe_payment_intent_id,?) WHERE id=?`).bind(status,now(),typeof obj.payment_intent==='string'?obj.payment_intent:null,orderId).run();
        await writeEvent(env,{type:'payment_succeeded',orderId,properties:{provider:'stripe',externalEventId:event.id}});
      }
      if(orderId && event.type==='checkout.session.async_payment_failed') await env.DB.prepare(`UPDATE orders SET payment_status='failed' WHERE id=?`).bind(orderId).run();
      await env.DB.prepare(`UPDATE provider_webhook_events SET processing_status='processed',processed_at=? WHERE provider='stripe' AND external_event_id=?`).bind(now(),event.id).run();
      return json({ok:true});
    } catch(err){
      await env.DB.prepare(`UPDATE provider_webhook_events SET processing_status='failed',processed_at=?,error_summary=? WHERE provider='stripe' AND external_event_id=?`).bind(now(),String(err.message||err).slice(0,500),event.id).run();
      return json({ok:false,error:'webhook_processing_failed'},500);
    }
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

  if(path==='/api/providers/ingram/status') return json({ok:true,mode:env.INGRAM_MODE||'off',connected:(env.INGRAM_MODE||'off')!=='off',reportImportEnabled:env.INGRAM_REPORT_IMPORT_ENABLED==='true',capabilities:ingramCapabilities,note:'Public Ingram capabilities are modeled; live CDF/EDI access still requires Ingram approval and credentials.'});
  if(path==='/api/providers/stripe/status') return json({ok:true,mode:env.STRIPE_MODE||'off',checkoutEnabled:env.CHECKOUT_ENABLED==='true',capabilities:['checkout','connect_onboarding','webhooks','multi_seller_allocation','refund_reconciliation','payout_reconciliation']});
  if(path==='/api/economics/calculate'&&request.method==='POST'){const b=await safeJson(request);return json({ok:true,...sellerPayable(b||{})});}
  return json({ok:false,error:'not_found'},404);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/')) return api(request,env);
    if(env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Marketplace | YasReady · v0.2.0',{headers:{'content-type':'text/plain;charset=utf-8'}});
  }
};
