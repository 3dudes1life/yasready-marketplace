export const BUSINESS_EXPORT_SCHEMA='yasready.marketplace.business.v1';
export function buildBusinessExport({author,period,totals,formats=[],campaigns=[],channels=[],marketing=null,generatedAt=new Date().toISOString()}){
  return {
    schema:BUSINESS_EXPORT_SCHEMA,
    generatedAt,
    source:'marketplace.yasready.com',
    author:{id:author.id,userId:author.user_id||author.userId,displayName:author.display_name||author.displayName},
    period,
    totals:{
      grossSalesMinor:Number(totals.grossSalesMinor||0),
      refundsMinor:Number(totals.refundsMinor||0),
      marketplaceFeesMinor:Number(totals.marketplaceFeesMinor||0),
      processorFeesMinor:Number(totals.processorFeesMinor||0),
      fulfillmentCostMinor:Number(totals.fulfillmentCostMinor||0),
      sellerPayableMinor:Number(totals.sellerPayableMinor||0),
      orders:Number(totals.orders||0),
      units:Number(totals.units||0)
    },
    formats,
    campaigns,
    channels,
    marketing,
    provenance:{commercialSystem:'Marketplace | YasReady',canonicalMoneyUnit:'minor',currency:totals.currency||'usd'}
  };
}
