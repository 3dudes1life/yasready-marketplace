import {normalizeReaderProgress} from './consumer.mjs';

export const BOOKS_APP_CONTRACT='yasready.books.marketplace.v1';
export const BOOKS_APP_SUPPORTED_FORMATS=['ebook','audiobook'];
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
async function all(stmt){const r=await stmt.all();return r.results||[];}

export function booksAppCapabilities(env={}){
  return {
    contract:BOOKS_APP_CONTRACT,
    bridgeEnabled:env.BOOKS_APP_BRIDGE_ENABLED==='true',
    deliveryEnabled:env.BOOKS_APP_DELIVERY_ENABLED==='true',
    pushEnabled:env.BOOKS_APP_PUSH_ENABLED==='true',
    supportedFormats:[...BOOKS_APP_SUPPORTED_FORMATS],
    library:true,
    saved:true,
    recent:true,
    authorFollows:true,
    progressSync:true,
    incrementalSync:true,
    optimisticProgress:true,
    offlineAssetManifest:true,
    commerce:'marketplace-web',
    minimumAppVersion:env.BOOKS_APP_MIN_VERSION||'0.1.0',
    deepLinkScheme:env.BOOKS_APP_SCHEME||'yasreadybooks'
  };
}

export function normalizeBooksDevice(input={}){
  const installationId=String(input.installationId||input.installation_id||'').trim();
  if(!installationId||installationId.length>180) throw new Error('installation_id_invalid');
  const raw=String(input.platform||'unknown').toLowerCase();
  const platform=['ios','android','web'].includes(raw)?raw:'unknown';
  const clean=v=>v==null?null:String(v).trim().slice(0,160)||null;
  return {installationId,platform,appVersion:clean(input.appVersion),osVersion:clean(input.osVersion),deviceModel:clean(input.deviceModel),locale:clean(input.locale),pushCapable:!!input.pushCapable};
}

export function booksDeepLinks({baseUrl='https://marketplace.yasready.com',scheme='yasreadybooks',bookSlug='',editionId=null,action='open'}={}){
  const slug=encodeURIComponent(String(bookSlug||''));
  const web=new URL(`/book/${slug}`,baseUrl).toString();
  const app=`${scheme}://book/${slug}${editionId?`?edition=${encodeURIComponent(editionId)}&action=${encodeURIComponent(action)}`:`?action=${encodeURIComponent(action)}`}`;
  return {web,app};
}

export function normalizeBooksProgressPatch(input={}){
  const progress=normalizeReaderProgress(input);
  const expectedRevision=input.expectedRevision==null?null:Number(input.expectedRevision);
  if(expectedRevision!=null&&(!Number.isInteger(expectedRevision)||expectedRevision<0)) throw new Error('expected_revision_invalid');
  return {...progress,expectedRevision,deviceId:input.deviceId?String(input.deviceId):null,clientUpdatedAt:input.clientUpdatedAt?String(input.clientUpdatedAt):null};
}

export function stripeDigitalEntitlementDecision({format,paymentStatus='paid',grossMinor=0,refundedMinor=0}={}){
  const digital=BOOKS_APP_SUPPORTED_FORMATS.includes(String(format||'').toLowerCase());
  if(!digital) return 'none';
  if(!['paid','succeeded','partially_refunded'].includes(String(paymentStatus))) return 'none';
  return Number(grossMinor)>0&&Number(refundedMinor)>=Number(grossMinor)?'revoke':'grant';
}

export async function recordBooksAppChange(env,{customerId,kind,objectType,objectId,payload={}}){
  if(!env?.DB||!customerId) return null;
  const id=uuid();
  await env.DB.prepare(`INSERT INTO books_app_changes (change_id,customer_id,change_kind,object_type,object_id,occurred_at,payload_json) VALUES (?,?,?,?,?,?,?)`).bind(id,customerId,kind,objectType,objectId,now(),JSON.stringify(payload||{})).run();
  return id;
}

