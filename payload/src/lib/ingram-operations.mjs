export const INGRAM_OPERATIONS_SCHEMA='yasready.ingram.operations.v1';
const text=x=>String(x??'').trim();
const minor=x=>x==null?null:Math.round(Number(x));
const cleanIsbn=x=>text(x).replace(/[^0-9Xx]/g,'');
const iso=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toISOString():null};

export function normalizeTitleMapping(input={}){
  const editionId=text(input.editionId||input.edition_id);
  const isbn=cleanIsbn(input.isbn);
  if(!editionId) throw new Error('edition_id_required');
  if(!isbn) throw new Error('isbn_required');
  const status=text(input.status||input.mappingStatus||'unverified').toLowerCase();
  if(!['unverified','verified','stale','error'].includes(status)) throw new Error('mapping_status_invalid');
  const unitCostMinor=minor(input.unitCostMinor??input.unit_cost_minor);
  if(unitCostMinor!=null&&unitCostMinor<0) throw new Error('unit_cost_invalid');
  return {
    schema:'yasready.ingram.title-mapping.v1',provider:'ingram',editionId,isbn,
    providerTitleId:text(input.providerTitleId||input.provider_title_id)||null,
    providerSku:text(input.providerSku||input.provider_sku)||null,
    status,source:text(input.source||'manual')||'manual',sourceReference:text(input.sourceReference||input.source_reference)||null,
    unitCostMinor,currency:text(input.currency||'usd').toLowerCase(),
    metadataVerifiedAt:iso(input.metadataVerifiedAt||input.metadata_verified_at),
    inventoryVerifiedAt:iso(input.inventoryVerifiedAt||input.inventory_verified_at),
    notes:text(input.notes).slice(0,1000)||null
  };
}

export function normalizeCostRow(input={}){
  const isbn=cleanIsbn(input.isbn||input.ISBN);if(!isbn)throw new Error('isbn_required');
  const unitCostMinor=minor(input.unitCostMinor??input.unit_cost_minor??input.costMinor??input.cost_minor);
  if(unitCostMinor==null||unitCostMinor<0)throw new Error('unit_cost_required');
  return {isbn,providerTitleId:text(input.providerTitleId||input.provider_title_id)||null,providerSku:text(input.providerSku||input.provider_sku)||null,unitCostMinor,currency:text(input.currency||'usd').toLowerCase(),effectiveAt:iso(input.effectiveAt||input.effective_at)||new Date().toISOString(),raw:input};
}

export function syncFreshness(capturedAt,{nowAt=new Date().toISOString(),maxAgeHours=168}={}){
  if(!capturedAt)return {status:'missing',ageHours:null,maxAgeHours};
  const a=new Date(capturedAt).getTime(),b=new Date(nowAt).getTime();if(!Number.isFinite(a)||!Number.isFinite(b))return {status:'invalid',ageHours:null,maxAgeHours};
  const ageHours=Math.max(0,(b-a)/3600000);return {status:ageHours<=maxAgeHours?'fresh':'stale',ageHours:Number(ageHours.toFixed(1)),maxAgeHours};
}

export function invoiceVariance({expectedMinor,actualMinor,toleranceMinor=50,toleranceBps=500}={}){
  const expected=minor(expectedMinor),actual=minor(actualMinor);if(expected==null||actual==null)return {status:'missing',expectedMinor:expected,actualMinor:actual,varianceMinor:null,allowedMinor:null};
  const variance=actual-expected,allowed=Math.max(Math.max(0,minor(toleranceMinor)||0),Math.round(Math.abs(expected)*Math.max(0,Number(toleranceBps)||0)/10000));
  return {status:variance===0?'exact':Math.abs(variance)<=allowed?'within_tolerance':'variance',expectedMinor:expected,actualMinor:actual,varianceMinor:variance,allowedMinor:allowed};
}

export function normalizeDeadLetterAction(input={}){
  const action=text(input.action).toLowerCase();if(!['retry','resolve','ignore'].includes(action))throw new Error('dead_letter_action_invalid');
  const note=text(input.note).slice(0,1000)||null;if(['resolve','ignore'].includes(action)&&!note)throw new Error('resolution_note_required');
  return {action,note};
}

export function normalizeExternalSaleRow(input={}){
  const externalSaleId=text(input.externalSaleId||input.external_sale_id);const saleDate=text(input.saleDate||input.sale_date);if(!externalSaleId)throw new Error('external_sale_id_required');if(!saleDate)throw new Error('sale_date_required');
  const quantity=Math.trunc(Number(input.quantity??1));if(!Number.isFinite(quantity)||quantity===0)throw new Error('quantity_invalid');
  return {externalSaleId,saleDate,isbn:cleanIsbn(input.isbn)||null,editionId:text(input.editionId||input.edition_id)||null,quantity,grossMinor:minor(input.grossMinor??input.gross_minor),netMinor:minor(input.netMinor??input.net_minor),returnsMinor:Math.max(0,minor(input.returnsMinor??input.returns_minor??0)||0),currency:text(input.currency||'usd').toLowerCase(),channelName:text(input.channelName||input.channel_name)||null,territory:text(input.territory)||null,metadata:input.metadata||{}};
}

