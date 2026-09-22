export const ingramCapabilities=Object.freeze({
  shareAndSellFallback:true,
  retailerMetadataFeed:true,
  retailerInventoryFeed:true,
  consumerDirectFulfillment:true,
  ediLifecycle:['purchase_order','purchase_order_ack','pick_pack','asn','invoice'],
  salesReportingImport:true
});

export function normalizeIngramStatus(raw=''){
  const x=String(raw).trim().toLowerCase();
  if(/deliver/.test(x)) return 'delivered';
  if(/ship|asn|complete/.test(x)) return 'shipped';
  if(/pick|pack|print|process|ack|accept|received/.test(x)) return 'processing';
  if(/cancel|reject|error|fail/.test(x)) return 'failed';
  return 'submitted';
}

export function buildFulfillmentRequest({order,items,shipTo}){
  const physical=items.filter(x=>['paperback','hardcover'].includes(String(x.format).toLowerCase()));
  return {
    schema:'yasready.ingram.fulfillment.v1',
    reference:order.id,
    currency:order.currency||'usd',
    shipTo,
    lines:physical.map(x=>({orderItemId:x.id,isbn:x.isbn,sku:x.providerSku||x.provider_sku,quantity:Number(x.quantity||1)}))
  };
}
