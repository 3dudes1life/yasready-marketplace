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