export function ingramOperationsReadiness(config={},metrics={}){
  const mode=text(config.INGRAM_MODE||'off').toLowerCase();
  const number=(k)=>Math.max(0,Number(metrics[k]||0));
  const physical=number('physicalEditions'),mapped=number('mappedPhysicalEditions');
  const checks=[
    {code:'approved_transport',label:'Approved Ingram transport',required:true,pass:['cdf_edi','partner'].includes(mode),detail:mode==='off'?'Provider mode is off':`Mode: ${mode}`},
    {code:'account_reference',label:'Ingram account reference',required:true,pass:!!text(config.INGRAM_ACCOUNT_ID),detail:text(config.INGRAM_ACCOUNT_ID)?'Configured':'Missing account reference'},
    {code:'provider_secret',label:'Provider import secret',required:true,pass:!!text(config.PROVIDER_IMPORT_SECRET),detail:text(config.PROVIDER_IMPORT_SECRET)?'Configured':'Missing provider import secret'},
    {code:'title_mappings',label:'Physical edition mappings',required:true,pass:physical===0||mapped>=physical,detail:`${mapped}/${physical} mapped`},
    {code:'metadata_fresh',label:'Metadata feed freshness',required:true,pass:number('staleMetadata')===0&&number('missingMetadata')===0,detail:`${number('staleMetadata')} stale · ${number('missingMetadata')} missing`},
    {code:'inventory_fresh',label:'Stock/cost feed freshness',required:true,pass:number('staleInventory')===0&&number('missingInventory')===0,detail:`${number('staleInventory')} stale · ${number('missingInventory')} missing`},
    {code:'exception_queue',label:'Open provider exceptions',required:true,pass:number('openDeadLetters')===0,detail:`${number('openDeadLetters')} open`},
    {code:'invoice_reconciliation',label:'Invoice reconciliation',required:true,pass:number('openReconciliationCases')===0,detail:`${number('openReconciliationCases')} open cases`},
    {code:'metadata_import',label:'Metadata import',required:true,pass:config.INGRAM_METADATA_IMPORT_ENABLED==='true',detail:config.INGRAM_METADATA_IMPORT_ENABLED==='true'?'Enabled':'Disabled'},
    {code:'inventory_import',label:'Inventory/cost import',required:true,pass:config.INGRAM_INVENTORY_IMPORT_ENABLED==='true',detail:config.INGRAM_INVENTORY_IMPORT_ENABLED==='true'?'Enabled':'Disabled'},
    {code:'fulfillment_import',label:'Fulfillment events',required:true,pass:config.INGRAM_FULFILLMENT_IMPORT_ENABLED==='true',detail:config.INGRAM_FULFILLMENT_IMPORT_ENABLED==='true'?'Enabled':'Disabled'},
    {code:'invoice_import',label:'Invoice import',required:true,pass:config.INGRAM_INVOICE_IMPORT_ENABLED==='true',detail:config.INGRAM_INVOICE_IMPORT_ENABLED==='true'?'Enabled':'Disabled'},
    {code:'live_submission',label:'Live PO submission',required:true,pass:config.INGRAM_SUBMISSION_ENABLED==='true',detail:config.INGRAM_SUBMISSION_ENABLED==='true'?'Enabled':'Disabled'},
    {code:'sales_reporting',label:'External sales import',required:false,pass:config.INGRAM_REPORT_IMPORT_ENABLED==='true',detail:config.INGRAM_REPORT_IMPORT_ENABLED==='true'?'Enabled':'Optional / disabled'}
  ];
  const required=checks.filter(x=>x.required),passed=required.filter(x=>x.pass).length;
  return {schema:INGRAM_OPERATIONS_SCHEMA,status:passed===required.length?'live_ready':passed>=Math.ceil(required.length*.6)?'prepared':'not_ready',passedRequired:passed,totalRequired:required.length,checks};
}

export function summarizeIngramOperations({jobs=[],deadLetters=[],mappings=[],syncs=[],reconciliationCases=[],externalSales=[]}={}){
  const count=(arr,p)=>arr.filter(p).length;
  const latestSync=syncs.map(x=>x.last_success_at||x.lastSuccessAt).filter(Boolean).sort().at(-1)||null;
  return {schema:INGRAM_OPERATIONS_SCHEMA,jobs:{total:jobs.length,queued:count(jobs,x=>['queued','ready'].includes(x.status)),processing:count(jobs,x=>['submitted','acknowledged','processing'].includes(x.status)),shipped:count(jobs,x=>x.status==='shipped'),failed:count(jobs,x=>x.status==='failed')},mappings:{total:mappings.length,verified:count(mappings,x=>x.mapping_status==='verified'||x.status==='verified'),stale:count(mappings,x=>x.mapping_status==='stale'||x.status==='stale')},exceptions:{open:count(deadLetters,x=>x.status==='open'),reconciliation:count(reconciliationCases,x=>['open','review'].includes(x.status))},externalSales:{rows:externalSales.length,units:externalSales.reduce((s,x)=>s+Number(x.quantity||0),0),netMinor:externalSales.reduce((s,x)=>s+Number(x.net_minor??x.netMinor??0),0)},latestSync};
}
