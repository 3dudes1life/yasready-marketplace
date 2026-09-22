export const PUBLISHING_HANDOFF_SCHEMA='yasready.publishing.marketplace.v1';
export const PUBLISHING_OWNED_BOOK_FIELDS=['title','subtitle','description','longDescription','coverUrl','primaryCategory'];
export const MARKETPLACE_OWNED_BOOK_FIELDS=['slug','listingStatus','visibility'];
export const PUBLISHING_OWNED_EDITION_FIELDS=['format','isbn','fulfillmentProvider','providerTitleId','providerSku','productionStatus','artifactRef','artifactHash'];
export const MARKETPLACE_OWNED_EDITION_FIELDS=['priceMinor','currency','status','providerPurchaseUrl'];

const formats=new Set(['ebook','paperback','hardcover','audiobook']);
const physical=new Set(['paperback','hardcover']);
const clean=s=>s==null?null:String(s).trim();
export const slugify=s=>String(s||'book').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96)||'book';
export function normalizeFormat(value){const f=String(value||'').toLowerCase().replace(/\s+/g,'');if(f==='audio'||f==='audio-book')return'audiobook';if(f==='hardback')return'hardcover';return f;}

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
export function stableStringify(value){return JSON.stringify(stable(value));}
export async function sha256Hex(value){const data=new TextEncoder().encode(typeof value==='string'?value:stableStringify(value));const h=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}

export function normalizePublishingHandoff(raw={}){
  if(raw.schema!==PUBLISHING_HANDOFF_SCHEMA) throw new Error('unsupported_schema');
  const userId=clean(raw.userId),sourceBookId=clean(raw.sourceBookId),title=clean(raw.book?.title);
  if(!userId) throw new Error('user_id_required');
  if(!sourceBookId) throw new Error('source_book_id_required');
  if(!title) throw new Error('title_required');
  const incomingEditions=Array.isArray(raw.editions)?raw.editions:[];
  if(!incomingEditions.length) throw new Error('editions_required');
  const seen=new Set();
  const editions=incomingEditions.map((e,i)=>{
    const sourceEditionId=clean(e.sourceEditionId),format=normalizeFormat(e.format);
    if(!sourceEditionId) throw new Error(`source_edition_id_required:${i}`);
    if(seen.has(sourceEditionId)) throw new Error(`duplicate_source_edition_id:${sourceEditionId}`);seen.add(sourceEditionId);
    if(!formats.has(format)) throw new Error(`unsupported_format:${format}`);
    const isbn=clean(e.isbn)?.replace(/[^0-9Xx]/g,'')||null;
    if(physical.has(format)&&!isbn) throw new Error(`isbn_required:${sourceEditionId}`);
    const suggestedPriceMinor=e.suggestedPriceMinor==null?null:Number(e.suggestedPriceMinor);
    if(suggestedPriceMinor!=null&&(!Number.isInteger(suggestedPriceMinor)||suggestedPriceMinor<0)) throw new Error(`invalid_suggested_price:${sourceEditionId}`);
    return {sourceEditionId,format,isbn,currency:String(e.currency||'usd').toLowerCase(),suggestedPriceMinor,fulfillmentProvider:clean(e.fulfillmentProvider)||(physical.has(format)?'ingram':'yasready-digital'),providerTitleId:clean(e.providerTitleId),providerSku:clean(e.providerSku),productionStatus:clean(e.productionStatus)||'ready',artifactRef:clean(e.artifactRef),artifactHash:clean(e.artifactHash),metadata:e.metadata||{}};
  });
  return {schema:PUBLISHING_HANDOFF_SCHEMA,userId,sourceBookId,sourceRevision:clean(raw.sourceRevision),sentAt:clean(raw.sentAt),author:{displayName:clean(raw.author?.displayName)||'YasReady Author',email:clean(raw.author?.email)},book:{title,subtitle:clean(raw.book?.subtitle),description:clean(raw.book?.description),longDescription:clean(raw.book?.longDescription),coverUrl:clean(raw.book?.coverUrl),primaryCategory:clean(raw.book?.primaryCategory),suggestedSlug:slugify(raw.book?.suggestedSlug||title)},editions};
}

