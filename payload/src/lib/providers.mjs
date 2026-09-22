export const providerCapabilities=Object.freeze({
  stripe:{checkout:true,connectedAccounts:true,multiSellerAllocation:true,webhooks:true,refunds:true,payouts:true,disputes:true,reconciliation:true},
  ingram:{metadataFeed:true,inventoryFeed:true,costFeed:true,titleMappings:true,operationsReadiness:true,reconciliationCases:true,deadLetterRepair:true,ediFulfillment:true,shareAndSellFallback:true,salesReportingImport:true,providerDocuments:true,ipsExpressCheckout:true,ipsEligibilityRequired:true}
});
export function stripeAllocationPlan(items,feeBps=500){
  const sellers=new Map();
  for(const item of items){const gross=item.priceMinor*(item.quantity||1),fee=Math.round(gross*feeBps/10000),e=sellers.get(item.authorId)||{authorId:item.authorId,grossMinor:0,marketplaceFeeMinor:0,transferBaseMinor:0};e.grossMinor+=gross;e.marketplaceFeeMinor+=fee;e.transferBaseMinor+=gross-fee;sellers.set(item.authorId,e);}return [...sellers.values()];
}
