const key='yasready.marketplace.events.v2';
export function readEvents(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
function anon(){let id=localStorage.getItem('yasready.marketplace.anon');if(!id){id=crypto.randomUUID?.()||String(Date.now());localStorage.setItem('yasready.marketplace.anon',id)}return id}
export function track(type, properties={}){
  const event={id:crypto.randomUUID?.()||String(Date.now()),type,anonymousId:anon(),occurredAt:new Date().toISOString(),bookId:properties.bookId||null,editionId:properties.editionId||null,campaignId:properties.campaignId||new URLSearchParams(location.search).get('yr_campaign')||null,source:properties.source||new URLSearchParams(location.search).get('utm_source')||null,medium:properties.medium||new URLSearchParams(location.search).get('utm_medium')||null,properties};
  const events=readEvents();events.push(event);localStorage.setItem(key,JSON.stringify(events.slice(-1000)));
  if(import.meta.env.VITE_MARKETPLACE_MODE==='live'||location.hostname==='marketplace.yasready.com') fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event)}).catch(()=>{});
  return event;
}
export function campaignUrl(book,campaign='direct',source='author-kit',medium='referral',campaignId=''){
  const url=new URL(`/book/${book.slug}`,location.origin);
  url.searchParams.set('utm_source',source);url.searchParams.set('utm_medium',medium);url.searchParams.set('utm_campaign',campaign.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''));if(campaignId)url.searchParams.set('yr_campaign',campaignId);return url.toString();
}
