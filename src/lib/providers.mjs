export const providerCapabilities = Object.freeze({
  stripe:{checkout:true,connectedAccounts:true,multiSellerAllocation:true,webhooks:true,refunds:true,payouts:true},
  ingram:{metadataFeed:true,inventoryFeed:true,ediFulfillment:true,shareAndSellFallback:true,salesReportingImport:true}
});

export function normalizeIngramStatus(raw=''){
  const x=String(raw).toLowerCase();
  if(/ship|complete|delivered/.test(x)) return 'shipped';
  if(/ack|accept|received|processing|print/.test(x)) return 'processing';
  if(/cancel|reject|error|fail/.test(x)) return 'failed';
  return 'submitted';
}

export function stripeAllocationPlan(items, feeBps=500){
  const sellers=new Map();
  for(const item of items){
    const gross=item.priceMinor*(item.quantity||1);
    const fee=Math.round(gross*feeBps/10000);
    const existing=sellers.get(item.authorId)||{authorId:item.authorId,grossMinor:0,marketplaceFeeMinor:0,transferBaseMinor:0};
    existing.grossMinor+=gross; existing.marketplaceFeeMinor+=fee; existing.transferBaseMinor+=gross-fee;
    sellers.set(item.authorId,existing);
  }
  return [...sellers.values()];
}
