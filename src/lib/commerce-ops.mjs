import {deriveOrderFulfillmentStatus} from './commerce.mjs';
import {exceptionSeverity,reconcileAllocation,summarizeCommerceHealth} from './reconciliation.mjs';
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
async function all(stmt){const out=await stmt.all();return out.results||[];}

export async function audit(env,{actorType='system',actorId=null,action,objectType=null,objectId=null,orderId=null,metadata={}}){
  if(!env.DB) return;
  await env.DB.prepare(`INSERT INTO audit_log (id,actor_type,actor_id,action,object_type,object_id,order_id,occurred_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)`).bind(uuid(),actorType,actorId,action,objectType,objectId,orderId,now(),JSON.stringify(metadata||{})).run();
}

export async function recordOrderStatus(env,{orderId,statusType,fromStatus=null,toStatus,source='marketplace',sourceReference=null,metadata={}}){
  await env.DB.prepare(`INSERT INTO order_status_history (id,order_id,status_type,from_status,to_status,source,source_reference,occurred_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?)`).bind(uuid(),orderId,statusType,fromStatus,toStatus,source,sourceReference,now(),JSON.stringify(metadata||{})).run();
}

export async function openCommerceException(env,{orderId=null,orderItemId=null,authorId=null,provider=null,code,title=null,detail=null,providerReference=null,metadata={}}){
  const existing=orderId?await env.DB.prepare(`SELECT id FROM commerce_exceptions WHERE order_id=? AND code=? AND status IN ('open','acknowledged') LIMIT 1`).bind(orderId,code).first():null;
  if(existing) return existing.id;
  const id=uuid();
  await env.DB.prepare(`INSERT INTO commerce_exceptions (id,order_id,order_item_id,author_id,provider,code,severity,status,title,detail,provider_reference,opened_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,orderId,orderItemId,authorId,provider,code,exceptionSeverity(code),'open',title||String(code).replaceAll('_',' '),detail,providerReference,now(),JSON.stringify(metadata||{})).run();
  return id;
}

export async function ensureReceiptToken(env,orderId){
  const row=await env.DB.prepare(`SELECT receipt_token FROM orders WHERE id=?`).bind(orderId).first();
  if(row?.receipt_token) return row.receipt_token;
  const token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','').slice(0,12);
  await env.DB.prepare(`UPDATE orders SET receipt_token=?,updated_at=? WHERE id=?`).bind(token,now(),orderId).run();
  return token;
}

export async function materializeSettlementAllocations(env,orderId){
  const order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(orderId).first();
  if(!order) throw new Error('order_not_found');
  const rows=await all(env.DB.prepare(`SELECT oi.*,e.format,a.stripe_connected_account_id FROM order_items oi JOIN editions e ON e.id=oi.edition_id JOIN authors a ON a.id=oi.author_id WHERE oi.order_id=? ORDER BY oi.created_at,oi.id`).bind(orderId));
  const activeDispute=await env.DB.prepare(`SELECT COUNT(*) n FROM dispute_records WHERE order_id=? AND status NOT IN ('won','lost','closed','warning_closed')`).bind(orderId).first();
  const byAuthor=new Map();
  for(const row of rows){
    const current=byAuthor.get(row.author_id)||{authorId:row.author_id,gross:0,marketplace:0,processor:0,fulfillment:0,refunded:0,disputed:0,transferred:0,accountId:row.stripe_connected_account_id,fulfillmentCostPending:false};
    current.gross+=Number(row.gross_minor||0);
    current.marketplace+=Number(row.marketplace_fee_minor||0);
    current.processor+=Number(row.actual_processor_fee_minor??row.stripe_fee_minor??0);
    current.fulfillment+=Number(row.actual_fulfillment_cost_minor??row.estimated_fulfillment_cost_minor??0);
    current.refunded+=Number(row.refunded_minor||0);
    current.disputed+=Number(row.disputed_minor||0);
    current.transferred+=Number(row.transferred_minor||0);
    if(['paperback','hardcover'].includes(String(row.format).toLowerCase())&&row.actual_fulfillment_cost_minor==null) current.fulfillmentCostPending=true;
    byAuthor.set(row.author_id,current);
  }
  for(const row of rows){
    const gross=Number(row.gross_minor||0), marketplace=Number(row.marketplace_fee_minor||0), processor=Number(row.actual_processor_fee_minor??row.stripe_fee_minor??0), fulfillment=Number(row.actual_fulfillment_cost_minor??row.estimated_fulfillment_cost_minor??0), refunded=Number(row.refunded_minor||0), disputed=Number(row.disputed_minor||0);
    const payable=Math.max(0,gross-marketplace-processor-fulfillment-refunded-disputed);
    await env.DB.prepare(`UPDATE order_items SET seller_payable_minor=?,settlement_status=?,updated_at=? WHERE id=?`).bind(payable,'reconciling',now(),row.id).run();
  }
  for(const a of byAuthor.values()){
    const rec=reconcileAllocation({allocation:{grossMinor:a.gross,marketplaceFeeMinor:a.marketplace,processorFeeMinor:a.processor,fulfillmentCostMinor:a.fulfillment,refundedMinor:a.refunded,disputedMinor:a.disputed,transferredMinor:a.transferred},paymentStatus:order.payment_status,hasDispute:Number(activeDispute?.n||0)>0,providerReconciled:!!order.last_reconciled_at,fulfillmentCostPending:a.fulfillmentCostPending});
    await env.DB.prepare(`INSERT INTO settlement_allocations (id,order_id,author_id,currency,gross_minor,marketplace_fee_minor,processor_fee_minor,fulfillment_cost_minor,refunded_minor,disputed_minor,payable_minor,status,transfer_group,last_reconciled_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(order_id,author_id) DO UPDATE SET gross_minor=excluded.gross_minor,marketplace_fee_minor=excluded.marketplace_fee_minor,processor_fee_minor=excluded.processor_fee_minor,fulfillment_cost_minor=excluded.fulfillment_cost_minor,refunded_minor=excluded.refunded_minor,disputed_minor=excluded.disputed_minor,payable_minor=excluded.payable_minor,status=excluded.status,last_reconciled_at=excluded.last_reconciled_at,updated_at=excluded.updated_at`).bind(uuid(),orderId,a.authorId,order.currency||'usd',rec.grossMinor,rec.marketplaceFeeMinor,rec.processorFeeMinor,rec.fulfillmentCostMinor,rec.refundedMinor,rec.disputedMinor,rec.payableMinor,rec.status,orderId,order.last_reconciled_at||null,now(),now()).run();
    await env.DB.prepare(`UPDATE order_items SET settlement_status=?,updated_at=? WHERE order_id=? AND author_id=?`).bind(rec.status,now(),orderId,a.authorId).run();
  }
  return all(env.DB.prepare(`SELECT * FROM settlement_allocations WHERE order_id=? ORDER BY author_id`).bind(orderId));
}

export async function createFulfillmentJobs(env,orderId){
  const items=await all(env.DB.prepare(`SELECT oi.id order_item_id,oi.fulfillment_provider,e.format,e.isbn FROM order_items oi JOIN editions e ON e.id=oi.edition_id WHERE oi.order_id=?`).bind(orderId));
  let created=0;
  for(const item of items){
    if(!['paperback','hardcover'].includes(String(item.format).toLowerCase())) continue;
    const provider=item.fulfillment_provider||'ingram';
    const existing=await env.DB.prepare(`SELECT id FROM fulfillment_jobs WHERE order_item_id=? LIMIT 1`).bind(item.order_item_id).first();
    if(existing) continue;
    const id=uuid();
    await env.DB.prepare(`INSERT INTO fulfillment_jobs (id,order_item_id,provider,status,raw_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind(id,item.order_item_id,provider,'queued','queued',now(),now()).run();
    await env.DB.prepare(`INSERT OR IGNORE INTO commerce_jobs (id,job_type,order_id,order_item_id,provider,idempotency_key,status,attempts,available_at,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),'submit_fulfillment',orderId,item.order_item_id,provider,`fulfillment:${orderId}:${item.order_item_id}`,'queued',0,now(),JSON.stringify({isbn:item.isbn}),now(),now()).run();
    created++;
  }
  if(created) await env.DB.prepare(`UPDATE orders SET fulfillment_status='queued',updated_at=? WHERE id=?`).bind(now(),orderId).run();
  return created;
}

export async function refreshOrderFulfillment(env,orderId){
  const jobs=await all(env.DB.prepare(`SELECT fj.status FROM fulfillment_jobs fj JOIN order_items oi ON oi.id=fj.order_item_id WHERE oi.order_id=?`).bind(orderId));
  const status=deriveOrderFulfillmentStatus(jobs.map(x=>x.status));
  const old=await env.DB.prepare(`SELECT fulfillment_status FROM orders WHERE id=?`).bind(orderId).first();
  if(old&&old.fulfillment_status!==status){
    await env.DB.prepare(`UPDATE orders SET fulfillment_status=?,updated_at=? WHERE id=?`).bind(status,now(),orderId).run();
    await recordOrderStatus(env,{orderId,statusType:'fulfillment',fromStatus:old.fulfillment_status,toStatus:status,source:'marketplace'});
  }
  return status;
}

export async function listAuthorOrders(env,authorId,{limit=50}={}){
  const rows=await all(env.DB.prepare(`SELECT o.id,o.created_at,o.paid_at,o.payment_status,o.fulfillment_status,o.risk_status,o.currency,o.total_minor,o.customer_email,SUM(CASE WHEN oi.author_id=? THEN oi.gross_minor ELSE 0 END) author_gross_minor,SUM(CASE WHEN oi.author_id=? THEN oi.seller_payable_minor ELSE 0 END) author_payable_minor,SUM(CASE WHEN oi.author_id=? THEN oi.quantity ELSE 0 END) author_units FROM orders o JOIN order_items oi ON oi.order_id=o.id WHERE EXISTS(SELECT 1 FROM order_items x WHERE x.order_id=o.id AND x.author_id=?) GROUP BY o.id ORDER BY o.created_at DESC LIMIT ?`).bind(authorId,authorId,authorId,authorId,Math.max(1,Math.min(100,Number(limit)||50))));
  return rows.map(r=>({...r,author_gross_minor:Number(r.author_gross_minor||0),author_payable_minor:Number(r.author_payable_minor||0),author_units:Number(r.author_units||0)}));
}

export async function getAuthorOrder(env,authorId,orderId){
  const order=await env.DB.prepare(`SELECT o.* FROM orders o WHERE o.id=? AND EXISTS(SELECT 1 FROM order_items x WHERE x.order_id=o.id AND x.author_id=?)`).bind(orderId,authorId).first();
  if(!order) return null;
  const [items,fulfillment,history,settlements,exceptions]=await Promise.all([
    all(env.DB.prepare(`SELECT oi.*,e.format,e.isbn,b.title FROM order_items oi JOIN editions e ON e.id=oi.edition_id JOIN books b ON b.id=e.book_id WHERE oi.order_id=? AND oi.author_id=? ORDER BY oi.created_at`).bind(orderId,authorId)),
    all(env.DB.prepare(`SELECT fj.*,sp.carrier,sp.service_level,sp.tracking_number package_tracking_number,sp.tracking_url package_tracking_url FROM fulfillment_jobs fj JOIN order_items oi ON oi.id=fj.order_item_id LEFT JOIN shipment_packages sp ON sp.fulfillment_job_id=fj.id WHERE oi.order_id=? AND oi.author_id=? ORDER BY fj.created_at`).bind(orderId,authorId)),
    all(env.DB.prepare(`SELECT * FROM order_status_history WHERE order_id=? ORDER BY occurred_at DESC LIMIT 50`).bind(orderId)),
    all(env.DB.prepare(`SELECT * FROM settlement_allocations WHERE order_id=? AND author_id=?`).bind(orderId,authorId)),
    all(env.DB.prepare(`SELECT * FROM commerce_exceptions WHERE order_id=? AND (author_id=? OR author_id IS NULL) ORDER BY opened_at DESC`).bind(orderId,authorId))
  ]);
  return {order,items,fulfillment,history,settlements,exceptions};
}

export async function commerceHealth(env,authorId){
  const [settlements,exceptions,jobs]=await Promise.all([
    all(env.DB.prepare(`SELECT * FROM settlement_allocations WHERE author_id=? ORDER BY created_at DESC LIMIT 200`).bind(authorId)),
    all(env.DB.prepare(`SELECT * FROM commerce_exceptions WHERE author_id=? OR order_id IN (SELECT order_id FROM order_items WHERE author_id=?) ORDER BY opened_at DESC LIMIT 200`).bind(authorId,authorId)),
    all(env.DB.prepare(`SELECT cj.* FROM commerce_jobs cj WHERE cj.order_id IN (SELECT order_id FROM order_items WHERE author_id=?) ORDER BY cj.created_at DESC LIMIT 200`).bind(authorId))
  ]);
  return summarizeCommerceHealth({settlements,exceptions,jobs});
}
