const key='yasready.marketplace.events.v1';
export function readEvents(){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}}
export function track(type, properties={}){
  const event={id:crypto.randomUUID?.()||String(Date.now()),type,occurredAt:new Date().toISOString(),properties};
  const events=readEvents(); events.push(event); localStorage.setItem(key,JSON.stringify(events.slice(-500)));
  if(import.meta.env.VITE_MARKETPLACE_MODE==='live') fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(event)}).catch(()=>{});
  return event;
}
export function campaignUrl(book, campaign='direct', source='author-kit'){
  const base=`${location.origin}/?book=${encodeURIComponent(book.slug)}`;
  return `${base}&utm_source=${encodeURIComponent(source)}&utm_campaign=${encodeURIComponent(campaign)}&yr_campaign=${encodeURIComponent(campaign)}`;
}
