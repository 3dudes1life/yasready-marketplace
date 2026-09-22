import {sellerPayable} from './lib/money.mjs';
import {stripeAllocationPlan} from './lib/providers.mjs';

const json=(data,status=200)=>new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});
const safeJson=async request=>{try{return await request.json()}catch{return null}};
const uuid=()=>crypto.randomUUID();

async function writeEvent(env,event){if(!env.DB) return; await env.DB.prepare(`INSERT OR IGNORE INTO marketplace_events (id,event_type,anonymous_id,user_id,author_id,book_id,edition_id,order_id,campaign_id,source,medium,occurred_at,properties_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(event.id||uuid(),event.type,event.anonymousId||null,event.userId||null,event.authorId||null,event.bookId||null,event.editionId||null,event.orderId||null,event.campaignId||null,event.source||event.properties?.utm_source||null,event.medium||event.properties?.utm_medium||null,event.occurredAt||new Date().toISOString(),JSON.stringify(event.properties||{})).run();}

async function api(request,env){
  const url=new URL(request.url); const path=url.pathname;
  if(path==='/api/health') return json({ok:true,version:'0.1.0',mode:env.MARKETPLACE_MODE,checkoutEnabled:env.CHECKOUT_ENABLED==='true',stripeMode:env.STRIPE_MODE,ingramMode:env.INGRAM_MODE});
  if(path==='/api/events'&&request.method==='POST'){const event=await safeJson(request);if(!event?.type) return json({ok:false,error:'invalid_event'},400);await writeEvent(env,event);return json({ok:true});}
  if(path==='/api/checkout/plan'&&request.method==='POST'){
    const body=await safeJson(request);if(!Array.isArray(body?.items)) return json({ok:false,error:'items_required'},400);
    const feeBps=Number(env.MARKETPLACE_FEE_BPS||500);return json({ok:true,live:false,allocationPlan:stripeAllocationPlan(body.items,feeBps),note:'Planning endpoint only. Server-side edition price/inventory validation is required before live Checkout Session creation.'});
  }
  if(path==='/api/checkout'&&request.method==='POST'){
    if(env.CHECKOUT_ENABLED!=='true'||env.STRIPE_MODE!=='live') return json({ok:false,error:'checkout_not_live',message:'Marketplace checkout is fail-closed.'},503);
    return json({ok:false,error:'stripe_adapter_not_certified'},503);
  }
  if(path==='/api/providers/ingram/status') return json({ok:true,mode:env.INGRAM_MODE,capabilities:['metadata_feed','inventory_feed','edi_fulfillment','sales_reporting_import','share_and_sell_fallback'],connected:env.INGRAM_MODE!=='off'});
  if(path==='/api/providers/stripe/status') return json({ok:true,mode:env.STRIPE_MODE,checkoutEnabled:env.CHECKOUT_ENABLED==='true',capabilities:['checkout','webhooks','connect','separate_transfers','refunds','payout_reconciliation']});
  if(path==='/api/economics/calculate'&&request.method==='POST'){const b=await safeJson(request);return json({ok:true,...sellerPayable(b||{})});}
  return json({ok:false,error:'not_found'},404);
}

export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/')) return api(request,env);return new Response('Marketplace | YasReady API · v0.1.0',{headers:{'content-type':'text/plain;charset=utf-8'}})}};
