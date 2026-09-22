import {ensureReceiptToken,materializeSettlementAllocations,createFulfillmentJobs,recordOrderStatus,openCommerceException,audit} from './commerce-ops.mjs';
import {allocateProRata} from './commerce.mjs';
const uuid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
async function all(stmt){const r=await stmt.all();return r.results||[];}
function orderRef(obj={}){return obj?.metadata?.yasready_order_id||obj?.client_reference_id||obj?.transfer_group||null;}
async function writeMarketplaceEvent(env,{type,orderId=null,authorId=null,properties={}}){await env.DB.prepare(`INSERT OR IGNORE INTO marketplace_events (id,event_type,author_id,order_id,occurred_at,properties_json) VALUES (?,?,?,?,?,?)`).bind(uuid(),type,authorId,orderId,now(),JSON.stringify(properties||{})).run();}
async function queueJob(env,{type,orderId=null,orderItemId=null,provider='stripe',key,payload={}}){await env.DB.prepare(`INSERT OR IGNORE INTO commerce_jobs (id,job_type,order_id,order_item_id,provider,idempotency_key,status,attempts,available_at,payload_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uuid(),type,orderId,orderItemId,provider,key,'queued',0,now(),JSON.stringify(payload||{}),now(),now()).run();}

async function ensureCustomer(env,obj,orderId){
  const email=obj?.customer_details?.email||obj?.customer_email||null, stripeCustomer=typeof obj?.customer==='string'?obj.customer:null;
  if(!email&&!stripeCustomer) return null;
  let customer=stripeCustomer?await env.DB.prepare(`SELECT * FROM customers WHERE stripe_customer_id=?`).bind(stripeCustomer).first():null;
  if(!customer&&email) customer=await env.DB.prepare(`SELECT * FROM customers WHERE email=? ORDER BY created_at DESC LIMIT 1`).bind(email).first();
  if(!customer){const id=uuid();await env.DB.prepare(`INSERT INTO customers (id,stripe_customer_id,email,created_at) VALUES (?,?,?,?)`).bind(id,stripeCustomer,email,now()).run();customer={id,email,stripe_customer_id:stripeCustomer};}
  else if(stripeCustomer&&!customer.stripe_customer_id) await env.DB.prepare(`UPDATE customers SET stripe_customer_id=? WHERE id=?`).bind(stripeCustomer,customer.id).run();
  await env.DB.prepare(`UPDATE orders SET customer_id=COALESCE(customer_id,?),customer_email=COALESCE(customer_email,?),customer_name=COALESCE(customer_name,?),updated_at=? WHERE id=?`).bind(customer.id,email,obj?.customer_details?.name||null,now(),orderId).run();
  return customer;
}

async function handleCheckoutPaid(env,event,obj){
  const orderId=orderRef(obj); if(!orderId) return {handled:false,reason:'order_reference_missing'};
  const order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(orderId).first(); if(!order) return {handled:false,reason:'order_not_found'};
  const paymentStatus=(obj.payment_status==='paid'||event.type==='checkout.session.async_payment_succeeded')?'paid':'authorized';
  const shipping=obj?.shipping_details||obj?.collected_information?.shipping_details||null, address=shipping?.address||null, paymentIntent=typeof obj.payment_intent==='string'?obj.payment_intent:null;
  await ensureCustomer(env,obj,orderId);
  await env.DB.prepare(`UPDATE orders SET payment_status=?,paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,?) ELSE paid_at END,stripe_payment_intent_id=COALESCE(stripe_payment_intent_id,?),checkout_provider='stripe',checkout_provider_reference=COALESCE(checkout_provider_reference,?),customer_email=COALESCE(customer_email,?),customer_name=COALESCE(customer_name,?),shipping_name=COALESCE(shipping_name,?),shipping_phone=COALESCE(shipping_phone,?),shipping_address_json=COALESCE(shipping_address_json,?),subtotal_minor=COALESCE(?,subtotal_minor),total_minor=COALESCE(?,total_minor),tax_minor=COALESCE(?,tax_minor),shipping_minor=COALESCE(?,shipping_minor),discount_minor=COALESCE(?,discount_minor),provider_amount_subtotal_minor=COALESCE(?,provider_amount_subtotal_minor),provider_amount_total_minor=COALESCE(?,provider_amount_total_minor),provider_tax_minor=COALESCE(?,provider_tax_minor),provider_shipping_minor=COALESCE(?,provider_shipping_minor),provider_discount_minor=COALESCE(?,provider_discount_minor),updated_at=? WHERE id=?`)
    .bind(paymentStatus,paymentStatus,now(),paymentIntent,obj.id,obj?.customer_details?.email||null,obj?.customer_details?.name||null,shipping?.name||null,obj?.customer_details?.phone||null,address?JSON.stringify(address):null,obj.amount_subtotal??null,obj.amount_total??null,obj?.total_details?.amount_tax??null,obj?.shipping_cost?.amount_total??null,obj?.total_details?.amount_discount??null,obj.amount_subtotal??null,obj.amount_total??null,obj?.total_details?.amount_tax??null,obj?.shipping_cost?.amount_total??null,obj?.total_details?.amount_discount??null,now(),orderId).run();
  if(order.payment_status!==paymentStatus) await recordOrderStatus(env,{orderId,statusType:'payment',fromStatus:order.payment_status,toStatus:paymentStatus,source:'stripe',sourceReference:event.id});
  const token=await ensureReceiptToken(env,orderId);
  await materializeSettlementAllocations(env,orderId); const jobs=paymentStatus==='paid'?await createFulfillmentJobs(env,orderId):0;
  if(paymentIntent) await queueJob(env,{type:'stripe_reconcile_payment',orderId,key:`stripe-payment-reconcile:${paymentIntent}`,payload:{paymentIntent,checkoutSessionId:obj.id}});
  await writeMarketplaceEvent(env,{type:paymentStatus==='paid'?'payment_succeeded':'payment_authorized',orderId,properties:{provider:'stripe',externalEventId:event.id,fulfillmentJobsCreated:jobs,receiptReady:true}});
  return {handled:true,orderId,receiptToken:token};
}

async function handlePaymentIntent(env,event,obj){
  const orderId=orderRef(obj); if(!orderId) return {handled:false,reason:'order_reference_missing'};
  const order=await env.DB.prepare(`SELECT * FROM orders WHERE id=?`).bind(orderId).first(); if(!order) return {handled:false,reason:'order_not_found'};
  const status=event.type==='payment_intent.succeeded'?'paid':'failed';
  await env.DB.prepare(`UPDATE orders SET payment_status=?,stripe_payment_intent_id=COALESCE(stripe_payment_intent_id,?),paid_at=CASE WHEN ?='paid' THEN COALESCE(paid_at,?) ELSE paid_at END,updated_at=? WHERE id=?`).bind(status,obj.id,status,now(),now(),orderId).run();
  if(order.payment_status!==status) await recordOrderStatus(env,{orderId,statusType:'payment',fromStatus:order.payment_status,toStatus:status,source:'stripe',sourceReference:event.id});
  if(status==='paid'){
    await env.DB.prepare(`INSERT INTO payment_records (id,order_id,provider,external_payment_id,external_charge_id,balance_transaction_id,amount_minor,fee_minor,net_minor,currency,status,livemode,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,external_payment_id) DO UPDATE SET external_charge_id=COALESCE(excluded.external_charge_id,payment_records.external_charge_id),amount_minor=excluded.amount_minor,status=excluded.status,updated_at=excluded.updated_at`).bind(uuid(),orderId,'stripe',obj.id,typeof obj.latest_charge==='string'?obj.latest_charge:null,null,Number(obj.amount_received||obj.amount||0),null,null,String(obj.currency||order.currency||'usd'),obj.status||'succeeded',event.livemode?1:0,now(),now()).run();
    await ensureReceiptToken(env,orderId); await materializeSettlementAllocations(env,orderId); await createFulfillmentJobs(env,orderId);
    await queueJob(env,{type:'stripe_reconcile_payment',orderId,key:`stripe-payment-reconcile:${obj.id}`,payload:{paymentIntent:obj.id,latestCharge:typeof obj.latest_charge==='string'?obj.latest_charge:null}});
  }else await openCommerceException(env,{orderId,provider:'stripe',code:'payment_failed',title:'Payment failed',detail:obj?.last_payment_error?.message||'Stripe reported a failed payment.',providerReference:event.id});
  return {handled:true,orderId};
}

async function findOrderByPayment(env,obj){
  const direct=orderRef(obj); if(direct) return direct;
  const pi=typeof obj.payment_intent==='string'?obj.payment_intent:null; if(pi){const r=await env.DB.prepare(`SELECT id FROM orders WHERE stripe_payment_intent_id=? LIMIT 1`).bind(pi).first();if(r)return r.id;}
  const charge=typeof obj.charge==='string'?obj.charge:(String(obj.id||'').startsWith('ch_')?obj.id:null); if(charge){const p=await env.DB.prepare(`SELECT order_id FROM payment_records WHERE external_charge_id=? LIMIT 1`).bind(charge).first();if(p)return p.order_id;}
  return null;
}

async function handleRefund(env,event,obj){
  const orderId=await findOrderByPayment(env,obj); if(!orderId) return {handled:false,reason:'order_not_found'};
  const refundId=String(obj.id||event.id), amount=Number(obj.amount||0);
  await env.DB.prepare(`INSERT INTO refund_records (id,order_id,provider,external_refund_id,external_payment_id,amount_minor,currency,reason,status,transfer_reversal_required,created_at,updated_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,external_refund_id) DO UPDATE SET amount_minor=excluded.amount_minor,status=excluded.status,updated_at=excluded.updated_at,metadata_json=excluded.metadata_json`).bind(uuid(),orderId,'stripe',refundId,typeof obj.payment_intent==='string'?obj.payment_intent:null,amount,String(obj.currency||'usd'),obj.reason||null,obj.status||'pending',1,now(),now(),JSON.stringify({eventId:event.id})).run();
  const total=await env.DB.prepare(`SELECT COALESCE(SUM(amount_minor),0) total FROM refund_records WHERE order_id=? AND status IN ('succeeded','pending')`).bind(orderId).first();
  const order=await env.DB.prepare(`SELECT total_minor,payment_status FROM orders WHERE id=?`).bind(orderId).first();
  const items=await all(env.DB.prepare(`SELECT id,gross_minor FROM order_items WHERE order_id=? ORDER BY created_at,id`).bind(orderId));
  const grossPool=items.reduce((a,x)=>a+Number(x.gross_minor||0),0), refunded=Number(total?.total||0), sellerRefundPool=Math.min(refunded,grossPool), allocations=allocateProRata(sellerRefundPool,items.map(x=>({grossMinor:Number(x.gross_minor||0)})));
  for(let i=0;i<items.length;i++) await env.DB.prepare(`UPDATE order_items SET refunded_minor=?,updated_at=? WHERE id=?`).bind(allocations[i],now(),items[i].id).run();
  const next=refunded>=Number(order?.total_minor||0)?'refunded':'partially_refunded';
  await env.DB.prepare(`UPDATE orders SET payment_status=?,refunded_at=CASE WHEN ?='refunded' THEN COALESCE(refunded_at,?) ELSE refunded_at END,updated_at=? WHERE id=?`).bind(next,next,now(),now(),orderId).run();
  await recordOrderStatus(env,{orderId,statusType:'payment',fromStatus:order?.payment_status||null,toStatus:next,source:'stripe',sourceReference:event.id,metadata:{refundMinor:amount,totalRefundedMinor:refunded,sellerRefundPoolMinor:sellerRefundPool}});
  await queueJob(env,{type:'stripe_refund_reconcile',orderId,key:`stripe-refund-reconcile:${refundId}`,payload:{refundId,amountMinor:amount}});
  const settlements=await materializeSettlementAllocations(env,orderId);
  for(const settlement of settlements){const transferred=await env.DB.prepare(`SELECT COALESCE(SUM(amount_minor-reversed_minor),0) amount FROM transfer_records WHERE order_id=? AND author_id=? AND provider='stripe'`).bind(orderId,settlement.author_id).first();const over=Math.max(0,Number(transferred?.amount||0)-Number(settlement.payable_minor||0));if(over>0){await queueJob(env,{type:'stripe_transfer_reversal_review',orderId,key:`stripe-transfer-reversal-review:${refundId}:${settlement.author_id}`,payload:{refundId,authorId:settlement.author_id,recoveryMinor:over}});await openCommerceException(env,{orderId,authorId:settlement.author_id,provider:'stripe',code:'transfer_reversal_required',title:'Transferred author funds need refund recovery',detail:`A refund reduced seller payable below funds already transferred by ${over} minor units.`,providerReference:refundId,metadata:{recoveryMinor:over}});}}
  await writeMarketplaceEvent(env,{type:'refund_changed',orderId,properties:{refundId,amountMinor:amount,status:obj.status}}); return {handled:true,orderId};
}

async function handleChargeRefunded(env,event,obj){const orderId=await findOrderByPayment(env,obj);if(!orderId)return {handled:false,reason:'order_not_found'};await queueJob(env,{type:'stripe_refund_reconcile',orderId,key:`stripe-charge-refund-reconcile:${obj.id}:${obj.amount_refunded||0}`,payload:{chargeId:obj.id,amountRefundedMinor:Number(obj.amount_refunded||0)}});return {handled:true,orderId,aggregateOnly:true};}

async function handleDispute(env,event,obj){
  const orderId=await findOrderByPayment(env,obj), disputeId=String(obj.id||event.id), amount=Number(obj.amount||0), status=obj.status||event.type.split('.').pop();
  await env.DB.prepare(`INSERT INTO dispute_records (id,order_id,provider,external_dispute_id,external_charge_id,amount_minor,currency,reason,status,evidence_due_at,created_at,updated_at,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,external_dispute_id) DO UPDATE SET order_id=COALESCE(excluded.order_id,dispute_records.order_id),status=excluded.status,evidence_due_at=excluded.evidence_due_at,updated_at=excluded.updated_at,metadata_json=excluded.metadata_json`).bind(uuid(),orderId,'stripe',disputeId,typeof obj.charge==='string'?obj.charge:null,amount,String(obj.currency||'usd'),obj.reason||null,status,obj?.evidence_details?.due_by?new Date(obj.evidence_details.due_by*1000).toISOString():null,now(),now(),JSON.stringify({eventId:event.id})).run();
  if(orderId){
    const won=status==='won',lost=status==='lost',active=!won&&!lost&&!['closed','warning_closed'].includes(status);
    const items=await all(env.DB.prepare(`SELECT id,gross_minor FROM order_items WHERE order_id=? ORDER BY created_at,id`).bind(orderId)), grossPool=items.reduce((a,x)=>a+Number(x.gross_minor||0),0), pool=won?0:Math.min(amount,grossPool), parts=allocateProRata(pool,items.map(x=>({grossMinor:Number(x.gross_minor||0)})));
    for(let i=0;i<items.length;i++) await env.DB.prepare(`UPDATE order_items SET disputed_minor=?,updated_at=? WHERE id=?`).bind(parts[i],now(),items[i].id).run();
    await env.DB.prepare(`UPDATE orders SET risk_status=?,updated_at=? WHERE id=?`).bind(active?'dispute':lost?'dispute_lost':'normal',now(),orderId).run();
    let settlements=await materializeSettlementAllocations(env,orderId);
    if(active){for(const a of settlements)await env.DB.prepare(`INSERT INTO settlement_holds (id,settlement_allocation_id,author_id,order_id,reason_code,amount_minor,status,opened_at,metadata_json) SELECT ?,?,?,?,?,?,'active',?,? WHERE NOT EXISTS(SELECT 1 FROM settlement_holds WHERE settlement_allocation_id=? AND reason_code='stripe_dispute' AND status='active')`).bind(uuid(),a.id,a.author_id,orderId,'stripe_dispute',a.payable_minor,now(),JSON.stringify({disputeId}),a.id).run();await openCommerceException(env,{orderId,provider:'stripe',code:'dispute_opened',title:'Payment dispute opened',detail:`Stripe dispute ${disputeId} requires review.`,providerReference:disputeId,metadata:{status,amountMinor:amount}});}
    else{await env.DB.prepare(`UPDATE settlement_holds SET status='released',released_at=? WHERE order_id=? AND reason_code='stripe_dispute' AND status='active'`).bind(now(),orderId).run();settlements=await materializeSettlementAllocations(env,orderId);if(lost){for(const a of settlements){const tr=await env.DB.prepare(`SELECT COALESCE(SUM(amount_minor-reversed_minor),0) amount FROM transfer_records WHERE order_id=? AND author_id=? AND provider='stripe'`).bind(orderId,a.author_id).first();const over=Math.max(0,Number(tr?.amount||0)-Number(a.payable_minor||0));if(over>0){await queueJob(env,{type:'stripe_dispute_recovery_review',orderId,key:`stripe-dispute-recovery:${disputeId}:${a.author_id}`,payload:{disputeId,authorId:a.author_id,recoveryMinor:over}});await openCommerceException(env,{orderId,authorId:a.author_id,provider:'stripe',code:'negative_balance_recovery_required',title:'Dispute loss requires transferred-funds recovery',detail:`The lost dispute reduced seller payable below funds already transferred by ${over} minor units.`,providerReference:disputeId,metadata:{recoveryMinor:over}});}}}}
    await writeMarketplaceEvent(env,{type:'dispute_changed',orderId,properties:{disputeId,status,amountMinor:amount,sellerDisputePoolMinor:pool}});
  }
  return {handled:true,orderId};
}

async function handleTransfer(env,event,obj){
  const orderId=orderRef(obj)||obj.transfer_group||null, authorId=obj?.metadata?.yasready_author_id||null; if(!authorId)return {handled:false,reason:'author_reference_missing'};
  const amount=Number(obj.amount||0),reversed=Number(obj.amount_reversed||0),net=Math.max(0,amount-reversed);
  await env.DB.prepare(`INSERT INTO transfer_records (id,order_id,author_id,provider,external_transfer_id,source_transaction_id,amount_minor,reversed_minor,currency,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,external_transfer_id) DO UPDATE SET reversed_minor=excluded.reversed_minor,status=excluded.status,updated_at=excluded.updated_at`).bind(uuid(),orderId,authorId,'stripe',obj.id,typeof obj.source_transaction==='string'?obj.source_transaction:null,amount,reversed,String(obj.currency||'usd'),obj.reversed?'reversed':'succeeded',now(),now()).run();
  if(orderId){const items=await all(env.DB.prepare(`SELECT id,seller_payable_minor FROM order_items WHERE order_id=? AND author_id=? ORDER BY created_at,id`).bind(orderId,authorId));const cap=Math.min(net,items.reduce((s,x)=>s+Number(x.seller_payable_minor||0),0)),parts=allocateProRata(cap,items.map(x=>({grossMinor:Number(x.seller_payable_minor||0)})));for(let i=0;i<items.length;i++)await env.DB.prepare(`UPDATE order_items SET stripe_transfer_id=COALESCE(stripe_transfer_id,?),transferred_minor=?,updated_at=? WHERE id=?`).bind(obj.id,parts[i]||0,now(),items[i].id).run();await env.DB.prepare(`UPDATE settlement_allocations SET stripe_transfer_id=?,status=CASE WHEN ?>=payable_minor THEN 'transferred' ELSE status END,updated_at=? WHERE order_id=? AND author_id=?`).bind(obj.id,net,now(),orderId,authorId).run();}
  return {handled:true,orderId};
}

async function handleAccount(env,event,obj){const author=await env.DB.prepare(`SELECT * FROM authors WHERE stripe_connected_account_id=? LIMIT 1`).bind(obj.id).first();if(!author)return {handled:false,reason:'author_not_found'};const status=obj.details_submitted&&obj.payouts_enabled?'ready':obj.details_submitted?'pending':'started';await env.DB.prepare(`UPDATE authors SET stripe_onboarding_status=?,updated_at=? WHERE id=?`).bind(status,now(),author.id).run();await env.DB.prepare(`INSERT INTO connected_account_events (id,author_id,provider,external_account_id,event_type,status,occurred_at,metadata_json) VALUES (?,?,?,?,?,?,?,?)`).bind(uuid(),author.id,'stripe',obj.id,event.type,status,now(),JSON.stringify({chargesEnabled:obj.charges_enabled,payoutsEnabled:obj.payouts_enabled,currentlyDue:obj.requirements?.currently_due||[]})).run();if(status!=='ready'&&(obj.requirements?.currently_due||[]).length)await openCommerceException(env,{authorId:author.id,provider:'stripe',code:'connected_account_requirements_due',title:'Payout account needs attention',detail:'Stripe reports onboarding or verification requirements that must be completed.',providerReference:obj.id,metadata:{currentlyDue:obj.requirements.currently_due}});return {handled:true,authorId:author.id};}

export async function processStripeEvent(env,event){
  const obj=event?.data?.object||{};
  let result;
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) result=await handleCheckoutPaid(env,event,obj);
  else if(event.type==='checkout.session.async_payment_failed'){const orderId=orderRef(obj);if(orderId){const old=await env.DB.prepare(`SELECT payment_status FROM orders WHERE id=?`).bind(orderId).first();await env.DB.prepare(`UPDATE orders SET payment_status='failed',updated_at=? WHERE id=?`).bind(now(),orderId).run();await recordOrderStatus(env,{orderId,statusType:'payment',fromStatus:old?.payment_status||null,toStatus:'failed',source:'stripe',sourceReference:event.id});await openCommerceException(env,{orderId,provider:'stripe',code:'payment_failed',title:'Asynchronous payment failed',detail:'Stripe reported that the delayed payment method failed.',providerReference:event.id});}result={handled:true,orderId};}
  else if(['payment_intent.succeeded','payment_intent.payment_failed'].includes(event.type)) result=await handlePaymentIntent(env,event,obj);
  else if(['refund.created','refund.updated'].includes(event.type)) result=await handleRefund(env,event,obj);
  else if(event.type==='charge.refunded') result=await handleChargeRefunded(env,event,obj);
  else if(event.type.startsWith('charge.dispute.')) result=await handleDispute(env,event,obj);
  else if(event.type.startsWith('transfer.')) result=await handleTransfer(env,event,obj);
  else if(event.type==='account.updated') result=await handleAccount(env,event,obj);
  else result={handled:false,reason:'event_not_modeled'};
  await audit(env,{actorType:'provider',actorId:'stripe',action:`stripe.${event.type}`,objectType:'event',objectId:event.id,orderId:result?.orderId||null,metadata:{handled:!!result?.handled,livemode:!!event.livemode}});
  return result;
}

export async function stripeCommerceSummary(env){
  const [orders,settlements,exceptions,transfers,refunds,disputes]=await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN payment_status IN ('paid','succeeded','partially_refunded') THEN 1 ELSE 0 END) paid,SUM(CASE WHEN risk_status!='normal' THEN 1 ELSE 0 END) risk FROM orders`).first(),
    env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status='ready_to_transfer' THEN 1 ELSE 0 END) ready,COALESCE(SUM(payable_minor),0) payable FROM settlement_allocations`).first(),
    env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status IN ('open','acknowledged') THEN 1 ELSE 0 END) open FROM commerce_exceptions`).first(),
    env.DB.prepare(`SELECT COUNT(*) total,COALESCE(SUM(amount_minor-reversed_minor),0) net FROM transfer_records`).first(),
    env.DB.prepare(`SELECT COUNT(*) total,COALESCE(SUM(amount_minor),0) amount FROM refund_records WHERE status IN ('pending','succeeded')`).first(),
    env.DB.prepare(`SELECT COUNT(*) total,COALESCE(SUM(amount_minor),0) amount FROM dispute_records WHERE status NOT IN ('won','closed','warning_closed')`).first()
  ]);
  return {orders,settlements,exceptions,transfers,refunds,disputes};
}