export async function syncDigitalEntitlementsForOrder(env,orderId){
  const order=await env.DB.prepare(`SELECT id,customer_id,payment_status FROM orders WHERE id=?`).bind(orderId).first();
  if(!order?.customer_id||!['paid','succeeded','partially_refunded'].includes(order.payment_status)) return {granted:0,customerId:order?.customer_id||null};
  const items=await all(env.DB.prepare(`SELECT oi.id order_item_id,oi.gross_minor,oi.refunded_minor,e.id edition_id,e.format FROM order_items oi JOIN editions e ON e.id=oi.edition_id WHERE oi.order_id=? AND e.format IN ('ebook','audiobook')`).bind(orderId));
  let granted=0;
  for(const item of items){
    if(stripeDigitalEntitlementDecision({format:item.format,paymentStatus:order.payment_status,grossMinor:item.gross_minor,refundedMinor:item.refunded_minor})!=='grant') continue;
    const existing=await env.DB.prepare(`SELECT id,status FROM customer_entitlements WHERE customer_id=? AND edition_id=? AND status='active' ORDER BY granted_at DESC LIMIT 1`).bind(order.customer_id,item.edition_id).first();
    if(existing) continue;
    const id=uuid(),stamp=now();
    await env.DB.prepare(`INSERT INTO customer_entitlements (id,customer_id,edition_id,order_item_id,entitlement_type,status,granted_at,source,updated_at,metadata_json) VALUES (?,?,?,?,?,'active',?,?,?,?)`).bind(id,order.customer_id,item.edition_id,item.order_item_id,item.format,stamp,'stripe_checkout',stamp,JSON.stringify({orderId})).run();
    await recordBooksAppChange(env,{customerId:order.customer_id,kind:'entitlement.granted',objectType:'edition',objectId:item.edition_id,payload:{orderId,format:item.format}});
    granted++;
  }
  return {granted,customerId:order.customer_id};
}

export async function reconcileDigitalEntitlementsForOrder(env,orderId){
  const order=await env.DB.prepare(`SELECT id,customer_id,payment_status FROM orders WHERE id=?`).bind(orderId).first();
  if(!order?.customer_id) return {revoked:0};
  const items=await all(env.DB.prepare(`SELECT oi.id order_item_id,oi.gross_minor,oi.refunded_minor,e.id edition_id,e.format FROM order_items oi JOIN editions e ON e.id=oi.edition_id WHERE oi.order_id=? AND e.format IN ('ebook','audiobook')`).bind(orderId));
  let revoked=0;
  for(const item of items){
    if(stripeDigitalEntitlementDecision({format:item.format,paymentStatus:order.payment_status,grossMinor:item.gross_minor,refundedMinor:item.refunded_minor})!=='revoke') continue;
    const stamp=now();
    const out=await env.DB.prepare(`UPDATE customer_entitlements SET status='revoked',revoked_at=COALESCE(revoked_at,?),updated_at=?,revocation_reason='fully_refunded' WHERE customer_id=? AND order_item_id=? AND status='active'`).bind(stamp,stamp,order.customer_id,item.order_item_id).run();
    if(out.meta?.changes){revoked+=Number(out.meta.changes);await recordBooksAppChange(env,{customerId:order.customer_id,kind:'entitlement.revoked',objectType:'edition',objectId:item.edition_id,payload:{orderId,reason:'fully_refunded'}});}
  }
  return {revoked,customerId:order.customer_id};
}

export async function booksAppContentManifest(env,{customerId,editionId}){
  const row=await env.DB.prepare(`SELECT ce.status entitlement_status,e.id edition_id,e.format,b.id book_id,b.slug,b.title,b.cover_url,da.id asset_id,da.asset_kind,da.version asset_version,da.status asset_status,da.checksum_sha256,da.content_type,da.byte_length,da.duration_seconds,da.metadata_json FROM customer_entitlements ce JOIN editions e ON e.id=ce.edition_id JOIN books b ON b.id=e.book_id LEFT JOIN digital_assets da ON da.edition_id=e.id AND da.status='ready' WHERE ce.customer_id=? AND ce.edition_id=? AND ce.status='active' ORDER BY da.version DESC LIMIT 1`).bind(customerId,editionId).first();
  if(!row) return null;
  const links=booksDeepLinks({baseUrl:env.PUBLIC_APP_URL||'https://marketplace.yasready.com',scheme:env.BOOKS_APP_SCHEME||'yasreadybooks',bookSlug:row.slug,editionId:row.edition_id,action:row.format==='audiobook'?'listen':'read'});
  let metadata=null;try{metadata=row.metadata_json?JSON.parse(row.metadata_json):null}catch{}
  return {contract:BOOKS_APP_CONTRACT,book:{id:row.book_id,slug:row.slug,title:row.title,coverUrl:row.cover_url||null},edition:{id:row.edition_id,format:row.format},entitlement:{status:row.entitlement_status},content:row.asset_id?{status:row.asset_status,assetId:row.asset_id,kind:row.asset_kind,version:Number(row.asset_version||1),checksumSha256:row.checksum_sha256||null,contentType:row.content_type||null,byteLength:row.byte_length==null?null:Number(row.byte_length),durationSeconds:row.duration_seconds==null?null:Number(row.duration_seconds),metadata}:{status:'not_configured',assetId:null},delivery:{enabled:env.BOOKS_APP_DELIVERY_ENABLED==='true',mode:env.BOOKS_APP_DELIVERY_ENABLED==='true'?'provider_signed_url_required':'disabled'},deepLinks:links};
}
