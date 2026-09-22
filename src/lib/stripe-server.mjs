const API='https://api.stripe.com/v1';
function appendForm(fd,key,value){
  if(value===undefined||value===null) return;
  if(Array.isArray(value)){value.forEach((v,i)=>appendForm(fd,`${key}[${i}]`,v));return;}
  if(typeof value==='object'){for(const [k,v] of Object.entries(value)) appendForm(fd,`${key}[${k}]`,v);return;}
  fd.append(key,String(value));
}
async function stripeRequest(env,path,params={},method='POST',idempotencyKey=null){
  if(!env.STRIPE_SECRET_KEY) throw new Error('stripe_secret_missing');
  const body=new URLSearchParams(); for(const [k,v] of Object.entries(params)) appendForm(body,k,v);
  const headers={authorization:`Bearer ${env.STRIPE_SECRET_KEY}`};
  if(method!=='GET') headers['content-type']='application/x-www-form-urlencoded';
  if(env.STRIPE_API_VERSION) headers['Stripe-Version']=env.STRIPE_API_VERSION;
  if(idempotencyKey) headers['Idempotency-Key']=idempotencyKey;
  const qs=method==='GET'&&body.toString()?`?${body}`:'';
  const res=await fetch(`${API}${path}${qs}`,{method,headers,body:method==='GET'?undefined:body});
  const data=await res.json(); if(!res.ok) throw new Error(data?.error?.message||`stripe_${res.status}`); return data;
}
export async function createExpressAccount(env,{email,country='US',metadata={}}){return stripeRequest(env,'/accounts',{type:'express',country,email,capabilities:{transfers:{requested:true}},metadata},'POST',`acct:${metadata?.yasready_author_id||email||country}`);}
export async function createAccountLink(env,{account,refreshUrl,returnUrl}){return stripeRequest(env,'/account_links',{account,refresh_url:refreshUrl,return_url:returnUrl,type:'account_onboarding',collection_options:{fields:'eventually_due',future_requirements:'include'}});}
export async function retrieveAccount(env,account){return stripeRequest(env,`/accounts/${encodeURIComponent(account)}`,{},'GET');}
export async function createCheckoutSession(env,{orderId,items,successUrl,cancelUrl,hasPhysical=false}){
  const line_items=items.map(x=>({price_data:{currency:x.currency||'usd',unit_amount:x.priceMinor,product_data:{name:`${x.title} — ${x.format}`,metadata:{edition_id:x.editionId,author_id:x.authorId}}},quantity:x.quantity||1}));
  const params={mode:'payment',line_items,success_url:successUrl,cancel_url:cancelUrl,client_reference_id:orderId,metadata:{yasready_order_id:orderId},payment_intent_data:{transfer_group:orderId,metadata:{yasready_order_id:orderId}},billing_address_collection:'auto',automatic_tax:{enabled:true},customer_creation:'always'};
  if(hasPhysical) params.shipping_address_collection={allowed_countries:['US']};
  return stripeRequest(env,'/checkout/sessions',params,'POST',`checkout:${orderId}`);
}
export async function retrieveCheckoutSession(env,id){return stripeRequest(env,`/checkout/sessions/${encodeURIComponent(id)}`,{expand:['payment_intent']},'GET');}
export async function retrievePaymentIntent(env,id){return stripeRequest(env,`/payment_intents/${encodeURIComponent(id)}`,{expand:['latest_charge.balance_transaction']},'GET');}
export async function retrieveCharge(env,id){return stripeRequest(env,`/charges/${encodeURIComponent(id)}`,{expand:['balance_transaction']},'GET');}
export async function createTransfer(env,{amount,currency='usd',destination,transferGroup,sourceTransaction=null,metadata={},idempotencyKey}){return stripeRequest(env,'/transfers',{amount,currency,destination,transfer_group:transferGroup,source_transaction:sourceTransaction||undefined,metadata},'POST',idempotencyKey);}
export async function reverseTransfer(env,{transferId,amount=null,metadata={},idempotencyKey}){return stripeRequest(env,`/transfers/${encodeURIComponent(transferId)}/reversals`,{amount:amount||undefined,metadata},'POST',idempotencyKey);}
export async function createRefund(env,{paymentIntent,amount=null,reason=null,metadata={},idempotencyKey}){return stripeRequest(env,'/refunds',{payment_intent:paymentIntent,amount:amount||undefined,reason:reason||undefined,metadata},'POST',idempotencyKey);}
function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function verifyStripeSignature(payload,header,secret,toleranceSec=300){
  if(!payload||!header||!secret) return false;
  const bits=header.split(',').map(x=>x.split('=',2)); const ts=Number(bits.find(x=>x[0]==='t')?.[1]||0); const sigs=bits.filter(x=>x[0]==='v1').map(x=>x[1]);
  if(!ts||!sigs.length||Math.abs(Date.now()/1000-ts)>toleranceSec) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${payload}`)); const expected=hex(mac);
  return sigs.some(sig=>{if(expected.length!==sig.length)return false;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^sig.charCodeAt(i);return diff===0;});
}