export function readinessForSale({book,listing,editions=[],author}={}){
  const errors=[],warnings=[];
  if(!book?.title) errors.push('book_title_required');
  if(!book?.cover_url&&!book?.coverUrl) errors.push('cover_required');
  if(!editions.length) errors.push('edition_required');
  const eligible=[];
  for(const e of editions){
    const id=e.id||e.editionId,format=normalizeFormat(e.format),price=Number(e.price_minor??e.priceMinor??0),prod=e.production_status??e.productionStatus??'unknown';
    const editionErrors=[];
    if(!formats.has(format)) editionErrors.push('format_invalid');
    if(price<=0) editionErrors.push('price_required');
    if(physical.has(format)&&!e.isbn) editionErrors.push('isbn_required');
    if(['blocked','failed','incomplete'].includes(String(prod).toLowerCase())) editionErrors.push('production_not_ready');
    if(!physical.has(format)&&!e.artifact_ref&&!e.artifactRef) warnings.push(`digital_artifact_not_linked:${id}`);
    if(!editionErrors.length) eligible.push(id); else errors.push(...editionErrors.map(x=>`${x}:${id}`));
  }
  if(!eligible.length) errors.push('no_sale_ready_editions');
  if(author&&!author.stripe_connected_account_id) warnings.push('stripe_payout_setup_not_started');
  if(listing?.status==='live') warnings.push('listing_already_live');
  return {ready:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)],eligibleEditionIds:eligible};
}

export function computePublishingDiff({currentBook={},currentEditions=[],incoming}){
  const changes=[];
  for(const f of PUBLISHING_OWNED_BOOK_FIELDS){const dbField={longDescription:'long_description',coverUrl:'cover_url',primaryCategory:'primary_category'}[f]||f;const old=currentBook[dbField]??null,next=incoming.book[f]??null;if(JSON.stringify(old)!==JSON.stringify(next))changes.push({entityType:'book',fieldName:f,ownership:'publishing',oldValue:old,incomingValue:next,disposition:'applied'});}
  const bySource=new Map(currentEditions.map(e=>[e.publishing_source_edition_id||e.publishingSourceEditionId,e]));
  for(const inc of incoming.editions){const cur=bySource.get(inc.sourceEditionId)||{};for(const f of PUBLISHING_OWNED_EDITION_FIELDS){const dbField={fulfillmentProvider:'fulfillment_provider',providerTitleId:'provider_title_id',providerSku:'provider_sku',productionStatus:'production_status',artifactRef:'artifact_ref',artifactHash:'artifact_hash'}[f]||f;const old=cur[dbField]??null,next=inc[f]??null;if(JSON.stringify(old)!==JSON.stringify(next))changes.push({entityType:'edition',sourceEditionId:inc.sourceEditionId,fieldName:f,ownership:'publishing',oldValue:old,incomingValue:next,disposition:'applied'});}if(cur.id&&inc.suggestedPriceMinor!=null&&Number(cur.price_minor)!==inc.suggestedPriceMinor)changes.push({entityType:'edition',sourceEditionId:inc.sourceEditionId,fieldName:'priceMinor',ownership:'marketplace',oldValue:Number(cur.price_minor),incomingValue:inc.suggestedPriceMinor,disposition:'preserved'});}
  return changes;
}

function hex(bytes){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function verifyPublishingSignature(payload,header,secret,toleranceSec=300){
  if(!payload||!header||!secret)return false;const parts=header.split(',').map(x=>x.split('=',2));const ts=Number(parts.find(x=>x[0]==='t')?.[1]||0),sigs=parts.filter(x=>x[0]==='v1').map(x=>x[1]);if(!ts||!sigs.length||Math.abs(Date.now()/1000-ts)>toleranceSec)return false;const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const mac=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${ts}.${payload}`)),expected=hex(mac);return sigs.some(sig=>{if(sig.length!==expected.length)return false;let diff=0;for(let i=0;i<sig.length;i++)diff|=sig.charCodeAt(i)^expected.charCodeAt(i);return diff===0;});
}
