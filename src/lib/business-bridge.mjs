export const BUSINESS_BRIDGE_SCHEMA='yasready.marketplace.business.v2';
export const BUSINESS_CHANGE_SCHEMA='yasready.marketplace.business.change.v1';
export const BUSINESS_CONSUMER_DEFAULT='yasready-business';

const n=v=>Number(v||0);
const safeString=v=>v==null?null:String(v);

export function businessBridgeCapabilities(env={}){
  const enabled=env.BUSINESS_BRIDGE_ENABLED==='true';
  const secretConfigured=!!env.BUSINESS_BRIDGE_SECRET;
  return {
    schema:BUSINESS_BRIDGE_SCHEMA,
    changeSchema:BUSINESS_CHANGE_SCHEMA,
    enabled,
    serviceAuthConfigured:secretConfigured,
    status:enabled&&secretConfigured?'ready_for_service_sync':'architecture_ready',
    supports:{snapshot:true,incrementalChanges:true,acknowledgement:true,centralUserLookup:true,provenance:true,minorUnits:true,analytics:true,marketing:true,externalChannels:true,payouts:true,settlements:true}
  };
}

export function normalizeBusinessCursor(value){
  const x=Number.parseInt(String(value??'0'),10);
  return Number.isFinite(x)&&x>0?x:0;
}

export function normalizeBusinessLimit(value,{max=500,fallback=100}={}){
  const x=Number.parseInt(String(value??fallback),10);
  return Math.max(1,Math.min(max,Number.isFinite(x)?x:fallback));
}

export function normalizeBusinessAck(raw={}){
  const throughSequence=normalizeBusinessCursor(raw.throughSequence);
  const consumerKey=String(raw.consumerKey||BUSINESS_CONSUMER_DEFAULT).trim().slice(0,120);
  if(!consumerKey) throw new Error('consumer_key_required');
  if(!throughSequence) throw new Error('through_sequence_required');
  return {throughSequence,consumerKey};
}

export function normalizeBusinessChange(row){
  let payload=null;
  try{payload=row.payload_json?JSON.parse(row.payload_json):null}catch{payload={parseError:true}}
  return {
    schema:BUSINESS_CHANGE_SCHEMA,
    sequence:n(row.seq),
    id:row.change_id,
    eventType:row.event_type,
    objectType:row.object_type,
    objectId:row.object_id||null,
    occurredAt:row.occurred_at,
    payload
  };
}

export function buildBusinessSnapshot({author,period,totals,formats=[],campaigns=[],channels=[],marketing=null,analytics=null,settlements=null,payouts=null,throughSequence=0,generatedAt=new Date().toISOString()}){
  return {
    schema:BUSINESS_BRIDGE_SCHEMA,
    generatedAt,
    source:'marketplace.yasready.com',
    identity:{yasreadyUserId:author.user_id||author.userId,marketplaceAuthorId:author.id,displayName:author.display_name||author.displayName||null},
    sync:{throughSequence:n(throughSequence),cursorType:'business_sync_events.seq',incrementalEndpoint:'/api/internal/business/changes'},
    period,
    commerce:{
      currency:String(totals.currency||'usd').toLowerCase(),
      grossSalesMinor:n(totals.grossSalesMinor),
      refundsMinor:n(totals.refundsMinor),
      disputedMinor:n(totals.disputedMinor),
      marketplaceFeesMinor:n(totals.marketplaceFeesMinor),
      processorFeesMinor:n(totals.processorFeesMinor),
      fulfillmentCostMinor:n(totals.fulfillmentCostMinor),
      sellerPayableMinor:n(totals.sellerPayableMinor),
      transferredMinor:n(totals.transferredMinor),
      orders:n(totals.orders),
      units:n(totals.units),
      views:n(totals.views),
      conversionRate:Number(totals.conversionRate||0)
    },
    formats,
    campaigns,
    externalChannels:channels,
    marketing,
    analytics,
    settlements,
    payouts,
    provenance:{
      commercialSystem:'Marketplace | YasReady',
      canonicalMoneyUnit:'minor',
      identityKey:'yasreadyUserId',
      nativeSalesSource:'orders + order_items + ledger_entries',
      externalSalesSource:'external_channel_sales',
      marketingSource:'campaigns + marketplace_events + marketing_campaign_costs',
      analyticsSource:'Analytics Brain',
      generatedFromCanonicalTables:true
    }
  };
}

export function buildBusinessChangeBatch({author,after=0,rows=[],generatedAt=new Date().toISOString()}){
  const changes=rows.map(normalizeBusinessChange);
  const nextCursor=changes.length?changes[changes.length-1].sequence:normalizeBusinessCursor(after);
  return {
    schema:BUSINESS_BRIDGE_SCHEMA,
    changeSchema:BUSINESS_CHANGE_SCHEMA,
    generatedAt,
    source:'marketplace.yasready.com',
    identity:{yasreadyUserId:author.user_id||author.userId,marketplaceAuthorId:author.id},
    sync:{after:normalizeBusinessCursor(after),nextCursor,hasMore:false},
    changes
  };
}

export function businessSyncSummary({snapshot,changes=[]}={}){
  return {
    throughSequence:n(snapshot?.sync?.throughSequence),
    changeCount:Array.isArray(changes)?changes.length:0,
    grossSalesMinor:n(snapshot?.commerce?.grossSalesMinor),
    sellerPayableMinor:n(snapshot?.commerce?.sellerPayableMinor),
    externalChannelCount:Array.isArray(snapshot?.externalChannels)?snapshot.externalChannels.length:0,
    signalCount:Array.isArray(snapshot?.analytics?.signals)?snapshot.analytics.signals.length:0
  };
}
