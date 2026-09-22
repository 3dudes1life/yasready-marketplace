const API='https://api.stripe.com/v1';

function appendForm(fd,key,value){
  if(value===undefined||value===null) return;
  if(Array.isArray(value)){value.forEach((v,i)=>appendForm(fd,`${key}[${i}]`,v));return;}
  if(typeof value==='object'){for(const [k,v] of Object.entries(value)) appendForm(fd,`${key}[${k}]`,v);return;}
  fd.append(key,String(value));
}
async function stripeRequest(env,path,params={},method='POST'){
  if(!env.STRIPE_SECRET_KEY) throw new Error('stripe_secret_missing');
  const body=new URLSearchParams();
  for(const [k,v] of Object.entries(params)) appendForm(body,k,v);
  const res=await fetch(`${API}${path}`,{method,headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,'content-type':'application/x-www-form-urlencoded'},body:method==='GET'?undefined:body});
  const data=await res.json();
  if(!res.ok) throw new Error(data?.error?.message||`stripe_${res.status}`);
  return data;
}
export async function createExpressAccount(env,{email,country='US',metadata={}}){
  return stripeRequest(env,'/accounts',{type:'express',country,email,capabilities:{transfers:{requested:true}},metadata});
}
export async function createAccountLink(env,{account,refreshUrl,returnUrl}){
  return stripeRequest(env,'/account_links',{account,refresh_url:refreshUrl,return_url:returnUrl,type:'account_onboarding',collection_options:{fields:'eventually_due',future_requirements:'include'}});
}
export async function retrieveAccount(env,account){
  if(!env.STRIPE_SECRET_KEY) throw new Error('stripe_secret_missing');
  const res=await fetch(`${API}/accounts/${encodeURIComponent(account)}`,{headers:{authorization:`Bearer ${env.STRIPE_SECRET_KEY}`}});
  const data=await res.json(); if(!res.ok) throw new Error(data?.error?.message||`stripe_${res.status}`); return data;
}
export async function createCheckoutSession(env,{orderId,items,successUrl,cancelUrl}){
  const line_items=items.map(x=>({price_data:{currency:x.currency||'usd',unit_amount:x.priceMinor,product_data:{name:`${x.title} — ${x.format}`,metadata:{edition_id:x.editionId,author_id:x.authorId}}},quantity:x.quantity||1}));
  return stripeRequest(env,'/checkout/sessions',{mode:'payment',line_items,success_url:successUrl,cancel_url:cancelUrl,client_reference_id:orderId,metadata:{yasready_order_id:orderId},payment_intent_data:{transfer_group:orderId},billing_address_collection:'auto',automatic_tax:{enabled:true}});
}
function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function verifyStripeSignature(payload,header,secret,toleranceSec=300){
  if(!payload||!header||!secret) return false;
  const parts=Object.fromEntries(header.split(',').map(x=>x.split('=',2)));
  const ts=Number(parts.t||0), sig=parts.v1;
  if(!ts||!sig||Math.abs(Date.now()/1000-ts)>toleranceSec) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${payload}`));
  const expected=hex(mac);
  if(expected.length!==sig.length) return false;
  let diff=0; for(let i=0;i<expected.length;i++) diff|=expected.charCodeAt(i)^sig.charCodeAt(i);
  return diff===0;
}
