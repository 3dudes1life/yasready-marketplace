export const ingramCapabilities=Object.freeze({
  shareAndSellFallback:true,
  retailerMetadataFeed:true,
  retailerInventoryFeed:true,
  metadataFeedImport:true,
  inventoryFeedImport:true,
  consumerDirectFulfillment:true,
  ediLifecycle:['purchase_order','purchase_order_ack','pick_pack','asn','invoice'],
  salesReportingImport:true,
  providerInvoiceImport:true,
  retryAndDeadLetter:true,
  ipsExpressCheckout:true,
  ipsExpressCheckoutEligibilityRequired:true,
  audiobookRoadmap:true
});
export const ingramDocumentTypes=Object.freeze(['purchase_order','purchase_order_ack','asn','invoice','cancel','exception']);

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
  return {schema:'yasready.ingram.fulfillment.v1',reference:order.id,currency:order.currency||'usd',shipTo,lines:physical.map(x=>({orderItemId:x.id,isbn:x.isbn,sku:x.providerSku||x.provider_sku,quantity:Number(x.quantity||1)}))};
}
export function buildPurchaseOrderDocument({order,items,shipTo,accountId=null}){
  const request=buildFulfillmentRequest({order,items,shipTo});
  if(!request.lines.length) throw new Error('no_physical_ingram_lines');
  return {schema:'yasready.ingram.po.v1',documentType:'purchase_order',accountId,orderReference:order.id,createdAt:new Date().toISOString(),currency:order.currency||'usd',shipTo,lines:request.lines};
}
export function normalizeIngramDocument(input={}){
  const documentType=String(input.documentType||input.type||'exception').toLowerCase();
  const rawStatus=String(input.status||input.orderStatus||documentType||'submitted');
  const lines=(Array.isArray(input.lines)?input.lines:[]).map(x=>({orderItemId:x.orderItemId||x.order_item_id||null,isbn:x.isbn?String(x.isbn):null,status:x.status||rawStatus,costMinor:x.costMinor==null?null:Number(x.costMinor),trackingNumber:x.trackingNumber||null,trackingUrl:x.trackingUrl||null,packageId:x.packageId||null,carrier:x.carrier||null,serviceLevel:x.serviceLevel||null}));
  return {documentType,orderReference:input.orderReference||input.reference||input.purchaseOrderNumber||null,providerDocumentId:input.providerDocumentId||input.documentId||null,providerOrderId:input.providerOrderId||input.orderId||null,rawStatus,normalizedStatus:normalizeIngramStatus(rawStatus),occurredAt:input.occurredAt||input.timestamp||new Date().toISOString(),trackingNumber:input.trackingNumber||null,trackingUrl:input.trackingUrl||null,lines};
}
