function slugify(value='campaign'){
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'campaign';
}
export function buildCampaignUrl({origin='https://marketplace.yasready.com',bookSlug,campaign='direct',source='author-kit',medium='referral',campaignId}){
  const url=new URL(`/book/${encodeURIComponent(bookSlug)}`,origin);
  url.searchParams.set('utm_source',source);
  url.searchParams.set('utm_medium',medium);
  url.searchParams.set('utm_campaign',slugify(campaign));
  if(campaignId) url.searchParams.set('yr_campaign',campaignId);
  return url.toString();
}
export function buildEmbedHtml({url,title,author,coverUrl='',priceLabel='See formats'}){
  const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const image=coverUrl?`<img src="${esc(coverUrl)}" alt="${esc(title)} book cover" style="width:120px;border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.14)">`:'';
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;gap:18px;align-items:center;max-width:520px;padding:20px;border:1px solid #e5e5ea;border-radius:22px;background:#fff">${image}<div><strong style="display:block;font-size:20px;color:#1d1d1f">${esc(title)}</strong><span style="display:block;margin:4px 0 14px;color:#6e6e73">${esc(author)}</span><a href="${esc(url)}" style="display:inline-block;padding:11px 16px;border-radius:999px;background:#1d1d1f;color:#fff;text-decoration:none;font-weight:700">${esc(priceLabel)}</a></div></div>`;
}
export function socialCopy({title,author,url}){
  return {
    launch:`${title} by ${author} is available now. Choose your format and order here: ${url}`,
    short:`Read ${title}: ${url}`,
    event:`Scan or tap to get ${title} by ${author}: ${url}`
  };
}
