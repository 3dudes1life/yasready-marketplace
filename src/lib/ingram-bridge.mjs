export const INGRAM_BRIDGE_SCHEMA='yasready.ingram.bridge.v1';
export const INGRAM_LIFECYCLE=Object.freeze(['purchase_order','purchase_order_ack','pick_pack','asn','invoice']);
export const INGRAM_NORMALIZED_STATES=Object.freeze(['queued','ready','submitted','acknowledged','processing','shipped','delivered','failed','cancelled']);

const text=x=>String(x??'').trim();
const upper=x=>text(x).toUpperCase();
const minor=x=>x==null?null:Math.round(Number(x));

export function providerMode(raw='off'){
  const x=text(raw).toLowerCase();
  return ['off','manual','share_sell','cdf_edi','partner'].includes(x)?x:'off';
}

export function ingramReadiness(config={}){
  const mode=providerMode(config.INGRAM_MODE);
  const submission=config.INGRAM_SUBMISSION_ENABLED==='true';
  const connected=mode!=='off';
  return {
    schema:INGRAM_BRIDGE_SCHEMA,
    mode,connected,
    liveSubmissionEnabled:submission,
    safeToPrepareDocuments:true,
    metadataImportEnabled:config.INGRAM_METADATA_IMPORT_ENABLED==='true',
    inventoryImportEnabled:config.INGRAM_INVENTORY_IMPORT_ENABLED==='true',
    salesImportEnabled:config.INGRAM_REPORT_IMPORT_ENABLED==='true',
    fulfillmentImportEnabled:config.INGRAM_FULFILLMENT_IMPORT_ENABLED==='true',
    invoiceImportEnabled:config.INGRAM_INVOICE_IMPORT_ENABLED==='true',
    retryEnabled:config.INGRAM_RETRY_ENABLED==='true',
    canSubmit:connected&&submission&&['cdf_edi','partner'].includes(mode),
    reason:!connected?'provider_off':!submission?'submission_gate_off':!['cdf_edi','partner'].includes(mode)?'approved_transport_required':'ready'
  };
}

export function normalizeInventoryRow(row={}){
  const isbn=text(row.isbn||row.ISBN).replace(/[^0-9Xx]/g,'');
  if(!isbn) throw new Error('isbn_required');
  const raw=text(row.availability||row.status||row.stockStatus||'unknown').toLowerCase();
  let availability='unknown';
  if(/available|in stock|stocked|print on demand|pod/.test(raw)) availability='available';
  else if(/backorder|back order/.test(raw)) availability='backorder';
  else if(/unavailable|out of stock|not available/.test(raw)) availability='unavailable';
  return {isbn,providerSku:text(row.providerSku||row.sku)||null,availability,rawAvailability:raw||null,onHand:row.onHand==null?null:Number(row.onHand),unitCostMinor:minor(row.unitCostMinor),currency:text(row.currency||'usd').toLowerCase()};
}

export function normalizeMetadataRow(row={}){
  const isbn=text(row.isbn||row.ISBN).replace(/[^0-9Xx]/g,'');
  if(!isbn) throw new Error('isbn_required');
  return {isbn,title:text(row.title)||null,author:text(row.author)||null,publisher:text(row.publisher)||null,imprint:text(row.imprint)||null,format:text(row.format)||null,coverUrl:text(row.coverUrl||row.cover_url)||null,publicationDate:text(row.publicationDate||row.publication_date)||null,raw:row};
}

export function normalizeInvoice(input={}){
  const orderReference=text(input.orderReference||input.purchaseOrderNumber||input.reference);
  const invoiceId=text(input.invoiceId||input.providerInvoiceId||input.documentId);
  if(!orderReference) throw new Error('order_reference_required');
  if(!invoiceId) throw new Error('invoice_id_required');
  const lines=(Array.isArray(input.lines)?input.lines:[]).map((x,i)=>({lineNumber:Number(x.lineNumber||i+1),orderItemId:text(x.orderItemId||x.order_item_id)||null,isbn:text(x.isbn).replace(/[^0-9Xx]/g,'')||null,quantity:Number(x.quantity||1),amountMinor:minor(x.amountMinor),shippingMinor:minor(x.shippingMinor),taxMinor:minor(x.taxMinor),currency:text(x.currency||input.currency||'usd').toLowerCase()}));
  return {schema:'yasready.ingram.invoice.v1',orderReference,invoiceId,invoiceDate:text(input.invoiceDate||input.date)||null,currency:text(input.currency||'usd').toLowerCase(),subtotalMinor:minor(input.subtotalMinor),shippingMinor:minor(input.shippingMinor),taxMinor:minor(input.taxMinor),totalMinor:minor(input.totalMinor),lines};
}

export function nextRetrySeconds(attempt=1){
  const n=Math.max(1,Math.min(12,Number(attempt)||1));
  return Math.min(21600,60*(2**(n-1)));
}

export function providerJobKey({provider='ingram',orderItemId,kind='fulfillment'}){
  if(!orderItemId) throw new Error('order_item_id_required');
  return `${provider}:${kind}:${orderItemId}`;
}

export function normalizeBridgeError(error){
  const message=text(error?.message||error||'unknown_provider_error').slice(0,500);
  const low=message.toLowerCase();
  let code='provider_error',retryable=true;
  if(/auth|credential|unauthor|forbidden/.test(low)){code='provider_auth';retryable=false}
  else if(/isbn|address|validation|invalid/.test(low)){code='provider_validation';retryable=false}
  else if(/timeout|temporar|rate|429|5\\d\\d/.test(low)){code='provider_temporary';retryable=true}
  return {code,message,retryable};
}

export function validatePhysicalOrder({order,items=[],shipTo}={}){
  const errors=[];
  if(!order?.id) errors.push('order_id_required');
  const physical=items.filter(x=>['paperback','hardcover'].includes(text(x.format).toLowerCase()));
  if(!physical.length) errors.push('physical_items_required');
  for(const item of physical){if(!text(item.isbn))errors.push(`isbn_required:${item.id||'unknown'}`);if(Number(item.quantity||0)<1)errors.push(`quantity_required:${item.id||'unknown'}`)}
  if(!shipTo||!text(shipTo.country))errors.push('ship_to_country_required');
  if(!shipTo||!text(shipTo.address1||shipTo.line1))errors.push('ship_to_address_required');
  if(!shipTo||!text(shipTo.city))errors.push('ship_to_city_required');
  if(!shipTo||!text(shipTo.postalCode||shipTo.postal_code))errors.push('ship_to_postal_code_required');
  return {ok:errors.length===0,errors,physicalCount:physical.length};
}
