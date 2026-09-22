const clamp=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Math.max(min,Math.min(max,Math.round(Number(n)||0)));

export function prorateMinor(totalMinor, lines, valueKey='grossMinor'){
  totalMinor=clamp(totalMinor); const clean=lines.map((x,i)=>({...x,_i:i,_v:clamp(x[valueKey])}));
  const base=clean.reduce((s,x)=>s+x._v,0); if(!base||!totalMinor) return clean.map(x=>({...x,allocatedMinor:0}));
  const rows=clean.map(x=>({...x,allocatedMinor:Math.floor(totalMinor*x._v/base)}));
  let left=totalMinor-rows.reduce((s,x)=>s+x.allocatedMinor,0);
  rows.sort((a,b)=>(b._v/base*totalMinor-b.allocatedMinor)-(a._v/base*totalMinor-a.allocatedMinor)||a._i-b._i);
  for(let i=0;i<rows.length&&left>0;i++,left--) rows[i].allocatedMinor++;
  return rows.sort((a,b)=>a._i-b._i).map(({_i,_v,...x})=>x);
}

export function allocateRefund(amountMinor,items){
  const refundable=items.map(x=>({...x,refundableMinor:Math.max(0,clamp(x.grossMinor)-clamp(x.refundedMinor))}));
  const max=refundable.reduce((s,x)=>s+x.refundableMinor,0); const wanted=Math.min(clamp(amountMinor),max);
  return prorateMinor(wanted,refundable,'refundableMinor').filter(x=>x.allocatedMinor>0).map(x=>({orderItemId:x.id,authorId:x.authorId,grossRefundMinor:x.allocatedMinor}));
}

export function sellerBalance({earnedMinor=0,refundedMinor=0,transferredMinor=0,reversedMinor=0,adjustmentsMinor=0}){
  const netEarned=clamp(earnedMinor)-clamp(refundedMinor)+Math.round(Number(adjustmentsMinor)||0);
  const paidOut=clamp(transferredMinor)-clamp(reversedMinor);
  return {earnedMinor:clamp(earnedMinor),refundedMinor:clamp(refundedMinor),netEarnedMinor:netEarned,paidOutMinor:paidOut,availableMinor:netEarned-paidOut};
}

export function refundStatus(orderTotalMinor,refundedMinor){
  const total=clamp(orderTotalMinor), refunded=clamp(refundedMinor); if(!refunded) return 'none'; if(refunded>=total) return 'refunded'; return 'partially_refunded';
}

export function commerceReadiness(env={}){
  const stripeMode=env.STRIPE_MODE||'off';
  return {checkoutEnabled:env.CHECKOUT_ENABLED==='true',stripeMode,liveMoney:stripeMode==='live'&&env.CHECKOUT_ENABLED==='true',webhookConfigured:Boolean(env.STRIPE_WEBHOOK_SECRET),adminRefundConfigured:Boolean(env.COMMERCE_ADMIN_SECRET),ingramMode:env.INGRAM_MODE||'off'};
}

// Commerce Pro primitives. Kept beside the earlier public helpers so v0.2 clients remain compatible.
export const isPhysicalFormat=format=>['paperback','hardcover'].includes(String(format||'').toLowerCase());
export function allocateProRata(totalMinor,rows,weightKey='grossMinor'){
  const total=Math.max(0,Math.round(Number(totalMinor)||0)); if(!rows?.length)return [];
  const weights=rows.map(r=>Math.max(0,Number(r?.[weightKey]??r?.gross_minor??0))),sum=weights.reduce((a,b)=>a+b,0);
  if(sum<=0){const out=rows.map(()=>0);if(out.length)out[0]=total;return out;}
  const raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor);let left=total-out.reduce((a,b)=>a+b,0);
  const order=raw.map((x,i)=>({i,f:x-Math.floor(x)})).sort((a,b)=>b.f-a.f||a.i-b.i);for(let n=0;n<left;n++)out[order[n%order.length].i]++;return out;
}
export function buildSettlementPlan({grossMinor=0,marketplaceFeeMinor=0,processorFeeMinor=0,fulfillmentCostMinor=0,refundedMinor=0,disputedMinor=0}={}){
  const gross=Math.max(0,Number(grossMinor)||0),d=[marketplaceFeeMinor,processorFeeMinor,fulfillmentCostMinor,refundedMinor,disputedMinor].map(x=>Math.max(0,Number(x)||0));
  return {grossMinor:gross,marketplaceFeeMinor:d[0],processorFeeMinor:d[1],fulfillmentCostMinor:d[2],refundedMinor:d[3],disputedMinor:d[4],payableMinor:Math.max(0,gross-d.reduce((a,b)=>a+b,0))};
}
export function normalizeStripeCommerceEvent(type=''){if(type.startsWith('checkout.session.'))return'checkout';if(type.startsWith('payment_intent.'))return'payment';if(type.startsWith('refund.')||type==='charge.refunded')return'refund';if(type.startsWith('charge.dispute.'))return'dispute';if(type.startsWith('transfer.'))return'transfer';if(type==='account.updated')return'connected_account';return'other';}
export function deriveOrderFulfillmentStatus(statuses=[]){if(!statuses.length)return'not_required';const s=statuses.map(x=>String(x||'').toLowerCase());if(s.some(x=>['failed','rejected','canceled'].includes(x)))return'exception';if(s.every(x=>x==='delivered'))return'delivered';if(s.some(x=>x==='shipped'||x==='delivered'))return'shipped';if(s.some(x=>['processing','submitted','acknowledged','queued'].includes(x)))return'processing';return'queued';}
export function settlementStatus({paymentStatus,hasDispute=false,providerReconciled=false,fulfillmentCostPending=false,payableMinor=0,transferredMinor=0,refundedMinor=0}={}){const p=String(paymentStatus||'').toLowerCase();if(hasDispute)return'hold_dispute';if(p==='refunded'||(Number(refundedMinor)>0&&Number(payableMinor)<=0))return'refunded';if(['failed','canceled','unpaid'].includes(p))return'blocked';if(!['paid','succeeded','partially_refunded'].includes(p))return'awaiting_payment';if(fulfillmentCostPending)return'awaiting_fulfillment_cost';if(Number(transferredMinor)>=Number(payableMinor)&&Number(payableMinor)>0)return'transferred';if(!providerReconciled)return'awaiting_reconciliation';return'ready_to_transfer';}
export function redactAddress(a){if(!a)return null;return{city:a.city||null,state:a.state||null,postalCode:a.postal_code||a.postalCode||null,country:a.country||null};}
