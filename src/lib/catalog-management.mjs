const text=(v,max=500)=>v==null?'':String(v).trim().slice(0,max);
const nullable=(v,max=500)=>{const x=text(v,max);return x||null};
const allowedEditionStates=new Set(['draft','live','paused']);
const allowedVisibility=new Set(['public','direct','private']);
const allowedFormats=new Set(['ebook','paperback','hardcover','audiobook']);

export function normalizeCatalogDraft(raw={},current={}){
  const currentEditions=new Map((current.editions||[]).map(e=>[String(e.id),e]));
  const editions=(Array.isArray(raw.editions)?raw.editions:[]).map(e=>{
    const id=String(e.id||'');
    if(!id||!currentEditions.has(id)) throw new Error(`edition_not_owned:${id||'missing'}`);
    const cur=currentEditions.get(id);
    const priceMinor=Number(e.priceMinor??cur.priceMinor??cur.price_minor??0);
    if(!Number.isInteger(priceMinor)||priceMinor<0) throw new Error(`invalid_price:${id}`);
    const status=String(e.status||cur.status||'draft').toLowerCase();
    if(!allowedEditionStates.has(status)) throw new Error(`invalid_edition_status:${id}`);
    return {id,priceMinor,status};
  });
  const listed=new Set(editions.map(e=>e.id));
  for(const cur of current.editions||[]){
    if(!listed.has(String(cur.id))) editions.push({id:String(cur.id),priceMinor:Number(cur.priceMinor??cur.price_minor??0),status:String(cur.status||'draft')});
  }
  const visibility=String(raw.listing?.visibility||current.listing?.visibility||'public').toLowerCase();
  if(!allowedVisibility.has(visibility)) throw new Error('invalid_visibility');
  return {
    book:{
      displayTitle:nullable(raw.book?.displayTitle??current.book?.displayTitle??current.book?.title,180),
      displaySubtitle:nullable(raw.book?.displaySubtitle??current.book?.displaySubtitle??current.book?.subtitle,220),
      description:nullable(raw.book?.description??current.book?.description,1200),
      longDescription:nullable(raw.book?.longDescription??current.book?.longDescription??current.book?.long_description,6000),
      coverUrl:nullable(raw.book?.coverUrl??current.book?.coverUrl??current.book?.cover_url,1200),
      primaryCategory:nullable(raw.book?.primaryCategory??current.book?.primaryCategory??current.book?.primary_category,120),
      excerpt:nullable(raw.book?.excerpt??current.book?.excerpt,1800)
    },
    listing:{
      visibility,
      seoTitle:nullable(raw.listing?.seoTitle??current.listing?.seoTitle??current.listing?.seo_title,180),
      seoDescription:nullable(raw.listing?.seoDescription??current.listing?.seoDescription??current.listing?.seo_description,320),
      launchAt:nullable(raw.listing?.launchAt??current.listing?.launchAt??current.listing?.scheduled_live_at,80)
    },
    author:{
      displayName:nullable(raw.author?.displayName??current.author?.displayName??current.author?.display_name,140),
      bio:nullable(raw.author?.bio??current.author?.bio,1600),
      websiteUrl:nullable(raw.author?.websiteUrl??current.author?.websiteUrl??current.author?.website_url,1200),
      storefrontTagline:nullable(raw.author?.storefrontTagline??current.author?.storefrontTagline??current.author?.storefront_tagline,220)
    },
    editions
  };
}

export function validateCatalogDraft(draft={},production={}){
  const errors=[],warnings=[];
  const b=draft.book||{},l=draft.listing||{},a=draft.author||{},editions=draft.editions||[];
  if(!b.displayTitle) errors.push('title_required');
  if(!b.coverUrl) errors.push('cover_required');
  if(b.coverUrl){try{const u=new URL(b.coverUrl);if(!['http:','https:'].includes(u.protocol))throw new Error()}catch{errors.push('cover_url_invalid')}}
  if(!b.description) warnings.push('description_recommended');
  if(!b.primaryCategory) warnings.push('category_recommended');
  if(!a.displayName) errors.push('author_name_required');
  if(a.websiteUrl){try{const u=new URL(a.websiteUrl);if(!['http:','https:'].includes(u.protocol))throw new Error()}catch{errors.push('author_website_invalid')}}
  if(l.launchAt&&!Number.isFinite(Date.parse(l.launchAt))) errors.push('launch_date_invalid');
  if(!editions.length) errors.push('edition_required');
  const prodById=new Map((production.editions||[]).map(e=>[String(e.id),e]));
  let saleReady=0;
  for(const e of editions){
    const p=prodById.get(String(e.id))||{};
    const format=String(p.format||'').toLowerCase();
    if(format&&!allowedFormats.has(format)) errors.push(`format_invalid:${e.id}`);
    if(e.status==='live'){
      if(Number(e.priceMinor)<=0) errors.push(`price_required:${e.id}`);
      if(['paperback','hardcover'].includes(format)&&!p.isbn) errors.push(`isbn_required:${e.id}`);
      if(['blocked','failed','incomplete'].includes(String(p.productionStatus??p.production_status??'').toLowerCase())) errors.push(`production_not_ready:${e.id}`);
      else saleReady++;
    }
  }
  if(!saleReady) warnings.push('no_editions_selected_for_sale');
  if(!l.seoTitle) warnings.push('seo_title_can_be_improved');
  if(!l.seoDescription) warnings.push('seo_description_can_be_improved');
  return {valid:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)],saleReadyEditionCount:saleReady};
}

export function catalogPreview({draft,productionBook={},productionEditions=[]}={}){
  const d=draft||{};
  const byId=new Map(productionEditions.map(e=>[String(e.id),e]));
  return {
    title:d.book?.displayTitle||productionBook.title||'',
    subtitle:d.book?.displaySubtitle||productionBook.subtitle||null,
    description:d.book?.description||productionBook.description||null,
    longDescription:d.book?.longDescription||productionBook.long_description||null,
    coverUrl:d.book?.coverUrl||productionBook.cover_url||null,
    category:d.book?.primaryCategory||productionBook.primary_category||null,
    excerpt:d.book?.excerpt||null,
    visibility:d.listing?.visibility||'public',
    seoTitle:d.listing?.seoTitle||d.book?.displayTitle||productionBook.title||'',
    seoDescription:d.listing?.seoDescription||d.book?.description||productionBook.description||'',
    author:d.author||{},
    editions:(d.editions||[]).map(e=>{const p=byId.get(String(e.id))||{};return{id:e.id,format:p.format||null,isbn:p.isbn||null,priceMinor:e.priceMinor,status:e.status,productionStatus:p.productionStatus??p.production_status??null,fulfillmentProvider:p.fulfillmentProvider??p.fulfillment_provider??null}})
  };
}

export function changedCatalogFields(before={},after={}){
  const out=[];
  const walk=(prefix,a,b)=>{
    const keys=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);
    for(const key of keys){const av=a?.[key],bv=b?.[key],path=prefix?`${prefix}.${key}`:key;if(Array.isArray(av)||Array.isArray(bv)){if(JSON.stringify(av)!==JSON.stringify(bv))out.push(path)}else if(av&&typeof av==='object'||bv&&typeof bv==='object')walk(path,av||{},bv||{});else if(JSON.stringify(av??null)!==JSON.stringify(bv??null))out.push(path)}
  };
  walk('',before,after);return out.sort();
}
